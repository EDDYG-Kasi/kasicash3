/* eslint-disable @typescript-eslint/no-unsafe-member-access */
import { ParsingService, parseTransactionText } from './parsing.service';
import { LedgerService } from '../ledger/ledger.service';
import type { DataSource } from 'typeorm';

describe('parseTransactionText', () => {
  it('parses simple sales with Rand amounts', () => {
    expect(parseTransactionText('sold 3 chips R30')).toEqual({
      kind: 'SALE',
      amountMinor: '3000',
      description: 'sold 3 chips R30',
    });
  });

  it('parses simple expenses with decimal amounts', () => {
    expect(parseTransactionText('bought stock for R12.50')).toEqual({
      kind: 'EXPENSE',
      amountMinor: '1250',
      description: 'bought stock for R12.50',
    });
  });

  it('parses grouped Rand amounts and customer-paid sale language', () => {
    expect(parseTransactionText('customer paid me R1,250.75')).toEqual({
      kind: 'SALE',
      amountMinor: '125075',
      description: 'customer paid me R1,250.75',
    });
  });

  it('keeps ambiguous transaction language out of the ledger', () => {
    expect(parseTransactionText('received and spent R30')).toBeNull();
  });

  it('rejects malformed comma amounts instead of partially parsing them', () => {
    expect(parseTransactionText('sold stock R12,34')).toBeNull();
  });

  it('does not parse unsupported text or non-text messages', () => {
    expect(parseTransactionText('hello there')).toBeNull();
    expect(parseTransactionText('sold R30', 'image')).toBeNull();
  });
});

describe('ParsingService', () => {
  const makeService = () => {
    const accounts = [
      { id: 'cash', businessId: 'b-1', code: '100' },
      { id: 'sales', businessId: 'b-1', code: '400' },
      { id: 'expenses', businessId: 'b-1', code: '500' },
    ];
    const manager = { find: jest.fn().mockResolvedValue(accounts) };
    const ledger = {
      postTransaction: jest.fn().mockResolvedValue({ id: 'tx-1' }),
    } as unknown as LedgerService;
    const service = new ParsingService(
      { manager } as unknown as DataSource,
      ledger,
    );
    return { service, manager, ledger };
  };

  const baseInput = {
    businessId: 'b-1',
    waMessageId: 'wamid.1',
    payloadHash: 'hash-1',
    messageType: 'text',
    waTimestamp: new Date('2026-01-01T10:00:00Z'),
    receivedAt: new Date('2026-01-01T10:00:05Z'),
  };

  it('posts a parsed sale through the ledger with source traceability', async () => {
    const { service, ledger } = makeService();
    const result = await service.parseAndPost({
      ...baseInput,
      textBody: 'sold airtime R30',
    });

    expect(result).toEqual({
      status: 'POSTED',
      kind: 'SALE',
      amountMinor: '3000',
      transactionId: 'tx-1',
    });
    expect((ledger as any).postTransaction).toHaveBeenCalledWith(
      expect.objectContaining({
        businessId: 'b-1',
        idempotencyKey: 'wa:wamid.1',
        sourceType: 'WHATSAPP',
        sourceMessageId: 'wamid.1',
        sourcePayloadHash: 'hash-1',
        entries: [
          { accountId: 'cash', amountMinor: '3000', type: 'DEBIT' },
          { accountId: 'sales', amountMinor: '3000', type: 'CREDIT' },
        ],
      }),
    );
  });

  it('posts a parsed expense through the ledger', async () => {
    const { service, ledger } = makeService();
    await service.parseAndPost({
      ...baseInput,
      textBody: 'spent R20 on stock',
    });

    expect((ledger as any).postTransaction).toHaveBeenCalledWith(
      expect.objectContaining({
        entries: [
          { accountId: 'expenses', amountMinor: '2000', type: 'DEBIT' },
          { accountId: 'cash', amountMinor: '2000', type: 'CREDIT' },
        ],
      }),
    );
  });

  it('does not post unrecognized text', async () => {
    const { service, ledger } = makeService();
    const result = await service.parseAndPost({
      ...baseInput,
      textBody: 'please help me',
    });

    expect(result).toEqual({ status: 'UNRECOGNIZED' });
    expect((ledger as any).postTransaction).not.toHaveBeenCalled();
  });
});
