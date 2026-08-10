/* eslint-disable @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call, @typescript-eslint/require-await */
import { Test, TestingModule } from '@nestjs/testing';
import { LedgerService, CreateTransactionDto } from './ledger.service';
import { DataSource } from 'typeorm';
import { BadRequestException, ConflictException } from '@nestjs/common';

describe('LedgerService', () => {
  const hashA = 'a'.repeat(64);
  const hashB = 'b'.repeat(64);
  let service: LedgerService;
  let mockQueryRunner: any;
  let mockDataSource: any;

  const validEntries = [
    { accountId: 'a-1', amountMinor: '1500', type: 'DEBIT' as const },
    { accountId: 'a-2', amountMinor: '1500', type: 'CREDIT' as const },
  ];

  beforeEach(async () => {
    mockQueryRunner = {
      connect: jest.fn(),
      startTransaction: jest.fn(),
      commitTransaction: jest.fn(),
      rollbackTransaction: jest.fn(),
      release: jest.fn(),
      isReleased: false,
      isTransactionActive: true,
      manager: {
        create: jest.fn().mockImplementation((_Entity, dto) => dto),
        save: jest.fn().mockImplementation(async (entityOrEntities) => {
          if (Array.isArray(entityOrEntities)) {
            return entityOrEntities.map((e, idx) => ({
              ...e,
              id: `test-id-${idx}`,
            }));
          }
          return { ...entityOrEntities, id: 'test-tx-id' };
        }),
        update: jest.fn().mockResolvedValue({ affected: 1 }),
        // Accounts all belong to business b-1 by default.
        find: jest.fn().mockResolvedValue([
          { id: 'a-1', businessId: 'b-1' },
          { id: 'a-2', businessId: 'b-1' },
        ]),
        findOne: jest.fn().mockResolvedValue(null),
      },
    };

    mockDataSource = {
      createQueryRunner: jest.fn().mockReturnValue(mockQueryRunner),
      manager: { findOne: jest.fn().mockResolvedValue(null) },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        LedgerService,
        { provide: DataSource, useValue: mockDataSource },
      ],
    }).compile();

    service = module.get<LedgerService>(LedgerService);
  });

  const dto = (
    over: Partial<CreateTransactionDto> = {},
  ): CreateTransactionDto => ({
    businessId: 'b-1',
    description: 'Tx',
    currency: 'ZAR',
    idempotencyKey: 'idemp-1',
    sourceType: 'API',
    sourcePayloadHash: hashA,
    occurredAt: new Date(),
    receivedAt: new Date(),
    entries: validEntries,
    ...over,
  });

  describe('postTransaction', () => {
    it('refuses caller-managed posting without an active transaction', async () => {
      await expect(
        service.postTransactionWithManager(
          mockQueryRunner.manager as never,
          dto(),
        ),
      ).rejects.toThrow('requires an active database transaction');
    });

    it('throws if debits do not equal credits', async () => {
      await expect(
        service.postTransaction(
          dto({
            entries: [
              { accountId: 'a-1', amountMinor: '100', type: 'DEBIT' },
              { accountId: 'a-2', amountMinor: '50', type: 'CREDIT' },
            ],
          }),
        ),
      ).rejects.toThrow('Double-entry violation');
    });

    it('throws if there are fewer than 2 entries', async () => {
      await expect(
        service.postTransaction(
          dto({
            entries: [{ accountId: 'a-1', amountMinor: '100', type: 'DEBIT' }],
          }),
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('throws if any amount is <= 0', async () => {
      await expect(
        service.postTransaction(
          dto({
            entries: [
              { accountId: 'a-1', amountMinor: '0', type: 'DEBIT' },
              { accountId: 'a-2', amountMinor: '0', type: 'CREDIT' },
            ],
          }),
        ),
      ).rejects.toThrow('strictly positive');
    });

    it('throws if amount is not a valid integer string', async () => {
      await expect(
        service.postTransaction(
          dto({
            entries: [
              { accountId: 'a-1', amountMinor: '1.5', type: 'DEBIT' },
              { accountId: 'a-2', amountMinor: '1.5', type: 'CREDIT' },
            ],
          }),
        ),
      ).rejects.toThrow('Invalid amount');
    });

    it('throws if idempotency key is missing', async () => {
      await expect(
        service.postTransaction(dto({ idempotencyKey: '' })),
      ).rejects.toThrow('Idempotency key is required.');
    });

    it('throws if payload hash is missing for an externally sourced transaction', async () => {
      await expect(
        service.postTransaction(dto({ sourcePayloadHash: undefined })),
      ).rejects.toThrow('lowercase SHA-256 hex digest');
    });

    it('rejects malformed provenance before opening a transaction', async () => {
      await expect(
        service.postTransaction(dto({ sourceType: 'EMAIL' })),
      ).rejects.toThrow('Source type must be SYSTEM, WHATSAPP, API, or WEB');
      await expect(
        service.postTransaction(dto({ sourcePayloadHash: 'A'.repeat(64) })),
      ).rejects.toThrow('lowercase SHA-256 hex digest');
      await expect(
        service.postTransaction(
          dto({ sourceType: 'WHATSAPP', sourceMessageId: undefined }),
        ),
      ).rejects.toThrow('require a source message id');
      await expect(
        service.postTransaction(
          dto({ sourceType: 'SYSTEM', sourcePayloadHash: hashA }),
        ),
      ).rejects.toThrow('cannot carry an external payload hash');
      expect(mockDataSource.createQueryRunner).not.toHaveBeenCalled();
    });

    it('allows a SYSTEM-sourced transaction without a payload hash', async () => {
      const result = await service.postTransaction(
        dto({ sourceType: 'SYSTEM', sourcePayloadHash: undefined }),
      );
      expect(result.id).toBe('test-tx-id');
    });

    it('rejects an entry against an account from another business', async () => {
      mockQueryRunner.manager.find.mockResolvedValueOnce([
        { id: 'a-1', businessId: 'b-1' },
        { id: 'a-2', businessId: 'OTHER' },
      ]);
      await expect(service.postTransaction(dto())).rejects.toThrow(
        'does not belong to business',
      );
    });

    it('returns the existing transaction on duplicate key with matching hash', async () => {
      mockQueryRunner.manager.findOne.mockResolvedValueOnce({
        id: 'existing-id',
        sourcePayloadHash: hashA,
      });
      const result = await service.postTransaction(
        dto({ sourcePayloadHash: hashA }),
      );
      expect(result.id).toBe('existing-id');
      expect(mockQueryRunner.commitTransaction).toHaveBeenCalled();
    });

    it('throws Conflict on duplicate key with a different hash', async () => {
      mockQueryRunner.manager.findOne.mockResolvedValueOnce({
        id: 'existing-id',
        sourcePayloadHash: hashA,
      });
      await expect(
        service.postTransaction(dto({ sourcePayloadHash: hashB })),
      ).rejects.toBeInstanceOf(ConflictException);
    });

    it('successfully posts a balanced transaction', async () => {
      const result = await service.postTransaction(
        dto({ idempotencyKey: 'idemp-ok' }),
      );
      expect(mockQueryRunner.commitTransaction).toHaveBeenCalled();
      expect(result.id).toBe('test-tx-id');
      expect(result.entries.length).toBe(2);
    });

    it('normalizes supported currency codes and rejects unknown scales', async () => {
      await service.postTransaction(dto({ currency: 'zar' }));
      expect(mockQueryRunner.manager.create).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ currency: 'ZAR' }),
      );
      await expect(
        service.postTransaction(dto({ currency: 'AAA' })),
      ).rejects.toThrow('Currency must be one of');
    });
  });

  describe('reverseTransaction', () => {
    const originalTx = {
      id: 'orig-tx',
      businessId: 'b-1',
      currency: 'ZAR',
      status: 'POSTED',
      reversalOfTransactionId: null,
      entries: validEntries.map((e) => ({ ...e })),
    };

    it('creates a reversal with inverted entries and marks the original', async () => {
      mockQueryRunner.manager.findOne
        .mockResolvedValueOnce(originalTx) // load original
        .mockResolvedValueOnce(null) // existing by key
        .mockResolvedValueOnce(null); // existing reversal

      const result = await service.reverseTransaction(
        'b-1',
        'orig-tx',
        'rev-idemp',
        'Refund',
      );

      expect(mockQueryRunner.manager.findOne).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          where: { id: 'orig-tx', businessId: 'b-1' },
        }),
      );

      expect(result.reversalOfTransactionId).toBe('orig-tx');
      expect(result.entries[0].type).toBe('CREDIT');
      expect(result.entries[1].type).toBe('DEBIT');
      expect(mockQueryRunner.manager.update).toHaveBeenCalledWith(
        expect.anything(),
        'orig-tx',
        { status: 'REVERSED' },
      );
    });

    it('refuses to reverse a non-POSTED transaction', async () => {
      mockQueryRunner.manager.findOne.mockResolvedValueOnce({
        ...originalTx,
        status: 'REVERSED',
      });
      await expect(
        service.reverseTransaction('b-1', 'orig-tx', 'rev-idemp', 'Refund'),
      ).rejects.toBeInstanceOf(ConflictException);
    });

    it('returns the existing reversal when the key matches the same original', async () => {
      mockQueryRunner.manager.findOne
        .mockResolvedValueOnce(originalTx)
        .mockResolvedValueOnce({
          id: 'existing-rev',
          reversalOfTransactionId: 'orig-tx',
        });
      const result = await service.reverseTransaction(
        'b-1',
        'orig-tx',
        'rev-idemp',
        'Refund',
      );
      expect(result.id).toBe('existing-rev');
    });

    it('returns the existing reversal on retry even after the original is REVERSED (idempotency before POSTED check)', async () => {
      // Reproduces the integration-only ordering bug: on retry the original is
      // already REVERSED; the idempotency check must win over the POSTED guard.
      mockQueryRunner.manager.findOne
        .mockResolvedValueOnce({ ...originalTx, status: 'REVERSED' })
        .mockResolvedValueOnce({
          id: 'existing-rev',
          reversalOfTransactionId: 'orig-tx',
          status: 'POSTED',
        });
      const result = await service.reverseTransaction(
        'b-1',
        'orig-tx',
        'rev-idemp',
        'Refund',
      );
      expect(result.id).toBe('existing-rev');
    });

    it('throws Conflict when the key was used for a different original', async () => {
      mockQueryRunner.manager.findOne
        .mockResolvedValueOnce(originalTx)
        .mockResolvedValueOnce({
          id: 'existing-rev',
          reversalOfTransactionId: 'some-other-tx',
        });
      await expect(
        service.reverseTransaction('b-1', 'orig-tx', 'rev-idemp', 'Refund'),
      ).rejects.toBeInstanceOf(ConflictException);
    });

    it('returns the existing reversal when the one-reversal index fires for the same key (race)', async () => {
      mockQueryRunner.manager.findOne
        .mockResolvedValueOnce(originalTx)
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(null);
      mockQueryRunner.manager.save.mockRejectedValueOnce({
        code: '23505',
        constraint: 'UQ_transactions_one_reversal_per_original',
      });
      mockDataSource.manager.findOne.mockResolvedValueOnce({
        id: 'winrev',
        idempotencyKey: 'rev-idemp',
        status: 'POSTED',
        reversalOfTransactionId: 'orig-tx',
      });
      const result = await service.reverseTransaction(
        'b-1',
        'orig-tx',
        'rev-idemp',
        'Refund',
      );
      expect(result.id).toBe('winrev');
    });

    it('throws Conflict when the one-reversal index fires for a different key (race)', async () => {
      mockQueryRunner.manager.findOne
        .mockResolvedValueOnce(originalTx)
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(null);
      mockQueryRunner.manager.save.mockRejectedValueOnce({
        code: '23505',
        constraint: 'UQ_transactions_one_reversal_per_original',
      });
      mockDataSource.manager.findOne.mockResolvedValueOnce({
        id: 'winrev',
        idempotencyKey: 'OTHER',
        status: 'POSTED',
        reversalOfTransactionId: 'orig-tx',
      });
      await expect(
        service.reverseTransaction('b-1', 'orig-tx', 'rev-idemp', 'Refund'),
      ).rejects.toBeInstanceOf(ConflictException);
    });
  });

  describe('race handling (postTransaction)', () => {
    it('returns the winner when the idempotency unique constraint fires', async () => {
      mockQueryRunner.manager.save.mockRejectedValueOnce({
        code: '23505',
        constraint: 'UQ_transactions_business_idempotency',
      });
      mockDataSource.manager.findOne.mockResolvedValueOnce({
        id: 'winner',
        sourcePayloadHash: hashA,
      });
      const result = await service.postTransaction(
        dto({ sourcePayloadHash: hashA }),
      );
      expect(result.id).toBe('winner');
    });
  });
});
