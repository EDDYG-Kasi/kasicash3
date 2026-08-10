import { UnauthorizedException } from '@nestjs/common';
import type { ExecutionContext } from '@nestjs/common';
import {
  AuthGuard,
  buildSessionCookie,
  clearSessionCookie,
  extractSessionToken,
} from './auth.guard';
import type { AuthService } from './auth.service';

describe('AuthGuard', () => {
  const principal = {
    principalId: 'principal-1',
    email: 'owner@example.com',
    businessId: 'business-1',
    currency: 'ZAR',
    timezone: 'Africa/Johannesburg',
  };

  it('authenticates bearer tokens and attaches the principal to the request', async () => {
    const authenticateToken = jest.fn().mockResolvedValue(principal);
    const auth = {
      authenticateToken,
    } as unknown as AuthService;
    const request = {
      headers: { authorization: 'Bearer kc_sess_token' },
    } as never;
    const guard = new AuthGuard(auth);

    await expect(guard.canActivate(contextFor(request))).resolves.toBe(true);
    expect(authenticateToken).toHaveBeenCalledWith('kc_sess_token');
    expect(request).toMatchObject({
      authToken: 'kc_sess_token',
      authPrincipal: principal,
    });
  });

  it('supports HttpOnly session cookies for browser dashboard requests', () => {
    expect(
      extractSessionToken({
        headers: {
          cookie: 'theme=light; kasicash_session=kc_sess_cookie_token',
        },
      } as never),
    ).toBe('kc_sess_cookie_token');
  });

  it('propagates auth failures and leaves the request unauthenticated', async () => {
    const auth = {
      authenticateToken: jest
        .fn()
        .mockRejectedValue(new UnauthorizedException()),
    } as unknown as AuthService;
    const request = { headers: {} } as never;
    const guard = new AuthGuard(auth);

    await expect(guard.canActivate(contextFor(request))).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
    expect(request).not.toHaveProperty('authPrincipal');
  });

  it('builds secure session cookies without exposing client-side JavaScript access', () => {
    const expiresAt = new Date(Date.now() + 60_000).toISOString();

    expect(buildSessionCookie('kc_sess_token', expiresAt, true)).toContain(
      'HttpOnly; SameSite=Strict; Path=/',
    );
    expect(buildSessionCookie('kc_sess_token', expiresAt, true)).toContain(
      'Secure',
    );
    expect(clearSessionCookie(false)).toContain('Max-Age=0');
  });
});

function contextFor(request: never): ExecutionContext {
  return {
    switchToHttp: () => ({
      getRequest: () => request,
    }),
  } as unknown as ExecutionContext;
}
