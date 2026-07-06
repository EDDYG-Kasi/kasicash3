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
exports.InboundMessage = void 0;
const typeorm_1 = require("typeorm");
let InboundMessage = class InboundMessage {
    id;
    waMessageId;
    waFrom;
    businessId;
    payload;
    payloadHash;
    messageType;
    textBody;
    waTimestamp;
    receivedAt;
    status;
    attempts;
    nextRetryAt;
    processedAt;
    error;
};
exports.InboundMessage = InboundMessage;
__decorate([
    (0, typeorm_1.PrimaryGeneratedColumn)('uuid'),
    __metadata("design:type", String)
], InboundMessage.prototype, "id", void 0);
__decorate([
    (0, typeorm_1.Index)({ unique: true }),
    (0, typeorm_1.Column)({ name: 'wa_message_id', type: 'varchar' }),
    __metadata("design:type", String)
], InboundMessage.prototype, "waMessageId", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'wa_from', type: 'varchar' }),
    __metadata("design:type", String)
], InboundMessage.prototype, "waFrom", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'business_id', type: 'uuid', nullable: true }),
    __metadata("design:type", String)
], InboundMessage.prototype, "businessId", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'jsonb' }),
    __metadata("design:type", Object)
], InboundMessage.prototype, "payload", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'payload_hash', type: 'varchar' }),
    __metadata("design:type", String)
], InboundMessage.prototype, "payloadHash", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'message_type', type: 'varchar' }),
    __metadata("design:type", String)
], InboundMessage.prototype, "messageType", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'text_body', type: 'text', nullable: true }),
    __metadata("design:type", String)
], InboundMessage.prototype, "textBody", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'wa_timestamp', type: 'timestamp' }),
    __metadata("design:type", Date)
], InboundMessage.prototype, "waTimestamp", void 0);
__decorate([
    (0, typeorm_1.CreateDateColumn)({ name: 'received_at' }),
    __metadata("design:type", Date)
], InboundMessage.prototype, "receivedAt", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', default: 'RECEIVED' }),
    __metadata("design:type", String)
], InboundMessage.prototype, "status", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'int', default: 0 }),
    __metadata("design:type", Number)
], InboundMessage.prototype, "attempts", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'next_retry_at', type: 'timestamp', nullable: true }),
    __metadata("design:type", Object)
], InboundMessage.prototype, "nextRetryAt", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'processed_at', type: 'timestamp', nullable: true }),
    __metadata("design:type", Date)
], InboundMessage.prototype, "processedAt", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'text', nullable: true }),
    __metadata("design:type", Object)
], InboundMessage.prototype, "error", void 0);
exports.InboundMessage = InboundMessage = __decorate([
    (0, typeorm_1.Entity)('inbound_messages')
], InboundMessage);
//# sourceMappingURL=inbound-message.entity.js.map