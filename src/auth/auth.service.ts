import {
  BadRequestException,
  Injectable,
  Logger,
  Optional,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHash, randomBytes } from 'crypto';
import { DataSource } from 'typeorm';
import { normalizeCurrency, normalizeTimezone } from '../reports/reports.math';
import {
  AuthLoginBody,
  AuthLoginResponseDto,
  AuthPrincipalContext,
} from './auth.dto';
import { verifyPassword } from './password-hasher';
import { MetricsService } from '../observability/metrics.service';

const SESSION_TOKEN_PREFIX = 'kc_sess_';
const DEFAULT_SESSION_TTL_MINUTES = 480;
const DUMMY_PASSWORD_HASH =
  'scrypt$v1$N=16384,r=8,p=1$AAAAAAAAAAAAAAAAAAAAAA$AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA';

interface PrincipalSessionRow {
  principalId: string;
  email: string;
  businessId: string;
  currency: string;
  timezone: string;
}

interface PrincipalLoginRow extends PrincipalSessionRow {
  passwordHash: string;
  status: string;
}

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly dataSource: DataSource,
    private readonly config: ConfigService,
    @Optional() private readonly metrics?: MetricsService,
  ) {}

  async login(body: AuthLoginBody): Promise<AuthLoginResponseDto> {
    const emailNormalized = normalizeEmail(body.email);
    const password = normalizePassword(body.password);
    const rows = (await this.dataSource.query(
      `
        SELECT
          id AS "principalId",
          email AS "email",
          business_id AS "businessId",
          password_hash AS "passwordHash",
          default_currency AS "currency",
          timezone AS "timezone",
          status AS "status"
        FROM auth_principals
        WHERE email_normalized = $1
        LIMIT 1
      `,
      [emailNormalized],
    )) as unknown as PrincipalLoginRow[];
    const principal = rows[0];
    const passwordMatches = await verifyPassword(
      password,
      principal?.passwordHash ?? DUMMY_PASSWORD_HASH,
    );
    if (!principal || principal.status !== 'ACTIVE' || !passwordMatches) {
      this.logger.warn('Rejected login credentials reason=invalid_credentials');
      this.metrics?.increment('kasicash_auth_failures_total', {
        reason: 'invalid_credentials',
      });
      throw new UnauthorizedException('Invalid credentials');
    }

    const token = createSessionToken();
    const tokenHash = hashSessionToken(token);
    const expiresAt = new Date(
      Date.now() + this.sessionTtlMinutes() * 60 * 1000,
    );
    await this.dataSource.query(
      `
        INSERT INTO auth_sessions (principal_id, token_hash, expires_at)
        VALUES ($1, $2, $3)
      `,
      [principal.principalId, tokenHash, expiresAt],
    );

    return {
      token,
      expiresAt: expiresAt.toISOString(),
      principal: toContext(principal),
    };
  }

  async authenticateToken(token: string): Promise<AuthPrincipalContext> {
    if (!isValidSessionToken(token)) {
      this.logger.warn('Rejected malformed or missing session token');
      this.metrics?.increment('kasicash_auth_failures_total', {
        reason: 'malformed_session',
      });
      throw new UnauthorizedException('Invalid session');
    }

    const rows = (await this.dataSource.query(
      `
        SELECT
          p.id AS "principalId",
          p.email AS "email",
          p.business_id AS "businessId",
          p.default_currency AS "currency",
          p.timezone AS "timezone"
        FROM auth_sessions s
        JOIN auth_principals p
          ON p.id = s.principal_id
        WHERE s.token_hash = $1
          AND s.revoked_at IS NULL
          AND s.expires_at > now()
          AND p.status = 'ACTIVE'
        LIMIT 1
      `,
      [hashSessionToken(token)],
    )) as unknown as PrincipalSessionRow[];
    const principal = rows[0];
    if (!principal) {
      this.logger.warn(
        'Rejected expired, revoked, unknown, or disabled session',
      );
      this.metrics?.increment('kasicash_auth_failures_total', {
        reason: 'invalid_session',
      });
      throw new UnauthorizedException('Invalid session');
    }
    return toContext(principal);
  }

  async revokeToken(token: string): Promise<void> {
    if (!isValidSessionToken(token)) return;
    await this.dataSource.query(
      `
        UPDATE auth_sessions
        SET revoked_at = now()
        WHERE token_hash = $1
          AND revoked_at IS NULL
      `,
      [hashSessionToken(token)],
    );
  }

  sessionCookieSecure(): boolean {
    const raw = this.config.get<string>('KASICASH_AUTH_COOKIE_SECURE');
    const production = this.config.get<string>('NODE_ENV') === 'production';
    if (production && raw === 'false') {
      throw new Error('Secure auth cookies cannot be disabled in production');
    }
    if (raw === 'false') return false;
    if (raw === 'true') return true;
    return production;
  }

  private sessionTtlMinutes(): number {
    const raw = Number(
      this.config.get<string>('KASICASH_AUTH_SESSION_TTL_MINUTES') ??
        DEFAULT_SESSION_TTL_MINUTES,
    );
    if (!Number.isInteger(raw) || raw < 5 || raw > 60 * 24 * 30) {
      return DEFAULT_SESSION_TTL_MINUTES;
    }
    return raw;
  }
}

export function hashSessionToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

export function createSessionToken(): string {
  return `${SESSION_TOKEN_PREFIX}${randomBytes(32).toString('base64url')}`;
}

export function isValidSessionToken(token: string): boolean {
  return (
    typeof token === 'string' &&
    token.startsWith(SESSION_TOKEN_PREFIX) &&
    token.length >= SESSION_TOKEN_PREFIX.length + 32 &&
    /^[A-Za-z0-9_-]+$/.test(token.slice(SESSION_TOKEN_PREFIX.length))
  );
}

function toContext(row: PrincipalSessionRow): AuthPrincipalContext {
  return {
    principalId: row.principalId,
    email: row.email,
    businessId: row.businessId,
    currency: normalizeCurrency(row.currency),
    timezone: normalizeTimezone(row.timezone),
  };
}

function normalizeEmail(raw: unknown): string {
  if (typeof raw !== 'string') {
    throw new BadRequestException('email is required');
  }
  const email = raw.trim().toLowerCase();
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email) || email.length > 320) {
    throw new BadRequestException('email must be valid');
  }
  return email;
}

function normalizePassword(raw: unknown): string {
  if (typeof raw !== 'string') {
    throw new BadRequestException('password is required');
  }
  if (raw.length < 12 || raw.length > 1024) {
    throw new BadRequestException('password length is invalid');
  }
  return raw;
}
