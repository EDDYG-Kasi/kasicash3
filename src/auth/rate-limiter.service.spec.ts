import { HttpException, HttpStatus } from '@nestjs/common';
import { SecurityRateLimiterService } from './rate-limiter.service';

describe('SecurityRateLimiterService', () => {
  it('allows requests until the configured window limit is exceeded', async () => {
    const limiter = new SecurityRateLimiterService();

    await limiter.assertAllowed('key', 2, 60_000);
    await limiter.assertAllowed('key', 2, 60_000);

    await expect(limiter.assertAllowed('key', 2, 60_000)).rejects.toThrow(
      HttpException,
    );
    try {
      await limiter.assertAllowed('key', 2, 60_000);
    } catch (error) {
      expect((error as HttpException).getStatus()).toBe(
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
  });

  it('tracks rate windows per key', async () => {
    const limiter = new SecurityRateLimiterService();

    await limiter.assertAllowed('tenant-a', 1, 60_000);

    await expect(
      limiter.assertAllowed('tenant-b', 1, 60_000),
    ).resolves.toBeUndefined();
    await expect(limiter.assertAllowed('tenant-a', 1, 60_000)).rejects.toThrow(
      HttpException,
    );
  });

  it('uses one shared database bucket without storing the raw key', async () => {
    const query = jest
      .fn<Promise<Array<{ count: number }>>, [string, unknown[]]>()
      .mockResolvedValue([{ count: 1 }]);
    const limiter = new SecurityRateLimiterService({
      isInitialized: true,
      query,
    } as never);

    await limiter.assertAllowed('owner@example.com', 10, 60_000);

    const params = query.mock.calls[0][1];
    expect(params[0]).toMatch(/^[0-9a-f]{64}$/);
    expect(params[0]).not.toContain('owner@example.com');
    expect(params[1]).toBe(60_000);
    expect(params[1]).not.toBeInstanceOf(Date);
    expect(query.mock.calls[0][0]).toContain(
      "now() + ($2::bigint * interval '1 millisecond')",
    );
  });

  it('rejects invalid limits and windows before selecting a backend clock', async () => {
    const limiter = new SecurityRateLimiterService();
    await expect(limiter.assertAllowed('key', 0, 1000)).rejects.toThrow(
      'positive safe integer',
    );
    await expect(limiter.assertAllowed('key', 1, 0)).rejects.toThrow(
      'positive safe integer',
    );
  });
});
