import { CorrelationService } from './correlation.service';

describe('CorrelationService', () => {
  it('accepts safe incoming request IDs and rejects unsafe ones', () => {
    const correlation = new CorrelationService();

    expect(correlation.resolveIncoming('req-safe_123456')).toBe(
      'req-safe_123456',
    );
    const generated = correlation.resolveIncoming('bad\nheader');

    expect(generated).toMatch(/^req_[A-Za-z0-9_-]+$/);
    expect(generated).not.toContain('\n');
  });

  it('propagates the current correlation ID through async work', async () => {
    const correlation = new CorrelationService();

    await correlation.runWithId('req-test-1234', async () => {
      await Promise.resolve();
      expect(correlation.currentId()).toBe('req-test-1234');
    });
    expect(correlation.currentId()).toBeUndefined();
  });
});
