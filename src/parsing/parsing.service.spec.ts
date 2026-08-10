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

  it('rejects values outside the PostgreSQL bigint range', () => {
    expect(parseTransactionText('sold stock R99999999999999999.99')).toBeNull();
  });
});

describe('ParsingService', () => {
  const makeService = () => {
    const accounts = [
      { id: 'cash', businessId: 'b-1', code: '100' },
      { id: 'sales', businessId: 'b-1', code: '400' },
      { id: 'expenses', businessId: 'b-1', code: '500' },
    ];
    let savedProposal: Record<string, unknown> | null = null;
    const manager = {
      queryRunner: { isTransactionActive: true },
      create: jest.fn().mockImplementation((_E: unknown, d: unknown) => d),
      find: jest.fn().mockResolvedValue(accounts),
      findOne: jest
        .fn()
        .mockImplementation(
          (_entity: unknown, options?: { where?: { id?: string } }) =>
            options?.where?.id
              ? Promise.resolve(savedProposal)
              : Promise.resolve(null),
        ),
      save: jest.fn().mockImplementation((d: Record<string, unknown>) => {
        savedProposal = {
          ...d,
          id: 'proposal-1',
          proposalDigest: 'a'.repeat(64),
        };
        return savedProposal;
      }),
      update: jest.fn().mockResolvedValue({ affected: 1 }),
    };
    const ledger = {
      postTransaction: jest.fn(),
      postTransactionWithManager: jest.fn().mockResolvedValue({ id: 'tx-1' }),
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
    payloadHash: 'a'.repeat(64),
    messageType: 'text',
    waTimestamp: new Date('2026-01-01T10:00:00Z'),
    receivedAt: new Date('2026-01-01T10:00:05Z'),
  };

  it('proposes a parsed sale without writing the ledger', async () => {
    const { service, manager, ledger } = makeService();
    const result = await service.parseAndPost({
      ...baseInput,
      textBody: 'sold airtime R30',
    });

    expect(result).toEqual({
      status: 'PROPOSED',
      kind: 'SALE',
      amountMinor: '3000',
      proposalId: 'proposal-1',
      proposalRef: 'AAAAAAAAAAAA',
    });
    expect(manager.save).toHaveBeenCalledWith(
      expect.objectContaining({
        businessId: 'b-1',
        sourceWaMessageId: 'wamid.1',
        sourcePayloadHash: 'a'.repeat(64),
        amountMinor: '3000',
        status: 'PENDING',
      }),
    );
    expect((ledger as any).postTransaction).not.toHaveBeenCalled();
  });

  it('proposes a parsed expense without writing the ledger', async () => {
    const { service, ledger } = makeService();
    const result = await service.parseAndPost({
      ...baseInput,
      textBody: 'spent R20 on stock',
    });

    expect(result).toMatchObject({
      status: 'PROPOSED',
      kind: 'EXPENSE',
      amountMinor: '2000',
    });
    expect((ledger as any).postTransaction).not.toHaveBeenCalled();
  });

  it('posts only after an explicit confirmation for the same business', async () => {
    const { service, manager, ledger } = makeService();
    manager.findOne.mockResolvedValueOnce(null).mockResolvedValueOnce({
      id: 'proposal-1',
      businessId: 'b-1',
      sourceWaMessageId: 'wamid.original',
      sourcePayloadHash: 'a'.repeat(64),
      kind: 'SALE',
      amountMinor: '3000',
      currency: 'ZAR',
      description: 'sold airtime R30',
      waTimestamp: new Date('2026-01-01T10:00:00Z'),
      receivedAt: new Date('2026-01-01T10:00:05Z'),
      status: 'PENDING',
      proposalDigest: 'b'.repeat(64),
    });

    const result = await service.parseAndPost({
      ...baseInput,
      waMessageId: 'wamid.confirm',
      textBody: 'YES',
    });

    expect(result).toEqual({
      status: 'POSTED',
      kind: 'SALE',
      amountMinor: '3000',
      transactionId: 'tx-1',
    });
    expect((ledger as any).postTransactionWithManager).toHaveBeenCalledWith(
      manager,
      expect.objectContaining({
        businessId: 'b-1',
        idempotencyKey: 'proposal:proposal-1',
        sourceType: 'WHATSAPP',
        sourceMessageId: 'wamid.original',
        sourcePayloadHash: 'a'.repeat(64),
        entries: [
          { accountId: 'cash', amountMinor: '3000', type: 'DEBIT' },
          { accountId: 'sales', amountMinor: '3000', type: 'CREDIT' },
        ],
      }),
    );
    expect(manager.update).toHaveBeenCalledWith(
      expect.anything(),
      { id: 'proposal-1', status: 'PENDING' },
      {
        status: 'CONFIRMED',
        confirmedByWaMessageId: 'wamid.confirm',
        transactionId: 'tx-1',
      },
    );
  });

  it('cancels a pending proposal without writing the ledger', async () => {
    const { service, manager, ledger } = makeService();
    manager.findOne.mockResolvedValueOnce({
      id: 'proposal-1',
      kind: 'EXPENSE',
      amountMinor: '2000',
      status: 'PENDING',
      proposalDigest: 'c'.repeat(64),
    });

    const result = await service.parseAndPost({
      ...baseInput,
      textBody: 'no',
    });

    expect(result).toEqual({
      status: 'CANCELLED',
      kind: 'EXPENSE',
      amountMinor: '2000',
      proposalId: 'proposal-1',
    });
    expect(manager.update).toHaveBeenCalledWith(
      expect.anything(),
      { id: 'proposal-1', status: 'PENDING' },
      {
        status: 'CANCELLED',
      },
    );
    expect((ledger as any).postTransaction).not.toHaveBeenCalled();
  });

  it('fails closed on an unsupported stored proposal kind', async () => {
    const { service, manager, ledger } = makeService();
    manager.findOne.mockResolvedValueOnce(null).mockResolvedValueOnce({
      id: 'proposal-1',
      businessId: 'b-1',
      kind: 'TRANSFER',
      amountMinor: '3000',
      status: 'PENDING',
      proposalDigest: 'd'.repeat(64),
    });

    await expect(
      service.parseAndPost({
        ...baseInput,
        waMessageId: 'wamid.confirm',
        textBody: 'YES',
      }),
    ).rejects.toThrow('unsupported transaction kind');
    expect((ledger as any).postTransactionWithManager).not.toHaveBeenCalled();
  });

  it('fails closed when the immutable proposal digest is absent', async () => {
    const { service, manager, ledger } = makeService();
    manager.findOne.mockResolvedValueOnce(null).mockResolvedValueOnce({
      id: 'proposal-1',
      businessId: 'b-1',
      kind: 'SALE',
      amountMinor: '3000',
      status: 'PENDING',
    });

    await expect(
      service.parseAndPost({
        ...baseInput,
        waMessageId: 'wamid.confirm',
        textBody: 'YES',
      }),
    ).rejects.toThrow('immutable digest');
    expect((ledger as any).postTransactionWithManager).not.toHaveBeenCalled();
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
