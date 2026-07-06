import { Injectable } from '@nestjs/common';
import { DataSource, In } from 'typeorm';
import { LedgerService } from '../ledger/ledger.service';
import { Account } from '../ledger/entities/account.entity';

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

@Injectable()
export class ParsingService {
  constructor(
    private dataSource: DataSource,
    private ledger: LedgerService,
  ) {}

  async parseAndPost(input: ParseAndPostInput): Promise<ParseAndPostResult> {
    const parsed = parseTransactionText(input.textBody, input.messageType);
    if (!parsed) return { status: 'UNRECOGNIZED' };

    const accounts = await this.loadSeedAccounts(input.businessId);
    const amountMinor = parsed.amountMinor;
    const entries =
      parsed.kind === 'SALE'
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

  private async loadSeedAccounts(businessId: string): Promise<{
    cash: Account;
    sales: Account;
    expenses: Account;
  }> {
    const accounts = await this.dataSource.manager.find(Account, {
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

function classifyKind(normalized: string): ParsedTransactionKind | null {
  if (/\b(sold|sale|sales|received|income|earned)\b/.test(normalized)) {
    return 'SALE';
  }
  if (/\b(spent|paid|bought|buy|expense|expenses)\b/.test(normalized)) {
    return 'EXPENSE';
  }
  return null;
}

function extractAmountMinor(normalized: string): string | null {
  const match =
    /\b(?:r|zar)\s*([0-9][0-9,]*(?:\.[0-9]{1,2})?)\b/.exec(normalized) ??
    /\b([0-9][0-9,]*(?:\.[0-9]{1,2})?)\s*(?:rand|rands|zar)\b/.exec(normalized);
  if (!match) return null;

  const raw = match[1].replace(/,/g, '');
  const [major, minor = ''] = raw.split('.');
  const cents = (minor + '00').slice(0, 2);
  const amount = BigInt(major) * 100n + BigInt(cents);
  return amount > 0n ? amount.toString() : null;
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
