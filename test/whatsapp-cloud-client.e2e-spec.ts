import { createServer, type IncomingMessage, type ServerResponse } from 'http';
import type { AddressInfo } from 'net';
import { CloudApiWhatsAppClient } from '../src/ingestion/whatsapp.client';

interface CapturedRequest {
  method?: string;
  url?: string;
  authorization?: string;
  contentType?: string;
  body: string;
}

type Handler = (
  request: IncomingMessage,
  response: ServerResponse,
  body: string,
) => void;

describe('CloudApiWhatsAppClient mock HTTP integration', () => {
  it('posts the expected request to a local mock server and accepts the wamid response', async () => {
    const harness = await startMockServer((_request, response) => {
      response.writeHead(200, { 'Content-Type': 'application/json' });
      response.end(
        JSON.stringify({
          messaging_product: 'whatsapp',
          contacts: [{ input: '27831234567', wa_id: '27831234567' }],
          messages: [{ id: 'wamid.local-accepted' }],
        }),
      );
    });
    try {
      const client = new CloudApiWhatsAppClient('ci-secret-token', '12345', {
        baseUrl: harness.baseUrl,
        graphApiVersion: 'v24.0',
        timeoutMs: 2000,
      });

      await expect(
        client.sendText('27831234567', 'Recorded a sale of R30.00.'),
      ).resolves.toBeUndefined();

      expect(harness.requests).toHaveLength(1);
      const request = harness.requests[0];
      expect(request.method).toBe('POST');
      expect(request.url).toBe('/v24.0/12345/messages');
      expect(request.authorization).toBe('Bearer ci-secret-token');
      expect(request.contentType).toContain('application/json');
      expect(JSON.parse(request.body) as Record<string, unknown>).toEqual({
        messaging_product: 'whatsapp',
        recipient_type: 'individual',
        to: '27831234567',
        type: 'text',
        text: {
          preview_url: false,
          body: 'Recorded a sale of R30.00.',
        },
      });
    } finally {
      await harness.close();
    }
  });

  it('turns provider failures from the mock server into sanitized permanent errors', async () => {
    const harness = await startMockServer((_request, response) => {
      response.writeHead(400, { 'Content-Type': 'application/json' });
      response.end(
        JSON.stringify({
          error: {
            message:
              'Bad request included ci-secret-token and 27831234567 and body text',
            type: 'OAuthException',
            code: 131000,
          },
        }),
      );
    });
    try {
      const client = new CloudApiWhatsAppClient('ci-secret-token', '12345', {
        baseUrl: harness.baseUrl,
        graphApiVersion: 'v24.0',
        timeoutMs: 2000,
      });

      await expect(
        client.sendText('27831234567', 'body text'),
      ).rejects.toMatchObject({
        name: 'WhatsAppDeliveryError',
        failureKind: 'PERMANENT',
        retryable: false,
        statusCode: 400,
        code: 'WHATSAPP_PROVIDER_PERMANENT_FAILURE',
        providerErrorCode: '131000',
        providerErrorType: 'OAuthException',
      });
      await expect(
        client.sendText('27831234567', 'body text'),
      ).rejects.not.toThrow(/ci-secret-token|27831234567|body text/);
    } finally {
      await harness.close();
    }
  });
});

async function startMockServer(handler: Handler): Promise<{
  baseUrl: string;
  requests: CapturedRequest[];
  close: () => Promise<void>;
}> {
  const requests: CapturedRequest[] = [];
  const server = createServer((request, response) => {
    const chunks: Buffer[] = [];
    request.on('data', (chunk: Buffer) => chunks.push(chunk));
    request.on('end', () => {
      const body = Buffer.concat(chunks).toString('utf8');
      requests.push({
        method: request.method,
        url: request.url,
        authorization: firstHeader(request.headers.authorization),
        contentType: firstHeader(request.headers['content-type']),
        body,
      });
      handler(request, response, body);
    });
  });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const address = server.address() as AddressInfo;
  return {
    baseUrl: `http://127.0.0.1:${address.port}`,
    requests,
    close: () =>
      new Promise<void>((resolve, reject) => {
        server.close((error) => {
          if (error) {
            reject(error);
          } else {
            resolve();
          }
        });
      }),
  };
}

function firstHeader(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}
