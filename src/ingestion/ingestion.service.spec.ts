/* eslint-disable @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-unsafe-call, @typescript-eslint/require-await */
import { createHmac } from 'crypto';
import {
  BadRequestException,
  ForbiddenException,
  UnauthorizedException,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { verifyWhatsAppSignature } from './whatsapp-signature.util';
import { DevController } from './dev.controller';
import { WhatsAppController } from './whatsapp.controller';
import {
  IngestionService,
  WaWebhookPayload,
  MAX_ATTEMPTS,
  backoffMs,
} from './ingestion.service';
import { RecoveryService } from './recovery.service';
import { OnboardingService } from './onboarding.service';
import { ParsingService } from '../parsing/parsing.service';
import { ConversationalQueryService } from '../conversational-query/conversational-query.service';

describe('verifyWhatsAppSignature', () => {
  const secret = 'test-secret';
  const raw = Buffer.from(JSON.stringify({ hello: 'world' }));
  const goodSig =
    'sha256=' + createHmac('sha256', secret).update(raw).digest('hex');

  it('accepts a valid signature', () => {
    expect(verifyWhatsAppSignature(secret, raw, goodSig)).toBe(true);
  });
  it('rejects a tampered body', () => {
    expect(
      verifyWhatsAppSignature(
        secret,
        Buffer.from('{"hello":"there"}'),
        goodSig,
      ),
    ).toBe(false);
  });
  it('rejects a missing or malformed header', () => {
    expect(verifyWhatsAppSignature(secret, raw, undefined)).toBe(false);
    expect(verifyWhatsAppSignature(secret, raw, 'md5=abc')).toBe(false);
    expect(verifyWhatsAppSignature(secret, raw, 'sha256=zz')).toBe(false);
  });
});

describe('WhatsAppController verification handshake', () => {
  const config = {
    get: (k: string) => (k === 'WHATSAPP_VERIFY_TOKEN' ? 'tok' : undefined),
  } as unknown as ConfigService;
  const controller = new WhatsAppController({} as IngestionService, config);

  it('echoes the challenge on a valid subscribe', () => {
    expect(controller.verify('subscribe', 'tok', '12345')).toBe('12345');
  });
  it('rejects a bad verify token', () => {
    expect(() => controller.verify('subscribe', 'wrong', '12345')).toThrow(
      ForbiddenException,
    );
  });
});

describe('WhatsAppController POST (signature gate)', () => {
  const secret = 'app-secret';
  const raw = Buffer.from(JSON.stringify({ ok: 1 }));
  const sig =
    'sha256=' + createHmac('sha256', secret).update(raw).digest('hex');
  const config = {
    get: (k: string) => (k === 'WHATSAPP_APP_SECRET' ? secret : undefined),
  } as unknown as ConfigService;

  it('ingests and returns EVENT_RECEIVED on a valid signature', async () => {
    const ingestion = {
      ingestWebhook: jest.fn().mockResolvedValue({ stored: 1, duplicates: 0 }),
    } as unknown as IngestionService;
    const controller = new WhatsAppController(ingestion, config);
    const req = { rawBody: raw } as any;
    const res = await controller.receive(req, { ok: 1 } as any, sig);
    expect(res).toBe('EVENT_RECEIVED');
    expect((ingestion as any).ingestWebhook).toHaveBeenCalledTimes(1);
  });

  it('rejects a bad signature with 401 and never calls ingestion', async () => {
    const ingestion = {
      ingestWebhook: jest.fn(),
    } as unknown as IngestionService;
    const controller = new WhatsAppController(ingestion, config);
    const req = { rawBody: raw } as any;
    await expect(
      controller.receive(req, { ok: 1 } as any, 'sha256=deadbeef'),
    ).rejects.toBeInstanceOf(UnauthorizedException);
    expect((ingestion as any).ingestWebhook).not.toHaveBeenCalled();
  });
});

describe('IngestionService', () => {
  const makeService = (
    managerOverrides: any = {},
    onboardingOverrides: any = {},
    parsingOverrides: any = {},
    queryImpl?: any,
    conversationalOverrides: any = {},
  ) => {
    const query =
      queryImpl ??
      jest.fn().mockResolvedValue([
        {
          wa_from: '27831234567',
          wa_message_id: 'wamid.1',
          payload_hash: 'hash-1',
          text_body: 'sold 3 chips R30',
          message_type: 'text',
          wa_timestamp: new Date('2026-01-01T10:00:00Z'),
          received_at: new Date('2026-01-01T10:00:05Z'),
        },
      ]); // claim wins
    const manager = {
      create: jest.fn().mockImplementation((_E: any, d: any) => d),
      save: jest
        .fn()
        .mockImplementation(async (r: any) => ({ ...r, id: 'im-1' })),
      update: jest.fn().mockResolvedValue({ affected: 1 }),
      findOneOrFail: jest
        .fn()
        .mockResolvedValue({ id: 'im-1', waFrom: '27831234567' }),
      findOne: jest.fn().mockResolvedValue(null),
      ...managerOverrides,
    };
    const onboarding = {
      resolveOrCreateBusiness: jest.fn().mockResolvedValue({
        business: { id: 'b-1', name: 'Trader 27831234567' },
        created: true,
      }),
      ...onboardingOverrides,
    } as unknown as OnboardingService;
    const parsing = {
      parseAndPost: jest.fn().mockResolvedValue({ status: 'UNRECOGNIZED' }),
      ...parsingOverrides,
    } as unknown as ParsingService;
    const conversationalQueries = {
      handle: jest.fn().mockResolvedValue({
        handled: false,
        route: 'TRANSACTION',
      }),
      ...conversationalOverrides,
    } as unknown as ConversationalQueryService;
    const wa = { sendText: jest.fn().mockResolvedValue(undefined) };
    const service = new IngestionService(
      { manager, query } as any,
      onboarding,
      parsing,
      conversationalQueries,
      wa,
    );
    return {
      service,
      manager,
      onboarding,
      parsing,
      conversationalQueries,
      wa,
      query,
    };
  };

  const payload: WaWebhookPayload = {
    entry: [
      {
        changes: [
          {
            value: {
              contacts: [{ profile: { name: 'Thabo' } }],
              messages: [
                {
                  id: 'wamid.1',
                  from: '27831234567',
                  timestamp: '1767267600',
                  type: 'text',
                  text: { body: 'sold 3 chips R30' },
                },
              ],
            },
          },
        ],
      },
    ],
  };

  it('stores a new message and reports it', async () => {
    const { service, manager } = makeService();
    const result = await service.ingestWebhook(payload, Buffer.from('{}'));
    expect(result.stored).toBe(1);
    expect(manager.save).toHaveBeenCalledTimes(1);
  });

  it('stores and processes a synthetic dev text message synchronously', async () => {
    const query = jest.fn().mockResolvedValue([
      {
        wa_from: '27831234567',
        wa_message_id: 'dev.test',
        payload_hash: 'hash-1',
        text_body: 'sold airtime R30',
        message_type: 'text',
        wa_timestamp: new Date('2026-01-01T10:00:00Z'),
        received_at: new Date('2026-01-01T10:00:05Z'),
      },
    ]);
    const { service, manager, parsing } = makeService({}, {}, {}, query);

    const result = await service.ingestSyntheticText({
      from: '27831234567',
      text: 'sold airtime R30',
      contactName: 'Thabo',
      messageId: 'dev.test',
      timestamp: new Date('2026-01-01T10:00:00Z'),
    });

    expect(result).toMatchObject({
      stored: true,
      duplicate: false,
      processed: true,
      inboundId: 'im-1',
      waMessageId: 'dev.test',
    });
    expect(manager.save).toHaveBeenCalledWith(
      expect.objectContaining({
        waMessageId: 'dev.test',
        waFrom: '27831234567',
        textBody: 'sold airtime R30',
        messageType: 'text',
      }),
    );
    expect((parsing as any).parseAndPost).toHaveBeenCalledWith(
      expect.objectContaining({
        waMessageId: 'dev.test',
        textBody: 'sold airtime R30',
      }),
    );
  });

  it('collapses duplicate deliveries on the unique wa_message_id', async () => {
    const { service } = makeService({
      save: jest.fn().mockRejectedValue({ code: '23505' }),
    });
    const result = await service.ingestWebhook(payload, Buffer.from('{}'));
    expect(result.duplicates).toBe(1);
    expect(result.stored).toBe(0);
  });

  it('stores new messages and collapses only the duplicate in a multi-message payload', async () => {
    const save = jest
      .fn()
      .mockImplementationOnce(async (r: any) => ({ ...r, id: 'im-1' }))
      .mockRejectedValueOnce({ code: '23505' });
    const { service } = makeService({ save });
    const multi: WaWebhookPayload = {
      entry: [
        {
          changes: [
            {
              value: {
                messages: [
                  {
                    id: 'wamid.a',
                    from: '27831234567',
                    timestamp: '1767267600',
                    type: 'text',
                    text: { body: 'x' },
                  },
                  {
                    id: 'wamid.b',
                    from: '27831234567',
                    timestamp: '1767267601',
                    type: 'text',
                    text: { body: 'y' },
                  },
                ],
              },
            },
          ],
        },
      ],
    };
    const result = await service.ingestWebhook(multi, Buffer.from('{}'));
    expect(result.stored).toBe(1);
    expect(result.duplicates).toBe(1);
  });

  it('flags a reused wa_message_id carrying a different payload hash', async () => {
    const warn = jest
      .spyOn(Logger.prototype, 'warn')
      .mockImplementation(() => undefined);
    const { service } = makeService({
      save: jest.fn().mockRejectedValue({ code: '23505' }),
      findOne: jest.fn().mockResolvedValue({
        waMessageId: 'wamid.1',
        payloadHash: 'DIFFERENT',
      }),
    });
    const result = await service.ingestWebhook(payload, Buffer.from('{}'));
    expect(result.duplicates).toBe(1);
    expect(result.stored).toBe(0);
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });

  it('acks statuses-only callbacks without storing anything', async () => {
    const { service, manager } = makeService();
    const result = await service.ingestWebhook(
      { entry: [{ changes: [{ value: { statuses: [{}] } }] }] },
      Buffer.from('{}'),
    );
    expect(result.stored).toBe(0);
    expect(manager.save).not.toHaveBeenCalled();
  });

  it('marks the message FAILED when processing throws', async () => {
    const { service, manager } = makeService(
      {},
      {
        resolveOrCreateBusiness: jest
          .fn()
          .mockRejectedValue(new Error('db down')),
      },
    );
    await service.processMessage('im-1');
    expect(manager.update).toHaveBeenCalledWith(
      expect.anything(),
      'im-1',
      expect.objectContaining({ status: 'FAILED' }),
    );
  });

  it('processes, links the business, and sends a welcome on first contact', async () => {
    const { service, manager, wa } = makeService();
    await service.processMessage('im-1', 'Thabo');
    expect(manager.update).toHaveBeenCalledWith(
      expect.anything(),
      'im-1',
      expect.objectContaining({ status: 'PROCESSED', businessId: 'b-1' }),
    );
    expect(wa.sendText).toHaveBeenCalledWith(
      '27831234567',
      expect.stringContaining('Welcome'),
    );
  });

  it('posts a parsed transaction before marking the inbound message PROCESSED', async () => {
    const { service, manager, parsing, wa } = makeService(
      {},
      {
        resolveOrCreateBusiness: jest.fn().mockResolvedValue({
          business: { id: 'b-1', name: 'Trader 27831234567' },
          created: false,
        }),
      },
      {
        parseAndPost: jest.fn().mockResolvedValue({
          status: 'POSTED',
          kind: 'SALE',
          amountMinor: '3000',
          transactionId: 'tx-1',
        }),
      },
    );
    await service.processMessage('im-1');
    expect((parsing as any).parseAndPost).toHaveBeenCalledWith(
      expect.objectContaining({
        businessId: 'b-1',
        waMessageId: 'wamid.1',
        payloadHash: 'hash-1',
        textBody: 'sold 3 chips R30',
      }),
    );
    expect(manager.update).toHaveBeenCalledWith(
      expect.anything(),
      'im-1',
      expect.objectContaining({ status: 'PROCESSED', businessId: 'b-1' }),
    );
    expect(wa.sendText).toHaveBeenCalledWith(
      '27831234567',
      'Recorded a sale of R30.00.',
    );
  });

  it('answers a conversational query without invoking the transaction parser', async () => {
    const { service, manager, parsing, conversationalQueries, wa } =
      makeService(
        {},
        {
          resolveOrCreateBusiness: jest.fn().mockResolvedValue({
            business: { id: 'b-1', name: 'Trader 27831234567' },
            created: false,
          }),
        },
        {},
        undefined,
        {
          handle: jest.fn().mockResolvedValue({
            handled: true,
            replyBody: 'You have ZAR 75.00 cash right now.',
          }),
        },
      );

    await service.processMessage('im-1');

    expect((conversationalQueries as any).handle).toHaveBeenCalledWith(
      expect.objectContaining({
        businessId: 'b-1',
        textBody: 'sold 3 chips R30',
      }),
    );
    expect((parsing as any).parseAndPost).not.toHaveBeenCalled();
    expect(manager.update).toHaveBeenCalledWith(
      expect.anything(),
      'im-1',
      expect.objectContaining({ status: 'PROCESSED', businessId: 'b-1' }),
    );
    expect(wa.sendText).toHaveBeenCalledWith(
      '27831234567',
      'You have ZAR 75.00 cash right now.',
    );
  });

  it('skips processing when the atomic claim is lost (already handled elsewhere)', async () => {
    const query = jest.fn().mockResolvedValue([]); // claim matched no rows
    const { service, onboarding, wa } = makeService({}, {}, {}, query);
    await service.processMessage('im-1');
    expect((onboarding as any).resolveOrCreateBusiness).not.toHaveBeenCalled();
    expect(wa.sendText).not.toHaveBeenCalled();
  });

  it('records backoff and stays FAILED before attempts are exhausted', async () => {
    const { service, manager } = makeService(
      { findOne: jest.fn().mockResolvedValue({ attempts: 0 }) },
      {
        resolveOrCreateBusiness: jest
          .fn()
          .mockRejectedValue(new Error('db down')),
      },
    );
    await service.processMessage('im-1');
    const patch = manager.update.mock.calls.at(-1)[2];
    expect(patch.status).toBe('FAILED');
    expect(patch.attempts).toBe(1);
    expect(patch.nextRetryAt).toBeInstanceOf(Date);
  });

  it('moves a message to DEAD after exhausting attempts', async () => {
    const { service, manager } = makeService(
      { findOne: jest.fn().mockResolvedValue({ attempts: MAX_ATTEMPTS - 1 }) },
      {
        resolveOrCreateBusiness: jest
          .fn()
          .mockRejectedValue(new Error('still down')),
      },
    );
    await service.processMessage('im-1');
    const patch = manager.update.mock.calls.at(-1)[2];
    expect(patch.status).toBe('DEAD');
    expect(patch.attempts).toBe(MAX_ATTEMPTS);
    expect(patch.nextRetryAt).toBeNull();
  });

  it('treats reply send as best-effort: a send failure keeps the message PROCESSED', async () => {
    const { service, manager, wa } = makeService();
    wa.sendText.mockRejectedValueOnce(new Error('whatsapp 500'));
    await service.processMessage('im-1', 'Thabo');
    // PROCESSED was written and NOT reverted to FAILED/DEAD by the send failure.
    const statuses = manager.update.mock.calls.map((c: any) => c[2].status);
    expect(statuses).toContain('PROCESSED');
    expect(statuses).not.toContain('FAILED');
    expect(statuses).not.toContain('DEAD');
  });

  it('backoff grows exponentially and is capped', () => {
    expect(backoffMs(1)).toBe(60_000);
    expect(backoffMs(2)).toBe(120_000);
    expect(backoffMs(3)).toBe(240_000);
    expect(backoffMs(99)).toBe(60 * 60_000); // capped at 1h
  });
});

describe('DevController', () => {
  const enabledConfig = {
    get: (k: string) => (k === 'KASICASH_DEV_TOOLS' ? 'true' : undefined),
  } as unknown as ConfigService;
  const disabledConfig = {
    get: () => undefined,
  } as unknown as ConfigService;

  it('rejects simulation when developer tools are disabled', async () => {
    const ingestion = {
      ingestSyntheticText: jest.fn(),
    } as unknown as IngestionService;
    const controller = new DevController(ingestion, disabledConfig);

    await expect(
      controller.simulateWhatsAppText({ text: 'sold R30 airtime' }),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect((ingestion as any).ingestSyntheticText).not.toHaveBeenCalled();
  });

  it('normalizes input and runs a synthetic WhatsApp text when enabled', async () => {
    const ingestion = {
      ingestSyntheticText: jest.fn().mockResolvedValue({
        stored: true,
        duplicate: false,
        processed: true,
        inboundId: 'im-1',
        waMessageId: 'dev.1',
      }),
    } as unknown as IngestionService;
    const controller = new DevController(ingestion, enabledConfig);

    const result = await controller.simulateWhatsAppText({
      from: '+27 83 123 4567',
      text: '  sold   R30 airtime ',
      contactName: '  Thabo  ',
      messageId: 'dev.1',
    });

    expect((ingestion as any).ingestSyntheticText).toHaveBeenCalledWith({
      from: '27831234567',
      text: 'sold R30 airtime',
      contactName: 'Thabo',
      messageId: 'dev.1',
    });
    expect(result).toMatchObject({ ok: true, processed: true });
  });

  it('rejects missing text', async () => {
    const controller = new DevController(
      { ingestSyntheticText: jest.fn() } as unknown as IngestionService,
      enabledConfig,
    );

    await expect(controller.simulateWhatsAppText({})).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });
});

describe('RecoveryService', () => {
  const makeRecovery = (dueRows: any[]) => {
    const manager = { find: jest.fn().mockResolvedValue(dueRows) };
    const dataSource = { manager } as any;
    const ingestion = {
      processMessage: jest.fn().mockResolvedValue(true),
    } as unknown as IngestionService;
    return {
      recovery: new RecoveryService(dataSource, ingestion),
      manager,
      ingestion,
    };
  };

  it('processes each due message (stale RECEIVED + due FAILED) once', async () => {
    const { recovery, ingestion } = makeRecovery([{ id: 'a' }, { id: 'b' }]);
    const result = await recovery.runRecoveryCycle();
    expect(result.recovered).toBe(2);
    expect((ingestion as any).processMessage).toHaveBeenCalledTimes(2);
    expect((ingestion as any).processMessage).toHaveBeenCalledWith('a');
    expect((ingestion as any).processMessage).toHaveBeenCalledWith('b');
  });

  it('does nothing when there is no due work', async () => {
    const { recovery, ingestion } = makeRecovery([]);
    const result = await recovery.runRecoveryCycle();
    expect(result.recovered).toBe(0);
    expect((ingestion as any).processMessage).not.toHaveBeenCalled();
  });
});
