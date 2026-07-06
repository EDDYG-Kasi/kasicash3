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
Object.defineProperty(exports, "__esModule", { value: true });
exports.ParsingService = void 0;
exports.parseTransactionText = parseTransactionText;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("typeorm");
const ledger_service_1 = require("../ledger/ledger.service");
const account_entity_1 = require("../ledger/entities/account.entity");
const CASH_CODE = '100';
const SALES_CODE = '400';
const EXPENSES_CODE = '500';
let ParsingService = class ParsingService {
    dataSource;
    ledger;
    constructor(dataSource, ledger) {
        this.dataSource = dataSource;
        this.ledger = ledger;
    }
    async parseAndPost(input) {
        const parsed = parseTransactionText(input.textBody, input.messageType);
        if (!parsed)
            return { status: 'UNRECOGNIZED' };
        const accounts = await this.loadSeedAccounts(input.businessId);
        const amountMinor = parsed.amountMinor;
        const entries = parsed.kind === 'SALE'
            ? [
                {
                    accountId: accounts.cash.id,
                    amountMinor,
                    type: 'DEBIT',
                },
                {
                    accountId: accounts.sales.id,
                    amountMinor,
                    type: 'CREDIT',
                },
            ]
            : [
                {
                    accountId: accounts.expenses.id,
                    amountMinor,
                    type: 'DEBIT',
                },
                {
                    accountId: accounts.cash.id,
                    amountMinor,
                    type: 'CREDIT',
                },
            ];
        const transaction = await this.ledger.postTransaction({
            businessId: input.businessId,
            description: parsed.description,
            currency: 'ZAR',
            idempotencyKey: `wa:${input.waMessageId}`,
            sourceType: 'WHATSAPP',
            sourceMessageId: input.waMessageId,
            sourcePayloadHash: input.payloadHash,
            occurredAt: input.waTimestamp,
            receivedAt: input.receivedAt,
            entries,
        });
        return {
            status: 'POSTED',
            kind: parsed.kind,
            amountMinor,
            transactionId: transaction.id,
        };
    }
    async loadSeedAccounts(businessId) {
        const accounts = await this.dataSource.manager.find(account_entity_1.Account, {
            where: { businessId, code: (0, typeorm_1.In)([CASH_CODE, SALES_CODE, EXPENSES_CODE]) },
        });
        const byCode = new Map(accounts.map((account) => [account.code, account]));
        const cash = byCode.get(CASH_CODE);
        const sales = byCode.get(SALES_CODE);
        const expenses = byCode.get(EXPENSES_CODE);
        if (!cash || !sales || !expenses) {
            throw new Error('Seed chart of accounts is incomplete for business');
        }
        return { cash, sales, expenses };
    }
};
exports.ParsingService = ParsingService;
exports.ParsingService = ParsingService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [typeorm_1.DataSource,
        ledger_service_1.LedgerService])
], ParsingService);
function parseTransactionText(textBody, messageType = 'text') {
    if (messageType !== 'text' || !textBody)
        return null;
    const normalized = normalizeText(textBody);
    const amountMinor = extractAmountMinor(normalized);
    if (!amountMinor)
        return null;
    const kind = classifyKind(normalized);
    if (!kind)
        return null;
    return {
        kind,
        amountMinor,
        description: buildDescription(kind, textBody),
    };
}
function normalizeText(raw) {
    return raw
        .toLowerCase()
        .replace(/[^\p{L}\p{N}.,\s]/gu, ' ')
        .replace(/\s+/g, ' ')
        .trim();
}
function classifyKind(normalized) {
    if (/\b(sold|sale|sales|received|income|earned)\b/.test(normalized)) {
        return 'SALE';
    }
    if (/\b(spent|paid|bought|buy|expense|expenses)\b/.test(normalized)) {
        return 'EXPENSE';
    }
    return null;
}
function extractAmountMinor(normalized) {
    const match = /\b(?:r|zar)\s*([0-9][0-9,]*(?:\.[0-9]{1,2})?)\b/.exec(normalized) ??
        /\b([0-9][0-9,]*(?:\.[0-9]{1,2})?)\s*(?:rand|rands|zar)\b/.exec(normalized);
    if (!match)
        return null;
    const raw = match[1].replace(/,/g, '');
    const [major, minor = ''] = raw.split('.');
    const cents = (minor + '00').slice(0, 2);
    const amount = BigInt(major) * 100n + BigInt(cents);
    return amount > 0n ? amount.toString() : null;
}
function buildDescription(kind, raw) {
    const cleaned = raw
        .replace(/[\u0000-\u001f\u007f]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
    const fallback = kind === 'SALE' ? 'WhatsApp sale' : 'WhatsApp expense';
    return (cleaned || fallback).slice(0, 160);
}
//# sourceMappingURL=parsing.service.js.map