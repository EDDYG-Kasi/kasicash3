import {
  hashForTelemetry,
  sanitizeTelemetryFields,
} from './telemetry-logger.service';

describe('telemetry sanitization', () => {
  it('redacts secrets and omits private financial content', () => {
    const sanitized = sanitizeTelemetryFields({
      password: 'pass-123',
      accessToken: 'token-123',
      authorization: 'Bearer token-123',
      cookie: 'kasicash_session=abc',
      nested: {
        rawBody: '{"text":"sold stock R30"}',
        payload: { text: 'spent R20 stock' },
        textBody: 'sold airtime R30',
        waFrom: '27831234567',
        phone: '+27831234567',
        email: 'owner@example.com',
        amountMinor: '3000',
        formatted: 'R30.00',
        figure: 'profit R30.00',
        safeRoute: '/reports/balances',
      },
      method: 'POST',
      route: '/reports/balances',
      error: 'owner@example.com spent R30 token=secret',
      detail: '27831234567',
    });

    expect(sanitized).toMatchObject({
      password: '[REDACTED]',
      accessToken: '[REDACTED]',
      authorization: '[REDACTED]',
      cookie: '[REDACTED]',
      nested: '[OMITTED]',
      method: 'POST',
      route: '/reports/balances',
      error: '[OMITTED]',
      detail: '[OMITTED]',
    });
    expect(JSON.stringify(sanitized)).not.toContain('token-123');
    expect(JSON.stringify(sanitized)).not.toContain('27831234567');
    expect(JSON.stringify(sanitized)).not.toContain('R30.00');
    expect(JSON.stringify(sanitized)).not.toContain('spent R20 stock');
  });

  it('bounds strings and omits bigint values', () => {
    const long = 'x'.repeat(300);
    const sanitized = sanitizeTelemetryFields({
      message: long,
      ledgerMinorUnits: 3000n,
    }) as Record<string, unknown>;

    expect(sanitized.message).toBe('[OMITTED]');
    expect(sanitized.ledgerMinorUnits).toBe('[OMITTED]');
  });

  it('hashes identifiers without exposing their raw value', () => {
    const hashed = hashForTelemetry('business-secret-id');
    expect(hashed).toHaveLength(16);
    expect(hashed).not.toBe('business-secret-id');
    expect(hashForTelemetry('business-secret-id')).toBe(hashed);
  });
});
