"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
var IngestionService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.MAX_ATTEMPTS = exports.IngestionService = void 0;
exports.backoffMs = backoffMs;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("typeorm");
const crypto_1 = require("crypto");
const inbound_message_entity_1 = require("./entities/inbound-message.entity");
const onboarding_service_1 = require("./onboarding.service");
const whatsapp_client_1 = require("./whatsapp.client");
const parsing_service_1 = require("../parsing/parsing.service");
let IngestionService = IngestionService_1 = class IngestionService {
    dataSource;
    onboarding;
    parsing;
    wa;
    logger = new common_1.Logger(IngestionService_1.name);
    constructor(dataSource, onboarding, parsing, wa) {
        this.dataSource = dataSource;
        this.onboarding = onboarding;
        this.parsing = parsing;
        this.wa = wa;
    }
    async ingestWebhook(payload, rawBody) {
        const payloadHash = (0, crypto_1.createHash)('sha256').update(rawBody).digest('hex');
        let stored = 0;
        let duplicates = 0;
        for (const entry of payload.entry ?? []) {
            for (const change of entry.changes ?? []) {
                const value = change.value;
                if (!value?.messages)
                    continue;
                const contactName = value.contacts?.[0]?.profile?.name;
                for (const msg of value.messages) {
                    const saved = await this.storeIdempotent(msg, payloadHash);
                    if (!saved) {
                        duplicates++;
                        continue;
                    }
                    stored++;
                    setImmediate(() => {
                        void this.processMessage(saved.id, contactName).catch((err) => {
                            const message = err instanceof Error ? err.message : String(err);
                            this.logger.error(`Async ingestion handoff failed for inbound ${saved.id}: ${message.slice(0, 200)}`);
                        });
                    });
                }
            }
        }
        return { stored, duplicates };
    }
    async ingestSyntheticText(input) {
        const timestamp = input.timestamp ?? new Date();
        const waMessageId = input.messageId ?? `dev.${(0, crypto_1.randomUUID)()}`;
        const msg = {
            id: waMessageId,
            from: input.from,
            timestamp: Math.floor(timestamp.getTime() / 1000).toString(),
            type: 'text',
            text: { body: input.text },
        };
        const syntheticPayload = {
            object: 'dev.whatsapp',
            entry: [
                {
                    changes: [
                        {
                            field: 'messages',
                            value: {
                                contacts: [
                                    {
                                        wa_id: input.from,
                                        profile: input.contactName
                                            ? { name: input.contactName }
                                            : undefined,
                                    },
                                ],
                                messages: [msg],
                            },
                        },
                    ],
                },
            ],
        };
        const rawBody = Buffer.from(JSON.stringify(syntheticPayload));
        const payloadHash = (0, crypto_1.createHash)('sha256').update(rawBody).digest('hex');
        const saved = await this.storeIdempotent(msg, payloadHash);
        if (!saved) {
            return {
                stored: false,
                duplicate: true,
                processed: false,
                waMessageId,
            };
        }
        const processed = await this.processMessage(saved.id, input.contactName);
        return {
            stored: true,
            duplicate: false,
            processed,
            inboundId: saved.id,
            waMessageId,
        };
    }
    async storeIdempotent(msg, payloadHash) {
        try {
            const row = this.dataSource.manager.create(inbound_message_entity_1.InboundMessage, {
                waMessageId: msg.id,
                waFrom: msg.from,
                payload: msg,
                payloadHash,
                messageType: msg.type,
                textBody: msg.text?.body,
                waTimestamp: new Date(Number(msg.timestamp) * 1000),
                status: 'RECEIVED',
            });
            return await this.dataSource.manager.save(row);
        }
        catch (err) {
            if (isUniqueViolation(err)) {
                const existing = await this.dataSource.manager.findOne(inbound_message_entity_1.InboundMessage, {
                    where: { waMessageId: msg.id },
                });
                if (existing && existing.payloadHash !== payloadHash) {
                    this.logger.warn(`wa_message_id ${msg.id} reused with a different payload hash; ignoring the conflicting redelivery`);
                }
                return null;
            }
            throw err;
        }
    }
    async processMessage(id, contactName) {
        const leaseUntil = new Date(Date.now() + PROCESSING_LEASE_MS);
        const claimed = await this.dataSource.query(`UPDATE inbound_messages
         SET status = 'PROCESSING', next_retry_at = $2
       WHERE id = $1
         AND (status IN ('RECEIVED', 'FAILED')
               OR (status = 'PROCESSING' AND next_retry_at <= now()))
       RETURNING wa_from, wa_message_id, payload_hash, text_body, message_type, wa_timestamp, received_at`, [id, leaseUntil]);
        if (claimed.length === 0)
            return false;
        const message = claimed[0];
        const waFrom = message.wa_from;
        let replyBody;
        try {
            const { business, created } = await this.onboarding.resolveOrCreateBusiness(waFrom, contactName);
            const parseResult = await this.parsing.parseAndPost({
                businessId: business.id,
                waMessageId: message.wa_message_id,
                payloadHash: message.payload_hash,
                textBody: message.text_body,
                messageType: message.message_type,
                waTimestamp: message.wa_timestamp,
                receivedAt: message.received_at,
            });
            await this.dataSource.manager.update(inbound_message_entity_1.InboundMessage, id, {
                businessId: business.id,
                status: 'PROCESSED',
                processedAt: new Date(),
                error: null,
                nextRetryAt: null,
            });
            replyBody = buildReplyBody(created, business.name, parseResult);
        }
        catch (err) {
            await this.recordFailure(id, err);
            return true;
        }
        try {
            await this.wa.sendText(waFrom, replyBody);
        }
        catch (err) {
            const message = err instanceof Error ? err.message : String(err);
            this.logger.warn(`Reply send failed for ${id} (message already processed): ${message.slice(0, 200)}`);
        }
        return true;
    }
    async recordFailure(id, err) {
        const message = err instanceof Error ? err.message : String(err);
        const current = await this.dataSource.manager.findOne(inbound_message_entity_1.InboundMessage, {
            where: { id },
        });
        const attempts = (current?.attempts ?? 0) + 1;
        const exhausted = attempts >= exports.MAX_ATTEMPTS;
        this.logger.error(`Processing failed for inbound ${id} (attempt ${attempts}/${exports.MAX_ATTEMPTS}): ${message.slice(0, 200)}`);
        await this.dataSource.manager
            .update(inbound_message_entity_1.InboundMessage, id, {
            status: exhausted ? 'DEAD' : 'FAILED',
            attempts,
            error: message.slice(0, 500),
            nextRetryAt: exhausted
                ? null
                : new Date(Date.now() + backoffMs(attempts)),
        })
            .catch(() => undefined);
        if (exhausted) {
            this.logger.error(`Inbound ${id} moved to dead-letter (DEAD) after ${attempts} attempts`);
        }
    }
};
exports.IngestionService = IngestionService;
exports.IngestionService = IngestionService = IngestionService_1 = __decorate([
    (0, common_1.Injectable)(),
    __param(3, (0, common_1.Inject)(whatsapp_client_1.WHATSAPP_CLIENT)),
    __metadata("design:paramtypes", [typeorm_1.DataSource,
        onboarding_service_1.OnboardingService,
        parsing_service_1.ParsingService, Object])
], IngestionService);
exports.MAX_ATTEMPTS = 5;
const PROCESSING_LEASE_MS = 5 * 60_000;
const BASE_BACKOFF_MS = 60_000;
const MAX_BACKOFF_MS = 60 * 60_000;
function backoffMs(attempts) {
    return Math.min(BASE_BACKOFF_MS * 2 ** (attempts - 1), MAX_BACKOFF_MS);
}
function isUniqueViolation(err) {
    const driverError = err instanceof typeorm_1.QueryFailedError
        ? err.driverError
        : err;
    return driverError?.code === '23505';
}
function buildReplyBody(created, businessName, parseResult) {
    const prefix = created
        ? `Welcome to KasiCash! Your business "${businessName}" is set up. `
        : '';
    if (parseResult.status === 'POSTED') {
        const label = parseResult.kind === 'SALE' ? 'sale' : 'expense';
        return `${prefix}Recorded a ${label} of ${formatRand(parseResult.amountMinor)}.`;
    }
    return `${prefix}I couldn't confidently record that as a transaction yet. Try: "sold R30 airtime" or "spent R20 stock".`;
}
function formatRand(amountMinor) {
    const amount = BigInt(amountMinor);
    const cents = (amount % 100n).toString().padStart(2, '0');
    return `R${(amount / 100n).toString()}.${cents}`;
}
//# sourceMappingURL=ingestion.service.js.map