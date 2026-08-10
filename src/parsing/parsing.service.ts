import { Injectable } from '@nestjs/common';
import { DataSource, EntityManager, In } from 'typeorm';
import { LedgerService } from '../ledger/ledger.service';
import { Account } from '../ledger/entities/account.entity';
import { TransactionProposal } from './entities/transaction-proposal.entity';

export interface ParseAndPostInput {
  businessId: string;
  waMessageId: string;
  payloadHash: string;
  textBody?: string | null;
  messageType: string;
  waTimestamp: Date;
  receivedAt: Date;
}

export type ParseAndPostResult =
  | { status: 'UNRECOGNIZED' }
  | { status: 'NO_PENDING_CONFIRMATION' }
  | {
      status: 'PROPOSED';
      kind: ParsedTransactionKind;
      amountMinor: string;
      proposalId: string;
      proposalRef: string;
    }
  | {
      status: 'CANCELLED';
      kind: ParsedTransactionKind;
      amountMinor: string;
      proposalId: string;
    }
  | {
      status: 'POSTED';
      kind: ParsedTransactionKind;
      amountMinor: string;
      transactionId: string;
    };

export type ParsedTransactionKind = 'SALE' | 'EXPENSE';

interface ParsedTransaction {
  kind: ParsedTransactionKind;
  amountMinor: string;
  description: string;
}

const CASH_CODE = '100';
const SALES_CODE = '400';
const EXPENSES_CODE = '500';
const DEFAULT_CURRENCY = 'ZAR';
const INT64_MAX = 9223372036854775807n;
const MONEY_AMOUNT_SOURCE =
  '(?:[0-9]{1,3}(?:,[0-9]{3}){1,5}|[0-9]{1,17})(?:\\.[0-9]{1,2})?';
const PREFIX_AMOUNT_PATTERN = new RegExp(
  `\\b(?:r|zar)\\s*(${MONEY_AMOUNT_SOURCE})(?![\\d,])`,
);
const SUFFIX_AMOUNT_PATTERN = new RegExp(
  `\\b(${MONEY_AMOUNT_SOURCE})(?![\\d,])\\s*(?:rand|rands|zar)\\b`,
);

@Injectable()
export class ParsingService {
  constructor(
    private dataSource: DataSource,
    private ledger: LedgerService,
  ) {}

  async parseAndPost(input: ParseAndPostInput): Promise<ParseAndPostResult> {
    return this.withProposalLock(input.businessId, async (manager) => {
      if (isCancelText(input.textBody, input.messageType)) {
        return this.cancelPendingProposal(manager, input.businessId);
      }
      if (isConfirmText(input.textBody, input.messageType)) {
        return this.confirmPendingProposal(manager, input);
      }

      const parsed = parseTransactionText(input.textBody, input.messageType);
      if (!parsed) return { status: 'UNRECOGNIZED' };

      const existing = await manager.findOne(TransactionProposal, {
        where: {
          businessId: input.businessId,
          sourceWaMessageId: input.waMessageId,
        },
      });
      if (existing) return proposalResult(existing);

      await manager.update(
        TransactionProposal,
        { businessId: input.businessId, status: 'PENDING' },
        { status: 'CANCELLED' },
      );

      const savedProposal = await manager.save(
        manager.create(TransactionProposal, {
          businessId: input.businessId,
          sourceWaMessageId: input.waMessageId,
          sourcePayloadHash: input.payloadHash,
          kind: parsed.kind,
          amountMinor: parsed.amountMinor,
          currency: DEFAULT_CURRENCY,
          description: parsed.description,
          waTimestamp: input.waTimestamp,
          receivedAt: input.receivedAt,
          status: 'PENDING',
        }),
      );
      const proposal = await manager.findOne(TransactionProposal, {
        where: { id: savedProposal.id, businessId: input.businessId },
      });
      if (!proposal) {
        throw new Error('Stored proposal could not be reloaded');
      }

      return {
        status: 'PROPOSED',
        kind: parsed.kind,
        amountMinor: parsed.amountMinor,
        proposalId: proposal.id,
        proposalRef: proposalReference(proposal),
      };
    });
  }

  private async confirmPendingProposal(
    manager: EntityManager,
    input: ParseAndPostInput,
  ): Promise<ParseAndPostResult> {
    const alreadyConfirmed = await manager.findOne(TransactionProposal, {
      where: {
        businessId: input.businessId,
        confirmedByWaMessageId: input.waMessageId,
      },
    });
    if (alreadyConfirmed) return proposalResult(alreadyConfirmed);

    const proposal = await manager.findOne(TransactionProposal, {
      where: { businessId: input.businessId, status: 'PENDING' },
      order: { createdAt: 'DESC' },
      lock: { mode: 'pessimistic_write' },
    });
    if (!proposal) return { status: 'NO_PENDING_CONFIRMATION' };

    const kind = parseProposalKind(proposal.kind);
    assertProposalDigest(proposal);
    const accounts = await this.loadSeedAccounts(manager, input.businessId);
    const amountMinor = String(proposal.amountMinor);
    const transaction = await this.ledger.postTransactionWithManager(manager, {
      businessId: input.businessId,
      description: proposal.description,
      currency: proposal.currency,
      idempotencyKey: `proposal:${proposal.id}`,
      sourceType: 'WHATSAPP',
      sourceMessageId: proposal.sourceWaMessageId,
      sourcePayloadHash: proposal.sourcePayloadHash,
      occurredAt: proposal.waTimestamp,
      receivedAt: proposal.receivedAt,
      entries: buildEntries(kind, accounts, {
        amountMinor,
      }),
    });

    const updated = await manager.update(
      TransactionProposal,
      { id: proposal.id, status: 'PENDING' },
      {
        status: 'CONFIRMED',
        confirmedByWaMessageId: input.waMessageId,
        transactionId: transaction.id,
      },
    );
    if (updated.affected !== 1) {
      throw new Error('Proposal state changed before confirmation');
    }

    return {
      status: 'POSTED',
      kind,
      amountMinor,
      transactionId: transaction.id,
    };
  }

  private async cancelPendingProposal(
    manager: EntityManager,
    businessId: string,
  ): Promise<ParseAndPostResult> {
    const proposal = await manager.findOne(TransactionProposal, {
      where: { businessId, status: 'PENDING' },
      order: { createdAt: 'DESC' },
    });
    if (!proposal) return { status: 'NO_PENDING_CONFIRMATION' };

    const kind = parseProposalKind(proposal.kind);
    assertProposalDigest(proposal);
    const updated = await manager.update(
      TransactionProposal,
      { id: proposal.id, status: 'PENDING' },
      { status: 'CANCELLED' },
    );
    if (updated.affected !== 1) {
      throw new Error('Proposal state changed before cancellation');
    }
    return {
      status: 'CANCELLED',
      kind,
      amountMinor: String(proposal.amountMinor),
      proposalId: proposal.id,
    };
  }

  private async loadSeedAccounts(
    manager: EntityManager,
    businessId: string,
  ): Promise<{
    cash: Account;
    sales: Account;
    expenses: Account;
  }> {
    const accounts = await manager.find(Account, {
      where: { businessId, code: In([CASH_CODE, SALES_CODE, EXPENSES_CODE]) },
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

  private async withProposalLock<T>(
    businessId: string,
    callback: (manager: EntityManager) => Promise<T>,
  ): Promise<T> {
    if (typeof this.dataSource.createQueryRunner !== 'function') {
      return callback(this.dataSource.manager);
    }

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();
    try {
      await queryRunner.query(
        `SELECT pg_advisory_xact_lock(hashtextextended($1, 0))`,
        [`proposal:${businessId}`],
      );
      const result = await callback(queryRunner.manager);
      await queryRunner.commitTransaction();
      return result;
    } catch (error) {
      if (queryRunner.isTransactionActive) {
        await queryRunner.rollbackTransaction();
      }
      throw error;
    } finally {
      if (!queryRunner.isReleased) await queryRunner.release();
    }
  }
}

function buildEntries(
  kind: ParsedTransactionKind,
  accounts: { cash: Account; sales: Account; expenses: Account },
  parsed: Pick<ParsedTransaction, 'amountMinor'>,
) {
  const amountMinor = parsed.amountMinor;
  return kind === 'SALE'
    ? [
        {
          accountId: accounts.cash.id,
          amountMinor,
          type: 'DEBIT' as const,
        },
        {
          accountId: accounts.sales.id,
          amountMinor,
          type: 'CREDIT' as const,
        },
      ]
    : [
        {
          accountId: accounts.expenses.id,
          amountMinor,
          type: 'DEBIT' as const,
        },
        {
          accountId: accounts.cash.id,
          amountMinor,
          type: 'CREDIT' as const,
        },
      ];
}

function proposalResult(proposal: TransactionProposal): ParseAndPostResult {
  const kind = parseProposalKind(proposal.kind);
  assertProposalDigest(proposal);
  if (proposal.status === 'CONFIRMED' && proposal.transactionId) {
    return {
      status: 'POSTED',
      kind,
      amountMinor: String(proposal.amountMinor),
      transactionId: proposal.transactionId,
    };
  }
  if (proposal.status === 'CANCELLED') {
    return {
      status: 'CANCELLED',
      kind,
      amountMinor: String(proposal.amountMinor),
      proposalId: proposal.id,
    };
  }
  return {
    status: 'PROPOSED',
    kind,
    amountMinor: String(proposal.amountMinor),
    proposalId: proposal.id,
    proposalRef: proposalReference(proposal),
  };
}

function parseProposalKind(value: string): ParsedTransactionKind {
  if (value === 'SALE' || value === 'EXPENSE') return value;
  throw new Error('Stored proposal has an unsupported transaction kind');
}

function assertProposalDigest(proposal: TransactionProposal): void {
  if (!/^[0-9a-f]{64}$/.test(proposal.proposalDigest ?? '')) {
    throw new Error('Stored proposal is missing its immutable digest');
  }
}

function proposalReference(proposal: TransactionProposal): string {
  assertProposalDigest(proposal);
  return proposal.proposalDigest.slice(0, 12).toUpperCase();
}

export function parseTransactionText(
  textBody?: string | null,
  messageType = 'text',
): ParsedTransaction | null {
  if (messageType !== 'text' || !textBody) return null;
  const normalized = normalizeText(textBody);
  const amountMinor = extractAmountMinor(normalized);
  if (!amountMinor) return null;

  const kind = classifyKind(normalized);
  if (!kind) return null;

  return {
    kind,
    amountMinor,
    description: buildDescription(kind, textBody),
  };
}

function normalizeText(raw: string): string {
  return raw
    .toLowerCase()
    .replace(/[^\p{L}\p{N}.,\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function isConfirmText(
  textBody?: string | null,
  messageType = 'text',
): boolean {
  if (messageType !== 'text' || !textBody) return false;
  return /^(yes|y|confirm|confirmed|ok|okay|record it|post it)$/i.test(
    textBody.trim(),
  );
}

function isCancelText(textBody?: string | null, messageType = 'text'): boolean {
  if (messageType !== 'text' || !textBody) return false;
  return /^(no|n|cancel|stop|discard|don't record|do not record)$/i.test(
    textBody.trim(),
  );
}

function classifyKind(normalized: string): ParsedTransactionKind | null {
  const paidToMe = /\bpaid\s+me\b|\b(customer|client)\s+paid\b/.test(
    normalized,
  );
  const sale =
    paidToMe || /\b(sold|sale|sales|received|income|earned)\b/.test(normalized);
  const expense =
    /\b(spent|bought|buy|expense|expenses)\b/.test(normalized) ||
    (/\bpaid\b/.test(normalized) && !paidToMe);

  if (sale === expense) return null;
  return sale ? 'SALE' : 'EXPENSE';
}

function extractAmountMinor(normalized: string): string | null {
  const match =
    PREFIX_AMOUNT_PATTERN.exec(normalized) ??
    SUFFIX_AMOUNT_PATTERN.exec(normalized);
  if (!match) return null;

  const raw = match[1].replace(/,/g, '');
  const [major, minor = ''] = raw.split('.');
  const cents = (minor + '00').slice(0, 2);
  const amount = BigInt(major) * 100n + BigInt(cents);
  return amount > 0n && amount <= INT64_MAX ? amount.toString() : null;
}

function buildDescription(kind: ParsedTransactionKind, raw: string): string {
  const cleaned = raw
    // eslint-disable-next-line no-control-regex
    .replace(/[\u0000-\u001f\u007f]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  const fallback = kind === 'SALE' ? 'WhatsApp sale' : 'WhatsApp expense';
  return (cleaned || fallback).slice(0, 160);
}
