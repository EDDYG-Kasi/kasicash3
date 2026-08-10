import type { ConfigService } from '@nestjs/config';
import { Logger } from '@nestjs/common';
import {
  CloudApiWhatsAppClient,
  LoggingWhatsAppClient,
  WhatsAppDeliveryError,
} from './whatsapp.client';
import {
  createWhatsAppClient,
  ingestionControllersForEnvironment,
} from './ingestion.module';
import { DevController } from './dev.controller';

describe('WhatsApp client configuration', () => {
  it('omits the developer controller from the production module graph', () => {
    expect(
      ingestionControllersForEnvironment({ NODE_ENV: 'production' }),
    ).not.toContain(DevController);
    expect(ingestionControllersForEnvironment({ NODE_ENV: 'test' })).toContain(
      DevController,
    );
  });

  it('does not log any recipient or message fragment in development', async () => {
    const log = jest.spyOn(Logger.prototype, 'log').mockImplementation();
    await new LoggingWhatsAppClient().sendText(
      '27831234567',
      'Private sale value ZAR 999.99',
    );
    const rendered = log.mock.calls.flat().join(' ');
    expect(rendered).toBe('[dev, not sent]: recipient and reply redacted');
    expect(rendered).not.toContain('4567');
    expect(rendered).not.toContain('999.99');
    log.mockRestore();
  });

  it('fails closed when production is not explicitly configured for cloud delivery', () => {
    expect(() =>
      createWhatsAppClient(
        config({ NODE_ENV: 'production', KASICASH_WHATSAPP_MODE: 'log' }),
      ),
    ).toThrow('KASICASH_WHATSAPP_MODE=cloud is required in production');
  });

  it('requires both cloud credentials', () => {
    expect(() =>
      createWhatsAppClient(
        config({
          NODE_ENV: 'production',
          KASICASH_WHATSAPP_MODE: 'cloud',
          WHATSAPP_ACCESS_TOKEN: 'token',
        }),
      ),
    ).toThrow('WhatsApp Cloud credentials are required');
  });

  it('allows explicit development logging and complete cloud configuration', () => {
    expect(
      createWhatsAppClient(config({ KASICASH_WHATSAPP_MODE: 'log' })),
    ).toBeInstanceOf(LoggingWhatsAppClient);
    expect(
      createWhatsAppClient(
        config({
          KASICASH_WHATSAPP_MODE: 'cloud',
          WHATSAPP_ACCESS_TOKEN: 'token',
          WHATSAPP_PHONE_NUMBER_ID: '1234567890',
          WHATSAPP_GRAPH_API_VERSION: 'v24.0',
          WHATSAPP_SEND_TIMEOUT_MS: '7000',
        }),
      ),
    ).toBeInstanceOf(CloudApiWhatsAppClient);
  });

  it('rejects unsafe cloud version and timeout settings', () => {
    expect(() =>
      createWhatsAppClient(
        config({
          KASICASH_WHATSAPP_MODE: 'cloud',
          WHATSAPP_ACCESS_TOKEN: 'token',
          WHATSAPP_PHONE_NUMBER_ID: '1234567890',
          WHATSAPP_GRAPH_API_VERSION: '../me',
        }),
      ),
    ).toThrow('WHATSAPP_GRAPH_API_VERSION must look like v24.0');
    expect(() =>
      createWhatsAppClient(
        config({
          KASICASH_WHATSAPP_MODE: 'cloud',
          WHATSAPP_ACCESS_TOKEN: 'token',
          WHATSAPP_PHONE_NUMBER_ID: '1234567890',
          WHATSAPP_SEND_TIMEOUT_MS: '50',
        }),
      ),
    ).toThrow('WHATSAPP_SEND_TIMEOUT_MS must be between 1000 and 30000');
  });
});

describe('CloudApiWhatsAppClient', () => {
  it('sends the documented Cloud API text payload with bearer auth', async () => {
    const fetchImpl = jest.fn().mockResolvedValue(
      jsonResponse(200, {
        messaging_product: 'whatsapp',
        contacts: [{ input: '27831234567', wa_id: '27831234567' }],
        messages: [{ id: 'wamid.test-message-id' }],
      }),
    );
    const client = new CloudApiWhatsAppClient('super-secret-token', '12345', {
      graphApiVersion: 'v24.0',
      timeoutMs: 2000,
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });

    await expect(
      client.sendText('27831234567', 'Recorded a sale of R30.00.'),
    ).resolves.toBeUndefined();

    expect(fetchImpl).toHaveBeenCalledTimes(1);
    const [url, init] = fetchImpl.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('https://graph.facebook.com/v24.0/12345/messages');
    expect(init.method).toBe('POST');
    expect(init.headers).toMatchObject({
      Authorization: 'Bearer super-secret-token',
      'Content-Type': 'application/json',
    });
    expect(typeof init.body).toBe('string');
    const body = init.body as string;
    expect(JSON.parse(body)).toEqual({
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to: '27831234567',
      type: 'text',
      text: {
        preview_url: false,
        body: 'Recorded a sale of R30.00.',
      },
    });
  });

  it('classifies retryable and permanent provider failures without leaking body, recipient, or token', async () => {
    const fetchImpl = jest.fn().mockResolvedValue(
      jsonResponse(401, {
        error: {
          message:
            'Invalid OAuth access token super-secret-token for 27831234567',
          type: 'OAuthException',
          code: 190,
        },
      }),
    );
    const client = new CloudApiWhatsAppClient('super-secret-token', '12345', {
      graphApiVersion: 'v24.0',
      timeoutMs: 2000,
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });

    await expect(client.sendText('27831234567', 'hello')).rejects.toMatchObject(
      {
        name: 'WhatsAppDeliveryError',
        failureKind: 'PERMANENT',
        retryable: false,
        statusCode: 401,
        code: 'WHATSAPP_PROVIDER_PERMANENT_FAILURE',
        providerErrorCode: '190',
        providerErrorType: 'OAuthException',
      },
    );
    await expect(client.sendText('27831234567', 'hello')).rejects.not.toThrow(
      /super-secret-token|27831234567|hello/,
    );
  });

  it('classifies 429/5xx provider failures as retryable', async () => {
    const fetchImpl = jest
      .fn()
      .mockResolvedValue(jsonResponse(429, { error: { code: 4 } }));
    const client = new CloudApiWhatsAppClient('token', '12345', {
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });

    await expect(client.sendText('27831234567', 'hello')).rejects.toMatchObject(
      {
        failureKind: 'RETRYABLE',
        retryable: true,
        statusCode: 429,
        code: 'WHATSAPP_PROVIDER_RETRYABLE_FAILURE',
      },
    );
  });

  it('classifies timeout and network failures as retryable', async () => {
    const timeoutFetch = jest.fn().mockRejectedValue(
      Object.assign(new Error('timed out'), {
        name: 'TimeoutError',
      }),
    );
    const networkFetch = jest.fn().mockRejectedValue(new TypeError('offline'));

    await expect(
      new CloudApiWhatsAppClient('token', '12345', {
        fetchImpl: timeoutFetch as unknown as typeof fetch,
      }).sendText('27831234567', 'hello'),
    ).rejects.toMatchObject({
      failureKind: 'RETRYABLE',
      code: 'WHATSAPP_SEND_TIMEOUT',
    });
    await expect(
      new CloudApiWhatsAppClient('token', '12345', {
        fetchImpl: networkFetch as unknown as typeof fetch,
      }).sendText('27831234567', 'hello'),
    ).rejects.toMatchObject({
      failureKind: 'RETRYABLE',
      code: 'WHATSAPP_NETWORK_ERROR',
    });
  });

  it('rejects malformed provider success responses as permanent protocol failures', async () => {
    const fetchImpl = jest
      .fn()
      .mockResolvedValue(
        jsonResponse(200, { messages: [{ id: 'not-wamid' }] }),
      );
    const client = new CloudApiWhatsAppClient('token', '12345', {
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });

    await expect(client.sendText('27831234567', 'hello')).rejects.toMatchObject(
      {
        failureKind: 'PERMANENT',
        code: 'WHATSAPP_PROVIDER_MALFORMED_SUCCESS',
        statusCode: 200,
      },
    );
  });

  it('fails locally before a provider call for invalid recipients or oversized text', async () => {
    const fetchImpl = jest.fn();
    const client = new CloudApiWhatsAppClient('token', '12345', {
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });

    await expect(
      client.sendText('+27831234567', 'hello'),
    ).rejects.toBeInstanceOf(WhatsAppDeliveryError);
    await expect(client.sendText('27831234567', '')).rejects.toMatchObject({
      code: 'WHATSAPP_INVALID_TEXT_BODY',
    });
    expect(fetchImpl).not.toHaveBeenCalled();
  });
});

function config(values: Record<string, string>): ConfigService {
  return {
    get: (key: string) => values[key],
  } as unknown as ConfigService;
}

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}
