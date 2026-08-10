import {
  Injectable,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { DataSource, EntityManager, In, QueryFailedError } from 'typeorm';
import { Transaction } from './entities/transaction.entity';
import { Entry } from './entities/entry.entity';
import { Account } from './entities/account.entity';
import { isSupportedCurrency } from '../money/currency';

export interface CreateTransactionDto {
  businessId: string;
  description: string;
  currency: string;
  idempotencyKey: string;
  sourceType: string;
  sourceMessageId?: string;
  // Canonical hash of the originating payload. REQUIRED for externally sourced
  // transactions (sourceType !== 'SYSTEM'); see DECISIONS.md ADR 4.
  sourcePayloadHash?: string;
  occurredAt: Date;
  receivedAt: Date;
  entries: {
    accountId: string;
    amountMinor: string; // BigInt string representation of the minor unit (e.g. cents)
    type: 'DEBIT' | 'CREDIT';
  }[];
}

// Constraint / index names — must match the migrations exactly.
const IDEMPOTENCY_CONSTRAINT = 'UQ_transactions_business_idempotency';
const REVERSAL_UNIQUE_INDEX = 'UQ_transactions_one_reversal_per_original';

// Internally generated source (e.g. reversals); exempt from the payload-hash rule.
const INTERNAL_SOURCE_TYPE = 'SYSTEM';
const EXTERNAL_SOURCE_TYPES = new Set(['WHATSAPP', 'API', 'WEB']);
const SHA256_HEX_PATTERN = /^[0-9a-f]{64}$/;

// PostgreSQL signed bigint upper bound. amount_minor is stored as bigint.
const INT64_MAX = 9223372036854775807n;

interface NormalizedCreateTransaction {
  currency: string;
  sourceType: string;
  sourceMessageId?: string;
}

@Injectable()
export class LedgerService {
  constructor(private dataSource: DataSource) {}

  async postTransaction(dto: CreateTransactionDto): Promise<Transaction> {
    const normalized = validateCreateTransaction(dto);

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const savedTransaction = await this.postValidatedTransaction(
        queryRunner.manager,
        dto,
        normalized,
      );
      await queryRunner.commitTransaction();
      return savedTransaction;
    } catch (err) {
      await safeRollback(queryRunner);

      // Concurrency backstop: a racing request won the unique constraint.
      if (uniqueViolationConstraint(err) === IDEMPOTENCY_CONSTRAINT) {
        const winner = await this.dataSource.manager.findOne(Transaction, {
          where: {
            businessId: dto.businessId,
            idempotencyKey: dto.idempotencyKey,
          },
          relations: { entries: true },
        });
        if (winner) return reconcileIdempotentPost(winner, dto);
      }
      throw err;
    } finally {
      if (!queryRunner.isReleased) await queryRunner.release();
    }
  }

  /**
   * Posts with the caller's transaction. This is intentionally used by the
   * confirmation flow so the ledger row and proposal transition have one
   * atomic commit boundary.
   */
  async postTransactionWithManager(
    manager: EntityManager,
    dto: CreateTransactionDto,
  ): Promise<Transaction> {
    if (!manager.queryRunner?.isTransactionActive) {
      throw new Error(
        'Caller-managed ledger posting requires an active database transaction',
      );
    }
    return this.postValidatedTransaction(
      manager,
      dto,
      validateCreateTransaction(dto),
    );
  }

  private async postValidatedTransaction(
    manager: EntityManager,
    dto: CreateTransactionDto,
    normalized: NormalizedCreateTransaction,
  ): Promise<Transaction> {
    // Referential integrity + tenant isolation: every account must exist and
    // belong to this business before any transaction row is created.
    await this.assertAccountsBelongToBusiness(
      manager,
      dto.businessId,
      dto.entries.map((entry) => entry.accountId),
    );

    const existing = await manager.findOne(Transaction, {
      where: {
        businessId: dto.businessId,
        idempotencyKey: dto.idempotencyKey,
      },
      relations: { entries: true },
    });
    if (existing) return reconcileIdempotentPost(existing, dto);

    const transaction = manager.create(Transaction, {
      businessId: dto.businessId,
      description: dto.description,
      currency: normalized.currency,
      idempotencyKey: dto.idempotencyKey,
      sourceType: normalized.sourceType,
      sourceMessageId: normalized.sourceMessageId,
      sourcePayloadHash: dto.sourcePayloadHash,
      occurredAt: dto.occurredAt,
      receivedAt: dto.receivedAt,
      postedAt: new Date(),
      status: 'POSTING',
    });
    const savedTransaction = await manager.save(transaction);
    const entryEntities = dto.entries.map((entryDto) =>
      manager.create(Entry, {
        businessId: dto.businessId,
        transactionId: savedTransaction.id,
        accountId: entryDto.accountId,
        amountMinor: entryDto.amountMinor,
        type: entryDto.type,
      }),
    );
    await manager.save(entryEntities);
    await manager.update(Transaction, savedTransaction.id, {
      status: 'POSTED',
    });

    savedTransaction.status = 'POSTED';
    savedTransaction.entries = entryEntities;
    return savedTransaction;
  }

  async reverseTransaction(
    businessId: string,
    originalTransactionId: string,
    idempotencyKey: string,
    reason: string,
  ): Promise<Transaction> {
    if (!idempotencyKey)
      throw new BadRequestException('Idempotency key is required.');
    if (!reason) throw new BadRequestException('Reversal reason is required.');

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const originalTx = await queryRunner.manager.findOne(Transaction, {
        where: { id: originalTransactionId, businessId },
        relations: { entries: true },
      });

      if (!originalTx) {
        throw new BadRequestException('Original transaction not found.');
      }
      if (originalTx.reversalOfTransactionId) {
        throw new ConflictException(
          'A reversal transaction cannot itself be reversed.',
        );
      }

      // Retry-safe idempotency: a repeated reversal request returns the existing
      // reversal, but only if it is the reversal of THIS original transaction.
      const existingByKey = await queryRunner.manager.findOne(Transaction, {
        where: { businessId: originalTx.businessId, idempotencyKey },
        relations: { entries: true },
      });
      if (existingByKey) {
        await queryRunner.rollbackTransaction();
        return reconcileIdempotentReversal(existingByKey, originalTx.id);
      }

      // Double-reversal guard (different key trying to reverse again).
      const existingReversal = await queryRunner.manager.findOne(Transaction, {
        where: { reversalOfTransactionId: originalTx.id },
      });
      if (existingReversal) {
        throw new ConflictException('Transaction has already been reversed.');
      }

      // At this point the request is neither an idempotent retry nor a
      // double-reversal, so a non-POSTED original is genuinely unreversable
      // (e.g. still POSTING). Checked here — after idempotency — so a retried
      // reversal of an already-REVERSED original returns its existing reversal
      // above rather than failing this guard.
      if (originalTx.status !== 'POSTED') {
        throw new ConflictException(
          `Only POSTED transactions can be reversed (current status: ${originalTx.status}).`,
        );
      }

      const reversalTx = queryRunner.manager.create(Transaction, {
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

      const reversalEntries = originalTx.entries.map((entry) =>
        queryRunner.manager.create(Entry, {
          businessId: originalTx.businessId,
          transactionId: savedReversal.id,
          accountId: entry.accountId,
          amountMinor: entry.amountMinor,
          type: entry.type === 'DEBIT' ? 'CREDIT' : 'DEBIT',
        }),
      );

      await queryRunner.manager.save(reversalEntries);

      // Seal the reversal, then mark the original. The DB requires this reversal
      // row to exist before it will accept the POSTED -> REVERSED transition.
      await queryRunner.manager.update(Transaction, savedReversal.id, {
        status: 'POSTED',
      });

      // Lifecycle transition POSTED -> REVERSED. Economic fields stay immutable;
      // the DB trigger permits only this transition. See DECISIONS.md ADR 5.
      await queryRunner.manager.update(Transaction, originalTx.id, {
        status: 'REVERSED',
      });

      await queryRunner.commitTransaction();

      savedReversal.status = 'POSTED';
      savedReversal.entries = reversalEntries;
      return savedReversal;
    } catch (err) {
      await safeRollback(queryRunner);

      const constraint = uniqueViolationConstraint(err);
      if (constraint === IDEMPOTENCY_CONSTRAINT) {
        const original = await this.dataSource.manager.findOne(Transaction, {
          where: { id: originalTransactionId, businessId },
        });
        if (original) {
          const winner = await this.dataSource.manager.findOne(Transaction, {
            where: { businessId: original.businessId, idempotencyKey },
            relations: { entries: true },
          });
          if (winner) return reconcileIdempotentReversal(winner, original.id);
        }
      }
      if (constraint === REVERSAL_UNIQUE_INDEX) {
        // A racing reversal won the one-reversal-per-original rule. If it is the
        // same idempotent request (same key), return it; otherwise it is a
        // genuine double-reversal attempt.
        const existingReversal = await this.dataSource.manager.findOne(
          Transaction,
          {
            where: {
              businessId,
              reversalOfTransactionId: originalTransactionId,
            },
            relations: { entries: true },
          },
        );
        if (
          existingReversal &&
          existingReversal.idempotencyKey === idempotencyKey &&
          existingReversal.status === 'POSTED'
        ) {
          return existingReversal;
        }
        throw new ConflictException('Transaction has already been reversed.');
      }
      throw err;
    } finally {
      if (!queryRunner.isReleased) await queryRunner.release();
    }
  }

  private async assertAccountsBelongToBusiness(
    manager: EntityManager,
    businessId: string,
    accountIds: string[],
  ): Promise<void> {
    const uniqueIds = [...new Set(accountIds)];
    const accounts = await manager.find(Account, {
      where: { id: In(uniqueIds) },
      select: { id: true, businessId: true },
    });

    const found = new Map(accounts.map((a) => [a.id, a.businessId]));
    for (const id of uniqueIds) {
      const owner = found.get(id);
      if (owner === undefined) {
        throw new BadRequestException(`Account ${id} does not exist.`);
      }
      if (owner !== businessId) {
        throw new BadRequestException(
          `Account ${id} does not belong to business ${businessId}.`,
        );
      }
    }
  }
}

function validateCreateTransaction(
  dto: CreateTransactionDto,
): NormalizedCreateTransaction {
  if (!dto.idempotencyKey) {
    throw new BadRequestException('Idempotency key is required.');
  }
  const currency = normalizeLedgerCurrency(dto.currency);
  const sourceType = normalizeSourceType(dto.sourceType);
  const sourceMessageId = normalizeSourceMessageId(dto.sourceMessageId);
  if (sourceType === INTERNAL_SOURCE_TYPE && dto.sourcePayloadHash) {
    throw new BadRequestException(
      'SYSTEM transactions cannot carry an external payload hash.',
    );
  }
  if (
    sourceType !== INTERNAL_SOURCE_TYPE &&
    !SHA256_HEX_PATTERN.test(dto.sourcePayloadHash ?? '')
  ) {
    throw new BadRequestException(
      'External source payload hash must be a lowercase SHA-256 hex digest.',
    );
  }
  if (sourceType === 'WHATSAPP' && !sourceMessageId) {
    throw new BadRequestException(
      'WhatsApp transactions require a source message id.',
    );
  }
  if (!dto.entries || dto.entries.length < 2) {
    throw new BadRequestException(
      'A transaction must have at least two entries.',
    );
  }

  let totalDebits = 0n;
  let totalCredits = 0n;
  for (const entry of dto.entries) {
    if (!entry.accountId) {
      throw new BadRequestException('Every entry must reference an account.');
    }
    if (entry.type !== 'DEBIT' && entry.type !== 'CREDIT') {
      throw new BadRequestException(
        'Entry must have explicit DEBIT or CREDIT side.',
      );
    }
    const amount = parseAmountMinor(entry.amountMinor);
    if (entry.type === 'DEBIT') totalDebits += amount;
    else totalCredits += amount;
  }
  if (totalDebits !== totalCredits) {
    throw new BadRequestException(
      `Double-entry violation: Debits (${totalDebits.toString()}) do not equal Credits (${totalCredits.toString()}).`,
    );
  }
  return { currency, sourceType, sourceMessageId };
}

/**
 * A duplicate (businessId, idempotencyKey) is only truly idempotent if the
 * payload matches. Same key + same hash -> return existing; different hash ->
 * Conflict, so upstream payload-drift bugs surface instead of being masked.
 */
function reconcileIdempotentPost(
  existing: Transaction,
  dto: CreateTransactionDto,
): Transaction {
  if (
    (existing.sourcePayloadHash ?? null) !== (dto.sourcePayloadHash ?? null)
  ) {
    throw new ConflictException(
      'Idempotency key already used with a different payload.',
    );
  }
  return existing;
}

/**
 * A reversal idempotency key is only reusable for the SAME original transaction.
 * Reusing it against a different original is a Conflict.
 */
function reconcileIdempotentReversal(
  existing: Transaction,
  expectedOriginalId: string,
): Transaction {
  if (existing.reversalOfTransactionId !== expectedOriginalId) {
    throw new ConflictException(
      'Idempotency key already used for a different reversal.',
    );
  }
  return existing;
}

/**
 * Parses a minor-unit amount string into a strictly-positive BigInt that fits
 * in a PostgreSQL bigint. Rejects non-integers, signs, decimals and overflow
 * with a BadRequestException instead of leaking a raw SyntaxError.
 */
function parseAmountMinor(raw: string): bigint {
  if (typeof raw !== 'string' || !/^\d+$/.test(raw)) {
    throw new BadRequestException(
      `Invalid amount "${raw}": must be a base-10 integer string of minor units.`,
    );
  }
  const amount = BigInt(raw);
  if (amount <= 0n) {
    throw new BadRequestException(
      'All entry amounts must be strictly positive.',
    );
  }
  if (amount > INT64_MAX) {
    throw new BadRequestException(
      'Amount exceeds the maximum supported value.',
    );
  }
  return amount;
}

function normalizeLedgerCurrency(raw: string): string {
  if (typeof raw !== 'string') {
    throw new BadRequestException('Currency is required.');
  }
  const currency = raw.trim().toUpperCase();
  if (!isSupportedCurrency(currency)) {
    throw new BadRequestException(
      'Currency must be one of ZAR, USD, JPY, or BHD.',
    );
  }
  return currency;
}

function normalizeSourceType(raw: string): string {
  if (typeof raw !== 'string') {
    throw new BadRequestException('Source reference is required.');
  }
  const sourceType = raw.trim().toUpperCase();
  if (
    sourceType !== INTERNAL_SOURCE_TYPE &&
    !EXTERNAL_SOURCE_TYPES.has(sourceType)
  ) {
    throw new BadRequestException(
      'Source type must be SYSTEM, WHATSAPP, API, or WEB.',
    );
  }
  return sourceType;
}

function normalizeSourceMessageId(raw?: string): string | undefined {
  if (raw === undefined) return undefined;
  if (typeof raw !== 'string') {
    throw new BadRequestException('Source message id must be a string.');
  }
  const value = raw.trim();
  if (!value || value.length > 512) {
    throw new BadRequestException(
      'Source message id must contain 1 to 512 characters.',
    );
  }
  return value;
}

async function safeRollback(queryRunner: {
  isTransactionActive: boolean;
  rollbackTransaction: () => Promise<void>;
}): Promise<void> {
  if (queryRunner.isTransactionActive) {
    try {
      await queryRunner.rollbackTransaction();
    } catch {
      // Transaction already resolved (e.g. failure occurred during commit).
    }
  }
}

/**
 * If `err` is a PostgreSQL unique-violation (23505), returns the offending
 * constraint/index name; otherwise undefined. Reads through TypeORM's
 * QueryFailedError wrapper to the underlying pg driver error.
 */
function uniqueViolationConstraint(err: unknown): string | undefined {
  const driverError =
    err instanceof QueryFailedError
      ? (err.driverError as { code?: string; constraint?: string })
      : (err as { code?: string; constraint?: string });
  if (driverError?.code !== '23505') return undefined;
  return driverError.constraint;
}
