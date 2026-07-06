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
exports.Transaction = void 0;
const typeorm_1 = require("typeorm");
const business_entity_1 = require("./business.entity");
const entry_entity_1 = require("./entry.entity");
let Transaction = class Transaction {
    id;
    description;
    currency;
    idempotencyKey;
    sourceType;
    sourceMessageId;
    sourcePayloadHash;
    occurredAt;
    receivedAt;
    postedAt;
    status;
    reversalOfTransaction;
    reversalOfTransactionId;
    business;
    businessId;
    createdAt;
    entries;
};
exports.Transaction = Transaction;
__decorate([
    (0, typeorm_1.PrimaryGeneratedColumn)('uuid'),
    __metadata("design:type", String)
], Transaction.prototype, "id", void 0);
__decorate([
    (0, typeorm_1.Column)(),
    __metadata("design:type", String)
], Transaction.prototype, "description", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 3 }),
    __metadata("design:type", String)
], Transaction.prototype, "currency", void 0);
__decorate([
    (0, typeorm_1.Index)(),
    (0, typeorm_1.Column)({ name: 'idempotency_key', type: 'varchar' }),
    __metadata("design:type", String)
], Transaction.prototype, "idempotencyKey", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'source_type', type: 'varchar' }),
    __metadata("design:type", String)
], Transaction.prototype, "sourceType", void 0);
__decorate([
    (0, typeorm_1.Index)(),
    (0, typeorm_1.Column)({ name: 'source_message_id', nullable: true, type: 'varchar' }),
    __metadata("design:type", String)
], Transaction.prototype, "sourceMessageId", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'source_payload_hash', nullable: true, type: 'varchar' }),
    __metadata("design:type", String)
], Transaction.prototype, "sourcePayloadHash", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'occurred_at', type: 'timestamp' }),
    __metadata("design:type", Date)
], Transaction.prototype, "occurredAt", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'received_at', type: 'timestamp' }),
    __metadata("design:type", Date)
], Transaction.prototype, "receivedAt", void 0);
__decorate([
    (0, typeorm_1.Column)({
        name: 'posted_at',
        type: 'timestamp',
        default: () => 'CURRENT_TIMESTAMP',
    }),
    __metadata("design:type", Date)
], Transaction.prototype, "postedAt", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', default: 'POSTED' }),
    __metadata("design:type", String)
], Transaction.prototype, "status", void 0);
__decorate([
    (0, typeorm_1.Index)(),
    (0, typeorm_1.ManyToOne)(() => Transaction, { nullable: true }),
    (0, typeorm_1.JoinColumn)({ name: 'reversal_of_transaction_id' }),
    __metadata("design:type", Transaction)
], Transaction.prototype, "reversalOfTransaction", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'reversal_of_transaction_id', nullable: true, type: 'uuid' }),
    __metadata("design:type", String)
], Transaction.prototype, "reversalOfTransactionId", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(() => business_entity_1.Business, (business) => business.transactions),
    (0, typeorm_1.JoinColumn)({ name: 'business_id' }),
    __metadata("design:type", business_entity_1.Business)
], Transaction.prototype, "business", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'business_id', type: 'uuid' }),
    __metadata("design:type", String)
], Transaction.prototype, "businessId", void 0);
__decorate([
    (0, typeorm_1.CreateDateColumn)({ name: 'created_at' }),
    __metadata("design:type", Date)
], Transaction.prototype, "createdAt", void 0);
__decorate([
    (0, typeorm_1.OneToMany)(() => entry_entity_1.Entry, (entry) => entry.transaction),
    __metadata("design:type", Array)
], Transaction.prototype, "entries", void 0);
exports.Transaction = Transaction = __decorate([
    (0, typeorm_1.Entity)('transactions'),
    (0, typeorm_1.Unique)(['businessId', 'idempotencyKey'])
], Transaction);
//# sourceMappingURL=transaction.entity.js.map