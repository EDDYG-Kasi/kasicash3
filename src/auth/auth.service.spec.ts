import { BadRequestException, UnauthorizedException } from '@nestjs/common';
import type { ConfigService } from '@nestjs/config';
import {
  AuthService,
  createSessionToken,
  hashSessionToken,
} from './auth.service';
import { hashPassword } from './password-hasher';

describe('AuthService', () => {
  it('logs in an active principal, stores only the session-token hash, and returns principal context', async () => {
    const passwordHash = await hashPassword('correct horse battery');
    const query = jest.fn((sql: string, params: unknown[]) => {
      if (sql.includes('FROM auth_principals')) {
        expect(params).toEqual(['owner@example.com']);
        return Promise.resolve([
          {
            principalId: 'principal-1',
            email: 'Owner@Example.com',
            businessId: 'business-1',
            passwordHash,
            currency: 'zar',
            timezone: 'Africa/Johannesburg',
            status: 'ACTIVE',
          },
        ]);
      }
      if (sql.includes('INSERT INTO auth_sessions')) {
        return Promise.resolve([]);
      }
      return Promise.reject(new Error(`Unexpected SQL: ${sql}`));
    });
    const auth = new AuthService(
      { query } as never,
      config({ KASICASH_AUTH_SESSION_TTL_MINUTES: '30' }),
    );

    const result = await auth.login({
      email: ' Owner@Example.com ',
      password: 'correct horse battery',
    });

    expect(result.token).toMatch(/^kc_sess_/);
    expect(result.principal).toEqual({
      principalId: 'principal-1',
      email: 'Owner@Example.com',
      businessId: 'business-1',
      currency: 'ZAR',
      timezone: 'Africa/Johannesburg',
    });
    const calls = query.mock.calls as Array<[string, unknown[]]>;
    const insertCall = calls.find(([sql]) =>
      String(sql).includes('INSERT INTO auth_sessions'),
    );
    expect(insertCall).toBeDefined();
    const insertParams = insertCall?.[1] as [string, string, Date];
    expect(insertParams[0]).toBe('principal-1');
    expect(insertParams[1]).toBe(hashSessionToken(result.token));
    expect(insertParams[1]).not.toContain(result.token);
    expect(insertParams[2]).toBeInstanceOf(Date);
  });

  it('rejects invalid credentials without creating a session', async () => {
    const passwordHash = await hashPassword('correct horse battery');
    const query = jest.fn((sql: string) =>
      Promise.resolve(
        sql.includes('FROM auth_principals')
          ? [
              {
                principalId: 'principal-1',
                email: 'owner@example.com',
                businessId: 'business-1',
                passwordHash,
                currency: 'ZAR',
                timezone: 'Africa/Johannesburg',
                status: 'ACTIVE',
              },
            ]
          : [],
      ),
    );
    const auth = new AuthService({ query } as never, config());

    await expect(
      auth.login({
        email: 'owner@example.com',
        password: 'wrong horse battery',
      }),
    ).rejects.toBeInstanceOf(UnauthorizedException);
    expect(
      query.mock.calls.some(([sql]) =>
        String(sql).includes('INSERT INTO auth_sessions'),
      ),
    ).toBe(false);
  });

  it('rejects an unknown principal through the same credential path', async () => {
    const query = jest.fn().mockResolvedValue([]);
    const auth = new AuthService({ query } as never, config());

    await expect(
      auth.login({
        email: 'unknown@example.com',
        password: 'wrong horse battery',
      }),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('cannot disable secure cookies in production', () => {
    const auth = new AuthService(
      { query: jest.fn() } as never,
      config({ NODE_ENV: 'production', KASICASH_AUTH_COOKIE_SECURE: 'false' }),
    );

    expect(() => auth.sessionCookieSecure()).toThrow(
      'Secure auth cookies cannot be disabled in production',
    );
  });

  it('fails closed on malformed login input', async () => {
    const auth = new AuthService({ query: jest.fn() } as never, config());

    await expect(
      auth.login({ email: 'not-an-email', password: 'correct horse battery' }),
    ).rejects.toBeInstanceOf(BadRequestException);
    await expect(
      auth.login({ email: 'owner@example.com', password: 'short' }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('authenticates only non-revoked, non-expired sessions and returns the bound business', async () => {
    const token = createSessionToken();
    const query = jest.fn((_sql: string, params: unknown[]) => {
      expect(params).toEqual([hashSessionToken(token)]);
      return Promise.resolve([
        {
          principalId: 'principal-1',
          email: 'owner@example.com',
          businessId: 'business-1',
          currency: 'ZAR',
          timezone: 'Africa/Johannesburg',
        },
      ]);
    });
    const auth = new AuthService({ query } as never, config());

    await expect(auth.authenticateToken(token)).resolves.toEqual({
      principalId: 'principal-1',
      email: 'owner@example.com',
      businessId: 'business-1',
      currency: 'ZAR',
      timezone: 'Africa/Johannesburg',
    });
  });

  it('rejects invalid, expired, revoked, or disabled sessions', async () => {
    const token = createSessionToken();
    const auth = new AuthService(
      { query: jest.fn().mockResolvedValue([]) } as never,
      config(),
    );

    await expect(
      auth.authenticateToken('not-a-session'),
    ).rejects.toBeInstanceOf(UnauthorizedException);
    await expect(auth.authenticateToken(token)).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });

  it('revokes a valid token by hash and ignores malformed tokens', async () => {
    const query = jest.fn().mockResolvedValue([]);
    const auth = new AuthService({ query } as never, config());
    const token = createSessionToken();

    await auth.revokeToken(token);
    await auth.revokeToken('not-a-session');

    expect(query).toHaveBeenCalledTimes(1);
    const calls = query.mock.calls as Array<[string, unknown[]]>;
    expect(calls[0][1]).toEqual([hashSessionToken(token)]);
  });
});

function config(values: Record<string, string> = {}): ConfigService {
  return {
    get: (key: string) => values[key],
  } as unknown as ConfigService;
}
