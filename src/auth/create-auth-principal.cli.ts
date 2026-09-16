import AppDataSource from '../database/data-source';
import { hashPassword } from './password-hasher';

interface CliOptions {
  email: string;
  password: string;
  businessId: string;
  currency: string;
  timezone: string;
}

const USAGE = `Usage:
  npm run auth:create-principal -- --email owner@example.com --password "long-password" --business-id BUSINESS_UUID [--currency ZAR] [--timezone Africa/Johannesburg]

Creates one dashboard/API auth principal for an existing business. This writes
only auth metadata and never writes ledger transactions or entries.`;

async function main(): Promise<void> {
  const options = parseOptions(process.argv.slice(2));
  await AppDataSource.initialize();
  try {
    const business = (await AppDataSource.query(
      `SELECT id FROM businesses WHERE id = $1 LIMIT 1`,
      [options.businessId],
    )) as unknown as Array<{ id: string }>;
    if (business.length !== 1) {
      throw new Error('business not found');
    }

    const existing = (await AppDataSource.query(
      `SELECT id FROM auth_principals WHERE email_normalized = $1 LIMIT 1`,
      [options.email],
    )) as unknown as Array<{ id: string }>;
    if (existing.length > 0) {
      throw new Error('auth principal email already exists');
    }

    const passwordHash = await hashPassword(options.password);
    const rows = (await AppDataSource.query(
      `
        INSERT INTO auth_principals (
          business_id,
          email,
          email_normalized,
          password_hash,
          status,
          default_currency,
          timezone
        )
        VALUES ($1, $2, $3, $4, 'ACTIVE', $5, $6)
        RETURNING id
      `,
      [
        options.businessId,
        options.email,
        options.email,
        passwordHash,
        options.currency,
        options.timezone,
      ],
    )) as unknown as Array<{ id: string }>;

    console.log(
      `created auth principal principal_id=${
        rows[0]?.id ?? 'unknown'
      } business_id=${options.businessId}`,
    );
  } finally {
    await AppDataSource.destroy();
  }
}

function parseOptions(args: string[]): CliOptions {
  if (args.includes('--help') || args.includes('-h')) {
    console.log(USAGE);
    process.exit(0);
  }
  return {
    email: normalizeEmail(requireArg(args, '--email')),
    password: normalizePassword(requireArg(args, '--password')),
    businessId: normalizeUuid(requireArg(args, '--business-id')),
    currency: normalizeCurrency(optionalArg(args, '--currency') ?? 'ZAR'),
    timezone: normalizeTimezone(
      optionalArg(args, '--timezone') ?? 'Africa/Johannesburg',
    ),
  };
}

function requireArg(args: string[], flag: string): string {
  const value = optionalArg(args, flag);
  if (!value) {
    console.error(USAGE);
    throw new Error(`${flag} is required`);
  }
  return value;
}

function optionalArg(args: string[], flag: string): string | undefined {
  const index = args.indexOf(flag);
  if (index === -1) return undefined;
  const value = args[index + 1];
  return value && !value.startsWith('--') ? value : undefined;
}

function normalizeEmail(raw: string): string {
  const email = raw.trim().toLowerCase();
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email) || email.length > 320) {
    throw new Error('email must be valid');
  }
  return email;
}

function normalizePassword(raw: string): string {
  if (raw.length < 12 || raw.length > 1024) {
    throw new Error('password length must be between 12 and 1024 characters');
  }
  return raw;
}

function normalizeUuid(raw: string): string {
  const value = raw.trim().toLowerCase();
  if (
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(
      value,
    )
  ) {
    throw new Error('business id must be a UUID');
  }
  return value;
}

function normalizeCurrency(raw: string): string {
  const value = raw.trim().toUpperCase();
  if (!/^[A-Z]{3}$/.test(value)) {
    throw new Error('currency must be a three-letter ISO code');
  }
  return value;
}

function normalizeTimezone(raw: string): string {
  const value = raw.trim();
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: value }).format(new Date());
    return value;
  } catch {
    throw new Error('timezone must be a valid IANA timezone');
  }
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : 'unknown error';
  console.error(
    `create principal failed error_code=AUTH_PRINCIPAL_CREATE_FAILED reason=${message}`,
  );
  process.exit(1);
});
