import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Request } from 'express';
import { AuthPrincipalContext } from './auth.dto';
import { AuthService } from './auth.service';

const COOKIE_NAME = 'kasicash_session';

export interface AuthenticatedRequest extends Request {
  authPrincipal?: AuthPrincipalContext;
  authToken?: string;
}

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(private readonly auth: AuthService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const token = extractSessionToken(request);
    const principal = await this.auth.authenticateToken(token);
    request.authToken = token;
    request.authPrincipal = principal;
    return true;
  }
}

export function requireAuthPrincipal(
  request: AuthenticatedRequest,
): AuthPrincipalContext {
  if (!request.authPrincipal) {
    throw new Error('Auth guard did not attach a principal');
  }
  return request.authPrincipal;
}

export function extractSessionToken(request: Request): string {
  const authorization = request.headers.authorization;
  if (authorization?.startsWith('Bearer ')) {
    return authorization.slice('Bearer '.length).trim();
  }

  const cookieToken = parseCookieHeader(request.headers.cookie)[COOKIE_NAME];
  if (cookieToken) return cookieToken;
  return '';
}

export function buildSessionCookie(
  token: string,
  expiresAt: string,
  secure: boolean,
): string {
  const expires = new Date(expiresAt).toUTCString();
  const maxAge = Math.max(
    0,
    Math.floor((new Date(expiresAt).getTime() - Date.now()) / 1000),
  );
  return [
    `${COOKIE_NAME}=${encodeURIComponent(token)}`,
    'HttpOnly',
    'SameSite=Strict',
    'Path=/',
    `Expires=${expires}`,
    `Max-Age=${maxAge}`,
    secure ? 'Secure' : '',
  ]
    .filter(Boolean)
    .join('; ');
}

export function clearSessionCookie(secure: boolean): string {
  return [
    `${COOKIE_NAME}=`,
    'HttpOnly',
    'SameSite=Strict',
    'Path=/',
    'Expires=Thu, 01 Jan 1970 00:00:00 GMT',
    'Max-Age=0',
    secure ? 'Secure' : '',
  ]
    .filter(Boolean)
    .join('; ');
}

function parseCookieHeader(raw?: string): Record<string, string> {
  if (!raw) return {};
  return raw.split(';').reduce<Record<string, string>>((cookies, part) => {
    const [name, ...valueParts] = part.trim().split('=');
    if (!name || valueParts.length === 0) return cookies;
    cookies[name] = decodeURIComponent(valueParts.join('='));
    return cookies;
  }, {});
}
