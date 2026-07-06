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
var RecoveryService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.RecoveryService = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("typeorm");
const inbound_message_entity_1 = require("./entities/inbound-message.entity");
const ingestion_service_1 = require("./ingestion.service");
let RecoveryService = RecoveryService_1 = class RecoveryService {
    dataSource;
    ingestion;
    logger = new common_1.Logger(RecoveryService_1.name);
    timer;
    running = false;
    intervalMs = 30_000;
    staleReceivedMs = 60_000;
    batchSize = 20;
    constructor(dataSource, ingestion) {
        this.dataSource = dataSource;
        this.ingestion = ingestion;
    }
    onModuleInit() {
        if (process.env.INGESTION_RECOVERY_DISABLED === 'true')
            return;
        this.timer = setInterval(() => {
            void this.runRecoveryCycle().catch((err) => {
                const message = err instanceof Error ? err.message : String(err);
                this.logger.error(`Recovery cycle failed: ${message.slice(0, 200)}`);
            });
        }, this.intervalMs);
        this.timer.unref?.();
    }
    onModuleDestroy() {
        if (this.timer)
            clearInterval(this.timer);
    }
    async runRecoveryCycle() {
        if (this.running)
            return { recovered: 0 };
        this.running = true;
        try {
            const now = new Date();
            const staleBefore = new Date(now.getTime() - this.staleReceivedMs);
            const due = await this.dataSource.manager.find(inbound_message_entity_1.InboundMessage, {
                where: [
                    { status: 'RECEIVED', receivedAt: (0, typeorm_1.LessThan)(staleBefore) },
                    { status: 'FAILED', nextRetryAt: (0, typeorm_1.LessThanOrEqual)(now) },
                    { status: 'PROCESSING', nextRetryAt: (0, typeorm_1.LessThanOrEqual)(now) },
                ],
                order: { receivedAt: 'ASC' },
                take: this.batchSize,
            });
            let recovered = 0;
            for (const row of due) {
                try {
                    const processed = await this.ingestion.processMessage(row.id);
                    if (processed)
                        recovered++;
                }
                catch (err) {
                    const message = err instanceof Error ? err.message : String(err);
                    this.logger.error(`Recovery failed for inbound ${row.id}: ${message.slice(0, 200)}`);
                }
            }
            if (recovered > 0) {
                this.logger.log(`Recovery cycle processed ${recovered} message(s)`);
            }
            return { recovered };
        }
        finally {
            this.running = false;
        }
    }
};
exports.RecoveryService = RecoveryService;
exports.RecoveryService = RecoveryService = RecoveryService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [typeorm_1.DataSource,
        ingestion_service_1.IngestionService])
], RecoveryService);
//# sourceMappingURL=recovery.service.js.map