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
exports.LedgerService = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("typeorm");
const transaction_entity_1 = require("./entities/transaction.entity");
const entry_entity_1 = require("./entities/entry.entity");
const account_entity_1 = require("./entities/account.entity");
const IDEMPOTENCY_CONSTRAINT = 'UQ_transactions_business_idempotency';
const REVERSAL_UNIQUE_INDEX = 'UQ_transactions_one_reversal_per_original';
const INTERNAL_SOURCE_TYPE = 'SYSTEM';
const INT64_MAX = 9223372036854775807n;
let LedgerService = class LedgerService {
    dataSource;
    constructor(dataSource) {
        this.dataSource = dataSource;
    }
    async postTransaction(dto) {
        if (!dto.idempotencyKey)
            throw new common_1.BadRequestException('Idempotency key is required.');
        if (!dto.currency)
            throw new common_1.BadRequestException('Currency is required.');
        if (!dto.sourceType)
            throw new common_1.BadRequestException('Source reference is required.');
        if (dto.sourceType !== INTERNAL_SOURCE_TYPE && !dto.sourcePayloadHash) {
            throw new common_1.BadRequestException('Source payload hash is required for externally sourced transactions.');
        }
        if (!dto.entries || dto.entries.length < 2) {
            throw new common_1.BadRequestException('A transaction must have at least two entries.');
        }
        let totalDebits = 0n;
        let totalCredits = 0n;
        for (const entry of dto.entries) {
            if (!entry.accountId)
                throw new common_1.BadRequestException('Every entry must reference an account.');
            if (entry.type !== 'DEBIT' && entry.type !== 'CREDIT')
                throw new common_1.BadRequestException('Entry must have explicit DEBIT or CREDIT side.');
            const amount = parseAmountMinor(entry.amountMinor);
            if (entry.type === 'DEBIT')
                totalDebits += amount;
            else
                totalCredits += amount;
        }
        if (totalDebits !== totalCredits) {
            throw new common_1.BadRequestException(`Double-entry violation: Debits (${totalDebits.toString()}) do not equal Credits (${totalCredits.toString()}).`);
        }
        const queryRunner = this.dataSource.createQueryRunner();
        await queryRunner.connect();
        await queryRunner.startTransaction();
        try {
            await this.assertAccountsBelongToBusiness(queryRunner.manager, dto.businessId, dto.entries.map((e) => e.accountId));
            const existing = await queryRunner.manager.findOne(transaction_entity_1.Transaction, {
                where: {
                    businessId: dto.businessId,
                    idempotencyKey: dto.idempotencyKey,
                },
                relations: { entries: true },
            });
            if (existing) {
                await queryRunner.rollbackTransaction();
                return reconcileIdempotentPost(existing, dto);
            }
            const transaction = queryRunner.manager.create(transaction_entity_1.Transaction, {
                businessId: dto.businessId,
                description: dto.description,
                currency: dto.currency,
                idempotencyKey: dto.idempotencyKey,
                sourceType: dto.sourceType,
                sourceMessageId: dto.sourceMessageId,
                sourcePayloadHash: dto.sourcePayloadHash,
                occurredAt: dto.occurredAt,
                receivedAt: dto.receivedAt,
                postedAt: new Date(),
                status: 'POSTING',
            });
            const savedTransaction = await queryRunner.manager.save(transaction);
            const entryEntities = dto.entries.map((entryDto) => queryRunner.manager.create(entry_entity_1.Entry, {
                businessId: dto.businessId,
                transactionId: savedTransaction.id,
                accountId: entryDto.accountId,
                amountMinor: entryDto.amountMinor,
                type: entryDto.type,
            }));
            await queryRunner.manager.save(entryEntities);
            await queryRunner.manager.update(transaction_entity_1.Transaction, savedTransaction.id, {
                status: 'POSTED',
            });
            await queryRunner.commitTransaction();
            savedTransaction.status = 'POSTED';
            savedTransaction.entries = entryEntities;
            return savedTransaction;
        }
        catch (err) {
            await safeRollback(queryRunner);
            if (uniqueViolationConstraint(err) === IDEMPOTENCY_CONSTRAINT) {
                const winner = await this.dataSource.manager.findOne(transaction_entity_1.Transaction, {
                    where: {
                        businessId: dto.businessId,
                        idempotencyKey: dto.idempotencyKey,
                    },
                    relations: { entries: true },
                });
                if (winner)
                    return reconcileIdempotentPost(winner, dto);
            }
            throw err;
        }
        finally {
            if (!queryRunner.isReleased)
                await queryRunner.release();
        }
    }
    async reverseTransaction(originalTransactionId, idempotencyKey, reason) {
        if (!idempotencyKey)
            throw new common_1.BadRequestException('Idempotency key is required.');
        if (!reason)
            throw new common_1.BadRequestException('Reversal reason is required.');
        const queryRunner = this.dataSource.createQueryRunner();
        await queryRunner.connect();
        await queryRunner.startTransaction();
        try {
            const originalTx = await queryRunner.manager.findOne(transaction_entity_1.Transaction, {
                where: { id: originalTransactionId },
                relations: { entries: true },
            });
            if (!originalTx) {
                throw new common_1.BadRequestException('Original transaction not found.');
            }
            if (originalTx.reversalOfTransactionId) {
                throw new common_1.ConflictException('A reversal transaction cannot itself be reversed.');
            }
            const existingByKey = await queryRunner.manager.findOne(transaction_entity_1.Transaction, {
                where: { businessId: originalTx.businessId, idempotencyKey },
                relations: { entries: true },
            });
            if (existingByKey) {
                await queryRunner.rollbackTransaction();
                return reconcileIdempotentReversal(existingByKey, originalTx.id);
            }
            const existingReversal = await queryRunner.manager.findOne(transaction_entity_1.Transaction, {
                where: { reversalOfTransactionId: originalTx.id },
            });
            if (existingReversal) {
                throw new common_1.ConflictException('Transaction has already been reversed.');
            }
            if (originalTx.status !== 'POSTED') {
                throw new common_1.ConflictException(`Only POSTED transactions can be reversed (current status: ${originalTx.status}).`);
            }
            const reversalTx = queryRunner.manager.create(transaction_entity_1.Transaction, {
                businessId: originalTx.businessId,
                description: `REVERSAL: ${reason}`,
                currency: originalTx.currency,
                idempotencyKey,
                sourceType: INTERNAL_SOURCE_TYPE,
                occurredAt: new Date(),
                receivedAt: new Date(),
                postedAt: new Date(),
                status: 'POSTING',
                reversalOfTransactionId: originalTx.id,
            });
            const savedReversal = await queryRunner.manager.save(reversalTx);
            const reversalEntries = originalTx.entries.map((entry) => queryRunner.manager.create(entry_entity_1.Entry, {
                businessId: originalTx.businessId,
                transactionId: savedReversal.id,
                accountId: entry.accountId,
                amountMinor: entry.amountMinor,
                type: entry.type === 'DEBIT' ? 'CREDIT' : 'DEBIT',
            }));
            await queryRunner.manager.save(reversalEntries);
            await queryRunner.manager.update(transaction_entity_1.Transaction, savedReversal.id, {
                status: 'POSTED',
            });
            await queryRunner.manager.update(transaction_entity_1.Transaction, originalTx.id, {
                status: 'REVERSED',
            });
            await queryRunner.commitTransaction();
            savedReversal.status = 'POSTED';
            savedReversal.entries = reversalEntries;
            return savedReversal;
        }
        catch (err) {
            await safeRollback(queryRunner);
            const constraint = uniqueViolationConstraint(err);
            if (constraint === IDEMPOTENCY_CONSTRAINT) {
                const original = await this.dataSource.manager.findOne(transaction_entity_1.Transaction, {
                    where: { id: originalTransactionId },
                });
                if (original) {
                    const winner = await this.dataSource.manager.findOne(transaction_entity_1.Transaction, {
                        where: { businessId: original.businessId, idempotencyKey },
                        relations: { entries: true },
                    });
                    if (winner)
                        return reconcileIdempotentReversal(winner, original.id);
                }
            }
            if (constraint === REVERSAL_UNIQUE_INDEX) {
                const existingReversal = await this.dataSource.manager.findOne(transaction_entity_1.Transaction, {
                    where: { reversalOfTransactionId: originalTransactionId },
                    relations: { entries: true },
                });
                if (existingReversal &&
                    existingReversal.idempotencyKey === idempotencyKey &&
                    existingReversal.status === 'POSTED') {
                    return existingReversal;
                }
                throw new common_1.ConflictException('Transaction has already been reversed.');
            }
            throw err;
        }
        finally {
            if (!queryRunner.isReleased)
                await queryRunner.release();
        }
    }
    async assertAccountsBelongToBusiness(manager, businessId, accountIds) {
        const uniqueIds = [...new Set(accountIds)];
        const accounts = await manager.find(account_entity_1.Account, {
            where: { id: (0, typeorm_1.In)(uniqueIds) },
            select: { id: true, businessId: true },
        });
        const found = new Map(accounts.map((a) => [a.id, a.businessId]));
        for (const id of uniqueIds) {
            const owner = found.get(id);
            if (owner === undefined) {
                throw new common_1.BadRequestException(`Account ${id} does not exist.`);
            }
            if (owner !== businessId) {
                throw new common_1.BadRequestException(`Account ${id} does not belong to business ${businessId}.`);
            }
        }
    }
};
exports.LedgerService = LedgerService;
exports.LedgerService = LedgerService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [typeorm_1.DataSource])
], LedgerService);
function reconcileIdempotentPost(existing, dto) {
    if ((existing.sourcePayloadHash ?? null) !== (dto.sourcePayloadHash ?? null)) {
        throw new common_1.ConflictException('Idempotency key already used with a different payload.');
    }
    return existing;
}
function reconcileIdempotentReversal(existing, expectedOriginalId) {
    if (existing.reversalOfTransactionId !== expectedOriginalId) {
        throw new common_1.ConflictException('Idempotency key already used for a different reversal.');
    }
    return existing;
}
function parseAmountMinor(raw) {
    if (typeof raw !== 'string' || !/^\d+$/.test(raw)) {
        throw new common_1.BadRequestException(`Invalid amount "${raw}": must be a base-10 integer string of minor units.`);
    }
    const amount = BigInt(raw);
    if (amount <= 0n) {
        throw new common_1.BadRequestException('All entry amounts must be strictly positive.');
    }
    if (amount > INT64_MAX) {
        throw new common_1.BadRequestException('Amount exceeds the maximum supported value.');
    }
    return amount;
}
async function safeRollback(queryRunner) {
    if (queryRunner.isTransactionActive) {
        try {
            await queryRunner.rollbackTransaction();
        }
        catch {
        }
    }
}
function uniqueViolationConstraint(err) {
    const driverError = err instanceof typeorm_1.QueryFailedError
        ? err.driverError
        : err;
    if (driverError?.code !== '23505')
        return undefined;
    return driverError.constraint;
}
//# sourceMappingURL=ledger.service.js.map