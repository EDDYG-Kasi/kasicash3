import type { INestApplication } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import {
  PostgreSqlContainer,
  StartedPostgreSqlContainer,
} from '@testcontainers/postgresql';
import { createHash, createHmac } from 'crypto';
import express from 'express';
import request from 'supertest';
import { DataSource } from 'typeorm';
import { SecurityRateLimiterService } from '../src/auth/rate-limiter.service';
import { WebhookSecurityService } from '../src/auth/webhook-security.service';
import {
  KASICASH_ENTITIES,
  KASICASH_MIGRATIONS,
} from '../src/database/database-options';
import { InboundMessage } from '../src/ingestion/entities/inbound-message.entity';
import { WebhookDelivery } from '../src/ingestion/entities/webhook-delivery.entity';
import { IngestionService } from '../src/ingestion/ingestion.service';
import { WhatsAppController } from '../src/ingestion/whatsapp.controller';
import { MAX_WEBHOOK_TRANSPORT_BYTES } from '../src/config/webhook-body-limits';

describe('WhatsApp raw HTTP durability', () => {
  const secret = 'integration-webhook-secret';
  let container: StartedPostgreSqlContainer;
  let dataSource: DataSource;
  let app: INestApplication;
  const policyMaxBytes = 2 * 1024 * 1024;

  beforeAll(async () => {
    container = await new PostgreSqlContainer('postgres:15-alpine').start();
    dataSource = new DataSource({
      type: 'postgres',
      host: container.getHost(),
      port: container.getPort(),
      username: container.getUsername(),
      password: container.getPassword(),
      database: container.getDatabase(),
      entities: KASICASH_ENTITIES,
      migrations: KASICASH_MIGRATIONS,
      synchronize: false,
    });
    await dataSource.initialize();
    await dataSource.runMigrations();

    const ingestion = new IngestionService(
      dataSource,
      {} as never,
      {} as never,
      {} as never,
      { sendText: jest.fn() },
      undefined,
      { canStartWork: () => false } as never,
    );
    const config = {
      get: (key: string) =>
        key === 'WHATSAPP_APP_SECRET' ? secret : undefined,
    } as unknown as ConfigService;
    const module = await Test.createTestingModule({
      controllers: [WhatsAppController],
      providers: [
        { provide: IngestionService, useValue: ingestion },
        { provide: ConfigService, useValue: config },
        {
          provide: SecurityRateLimiterService,
          useValue: { assertAllowed: jest.fn() },
        },
        {
          provide: WebhookSecurityService,
          useValue: { maxRawBodyBytes: () => policyMaxBytes },
        },
      ],
    }).compile();
    app = module.createNestApplication({ bodyParser: false });
    app.use(
      '/webhooks/whatsapp',
      express.raw({
        type: 'application/json',
        limit: MAX_WEBHOOK_TRANSPORT_BYTES,
      }),
    );
    app.use(express.json({ limit: '1mb' }));
    await app.init();
  }, 180000);

  afterAll(async () => {
    if (app) await app.close();
    if (dataSource?.isInitialized) await dataSource.destroy();
    if (container) await container.stop();
  });

  it('persists, parses, quarantines, accepts, and replays from exact signed bytes', async () => {
    const invalidJson = Buffer.from('{"entry":');
    await postSigned(invalidJson).expect(200);
    await expectDelivery(invalidJson, 'QUARANTINED', 'INVALID_JSON');

    for (const invalidSchema of [
      Buffer.from('{}'),
      Buffer.from('{"entry":{}}'),
      Buffer.from('{"entry":[{"changes":[]}]}'),
    ]) {
      await postSigned(invalidSchema).expect(200);
      await expectDelivery(invalidSchema, 'QUARANTINED', 'INVALID_SCHEMA');
    }

    const malformedMessage = Buffer.from(
      JSON.stringify({
        entry: [
          {
            changes: [
              {
                value: {
                  messages: [
                    { id: '', from: 'x', timestamp: 'bad', type: 'text' },
                  ],
                },
              },
            ],
          },
        ],
      }),
    );
    await postSigned(malformedMessage).expect(200);
    await expectDelivery(malformedMessage, 'QUARANTINED', 'MALFORMED_MESSAGE');

    const valid = Buffer.from(
      JSON.stringify({
        object: 'whatsapp_business_account',
        entry: [
          {
            changes: [
              {
                value: {
                  messages: [
                    {
                      id: 'wamid.http.matrix',
                      from: '27831234567',
                      timestamp: '1785492060',
                      type: 'text',
                      text: { body: 'sold airtime R30' },
                    },
                  ],
                },
              },
            ],
          },
        ],
      }),
    );
    await postSigned(valid).expect(200);
    await expectDelivery(valid, 'ACCEPTED', null);
    await postSigned(valid).expect(200);
    await expect(
      dataSource.manager.countBy(InboundMessage, {
        waMessageId: 'wamid.http.matrix',
      }),
    ).resolves.toBe(1);

    const badSignature = Buffer.from('{"entry":[{"changes":[]}],"bad":true}');
    await request(app.getHttpServer() as Parameters<typeof request>[0])
      .post('/webhooks/whatsapp')
      .set('Content-Type', 'application/json')
      .set('x-hub-signature-256', 'sha256=' + '0'.repeat(64))
      .send(badSignature)
      .expect(401);
    await expect(
      dataSource.manager.countBy(WebhookDelivery, {
        payloadHash: sha256(badSignature),
      }),
    ).resolves.toBe(0);
  });

  it('accepts signed bodies above 1 MiB and durably quarantines policy overflow', async () => {
    const aboveOneMiB = Buffer.from(
      JSON.stringify({
        object: 'whatsapp_business_account',
        padding: 'x'.repeat(1100 * 1024),
        entry: [
          {
            changes: [
              {
                value: {
                  messages: [
                    {
                      id: 'wamid.http.large',
                      from: '27831234567',
                      timestamp: '1785492060',
                      type: 'text',
                      text: { body: 'sold airtime R30' },
                    },
                  ],
                },
              },
            ],
          },
        ],
      }),
    );
    expect(aboveOneMiB.length).toBeGreaterThan(1024 * 1024);
    expect(aboveOneMiB.length).toBeLessThan(policyMaxBytes);
    await postSigned(aboveOneMiB).expect(200);
    await expectDelivery(aboveOneMiB, 'ACCEPTED', null);

    const overPolicy = Buffer.from(
      JSON.stringify({
        object: 'whatsapp_business_account',
        padding: 'x'.repeat(policyMaxBytes),
        entry: [{ changes: [] }],
      }),
    );
    expect(overPolicy.length).toBeGreaterThan(policyMaxBytes);
    expect(overPolicy.length).toBeLessThan(MAX_WEBHOOK_TRANSPORT_BYTES);
    await postSigned(overPolicy).expect(200);
    await expectDelivery(overPolicy, 'QUARANTINED', 'PAYLOAD_TOO_LARGE');
  });

  function postSigned(rawBody: Buffer) {
    const signature =
      'sha256=' + createHmac('sha256', secret).update(rawBody).digest('hex');
    return request(app.getHttpServer() as Parameters<typeof request>[0])
      .post('/webhooks/whatsapp')
      .set('Content-Type', 'application/json')
      .set('x-hub-signature-256', signature)
      .send(rawBody);
  }

  async function expectDelivery(
    rawBody: Buffer,
    status: string,
    errorCode: string | null,
  ): Promise<void> {
    const delivery = await dataSource.manager.findOneByOrFail(WebhookDelivery, {
      payloadHash: sha256(rawBody),
    });
    expect(delivery.rawBody.equals(rawBody)).toBe(true);
    expect(delivery.status).toBe(status);
    expect(delivery.errorCode).toBe(errorCode);
  }
});

function sha256(value: Buffer): string {
  return createHash('sha256').update(value).digest('hex');
}
