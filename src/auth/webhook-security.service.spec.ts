import type { ConfigService } from '@nestjs/config';
import { WebhookSecurityService } from './webhook-security.service';

describe('WebhookSecurityService', () => {
  it('checks replay state by payload hash rather than raw payload bytes', async () => {
    const query = jest.fn().mockResolvedValue([{ ok: 1 }]);
    const service = new WebhookSecurityService({ query } as never, config());

    await expect(
      service.wasAcceptedRecently(Buffer.from('{"hello":"world"}')),
    ).resolves.toBe(true);
    const calls = query.mock.calls as Array<[string, [string]]>;
    const params = calls[0][1];
    expect(params[0]).toMatch(/^[0-9a-f]{64}$/);
    expect(params[0]).not.toContain('hello');
  });

  it('records accepted deliveries with hashed payload and signature values', async () => {
    const query = jest.fn().mockResolvedValue([]);
    const service = new WebhookSecurityService(
      { query } as never,
      config({ KASICASH_WEBHOOK_REPLAY_TTL_SECONDS: '300' }),
    );

    await service.recordAccepted(
      Buffer.from('{"hello":"world"}'),
      'sha256=abc123',
    );

    const calls = query.mock.calls as Array<[string, [string, string, number]]>;
    const params = calls[0][1];
    expect(calls[0][0]).toContain('ON CONFLICT (payload_hash) DO UPDATE');
    expect(calls[0][0]).toContain('expires_at <= now()');
    expect(params[0]).toMatch(/^[0-9a-f]{64}$/);
    expect(params[1]).toMatch(/^[0-9a-f]{64}$/);
    expect(params[2]).toBe(300);
    expect(calls[0][0]).toContain("now() + ($3::bigint * interval '1 second')");
  });

  it('bounds configurable raw body size and falls back to safe defaults', () => {
    expect(
      new WebhookSecurityService(
        { query: jest.fn() } as never,
        config({ KASICASH_WEBHOOK_MAX_RAW_BYTES: '4096' }),
      ).maxRawBodyBytes(),
    ).toBe(4096);
    expect(
      new WebhookSecurityService(
        { query: jest.fn() } as never,
        config({ KASICASH_WEBHOOK_MAX_RAW_BYTES: '1' }),
      ).maxRawBodyBytes(),
    ).toBe(262144);
  });
});

function config(values: Record<string, string> = {}): ConfigService {
  return {
    get: (key: string) => values[key],
  } as unknown as ConfigService;
}
