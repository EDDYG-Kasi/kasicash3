import { BadRequestException } from '@nestjs/common';
import { MoneyDto, ReportPeriodDto } from './reports.dto';
import { currencyMinorUnitScale, isSupportedCurrency } from '../money/currency';

const DEFAULT_CURRENCY = 'ZAR';
const DEFAULT_TIMEZONE = 'Africa/Johannesburg';
const DEBIT_POSITIVE_ACCOUNT_TYPES = new Set(['ASSET', 'EXPENSE']);
const CREDIT_POSITIVE_ACCOUNT_TYPES = new Set([
  'LIABILITY',
  'EQUITY',
  'REVENUE',
]);
const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;
const MONEY_INTEGER = /^-?\d+$/;
export const MAX_REPORT_PERIOD_DAYS = 366;

export function normalizeCurrency(raw?: string): string {
  const currency = (raw ?? DEFAULT_CURRENCY).trim().toUpperCase();
  if (!isSupportedCurrency(currency)) {
    throw new BadRequestException(
      'currency must be one of ZAR, USD, JPY, or BHD',
    );
  }
  return currency;
}

export function normalizeTimezone(raw?: string): string {
  const timezone = (raw ?? DEFAULT_TIMEZONE).trim();
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: timezone }).format(new Date());
  } catch {
    throw new BadRequestException('timezone must be a valid IANA timezone');
  }
  return timezone;
}

export function toMoneyDto(amountMinor: string, currency: string): MoneyDto {
  const normalized = normalizeMinorString(amountMinor);
  return {
    amountMinor: normalized,
    formatted: formatMinorAsMajor(normalized, currency),
    currency,
  };
}

export function signedEntryAmountMinor(
  accountType: string,
  entryType: string,
  amountMinor: string,
): string {
  const amount = parseMinor(amountMinor);
  if (amount < 0n) {
    throw new BadRequestException('amountMinor must be non-negative');
  }

  const debitPositive = DEBIT_POSITIVE_ACCOUNT_TYPES.has(accountType);
  const creditPositive = CREDIT_POSITIVE_ACCOUNT_TYPES.has(accountType);
  const isDebit = entryType === 'DEBIT';
  const isCredit = entryType === 'CREDIT';

  if (!debitPositive && !creditPositive) {
    throw new BadRequestException('accountType must be a ledger account type');
  }

  if (!isDebit && !isCredit) {
    throw new BadRequestException('entryType must be DEBIT or CREDIT');
  }

  const signed = debitPositive
    ? isDebit
      ? amount
      : -amount
    : isCredit
      ? amount
      : -amount;
  return signed.toString();
}

export function sumMinorStrings(values: string[]): string {
  return values.reduce((sum, value) => sum + parseMinor(value), 0n).toString();
}

export function subtractMinorStrings(left: string, right: string): string {
  return (parseMinor(left) - parseMinor(right)).toString();
}

export function computeReportPeriod(
  from: string,
  to: string,
  timezoneInput?: string,
): ReportPeriodDto {
  const timezone = normalizeTimezone(timezoneInput);
  const fromParts = parseLocalDate(from, 'from');
  const toParts = parseLocalDate(to, 'to');
  const localDayCount =
    (Date.UTC(toParts.year, toParts.month - 1, toParts.day) -
      Date.UTC(fromParts.year, fromParts.month - 1, fromParts.day)) /
      86_400_000 +
    1;
  if (localDayCount <= 0) {
    throw new BadRequestException('to must be on or after from');
  }
  if (localDayCount > MAX_REPORT_PERIOD_DAYS) {
    throw new BadRequestException(
      `report period cannot exceed ${MAX_REPORT_PERIOD_DAYS} days`,
    );
  }
  const startUtc = zonedDateTimeToUtc(fromParts, timezone);
  const endLocal = addDays(toParts, 1);
  const endUtcExclusive = zonedDateTimeToUtc(endLocal, timezone);

  return {
    fromLocalDate: from,
    toLocalDate: to,
    timezone,
    startUtc: startUtc.toISOString(),
    endUtcExclusive: endUtcExclusive.toISOString(),
  };
}

function normalizeMinorString(value: string): string {
  return parseMinor(value).toString();
}

function parseMinor(value: string): bigint {
  if (typeof value !== 'string' || !MONEY_INTEGER.test(value)) {
    throw new BadRequestException('money values must be integer strings');
  }
  return BigInt(value);
}

function formatMinorAsMajor(amountMinor: string, currency: string): string {
  if (!isSupportedCurrency(currency)) {
    throw new BadRequestException('currency is not supported');
  }
  const scale = currencyMinorUnitScale(currency);
  const amount = parseMinor(amountMinor);
  const negative = amount < 0n;
  const absolute = negative ? -amount : amount;
  const divisor = 10n ** BigInt(scale);
  const major = absolute / divisor;
  const minor = absolute % divisor;

  if (scale === 0) {
    return `${negative ? '-' : ''}${currency} ${major.toString()}`;
  }

  return `${negative ? '-' : ''}${currency} ${major.toString()}.${minor
    .toString()
    .padStart(scale, '0')}`;
}

interface LocalDateParts {
  year: number;
  month: number;
  day: number;
}

function parseLocalDate(value: string, field: string): LocalDateParts {
  const match = ISO_DATE.exec(value);
  if (!match) {
    throw new BadRequestException(`${field} must be YYYY-MM-DD`);
  }

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const roundTrip = new Date(Date.UTC(year, month - 1, day))
    .toISOString()
    .slice(0, 10);
  if (roundTrip !== value) {
    throw new BadRequestException(`${field} must be a valid calendar date`);
  }

  return { year, month, day };
}

function addDays(parts: LocalDateParts, days: number): LocalDateParts {
  const date = new Date(
    Date.UTC(parts.year, parts.month - 1, parts.day + days),
  );
  return {
    year: date.getUTCFullYear(),
    month: date.getUTCMonth() + 1,
    day: date.getUTCDate(),
  };
}

function zonedDateTimeToUtc(parts: LocalDateParts, timezone: string): Date {
  const localAsUtcMs = Date.UTC(
    parts.year,
    parts.month - 1,
    parts.day,
    0,
    0,
    0,
  );
  let candidate = new Date(localAsUtcMs);
  let offset = getTimezoneOffsetMs(candidate, timezone);
  candidate = new Date(localAsUtcMs - offset);
  offset = getTimezoneOffsetMs(candidate, timezone);
  return new Date(localAsUtcMs - offset);
}

function getTimezoneOffsetMs(date: Date, timezone: string): number {
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  });
  const parts = formatter.formatToParts(date);
  const lookup = new Map(parts.map((part) => [part.type, part.value]));
  const asUtc = Date.UTC(
    Number(lookup.get('year')),
    Number(lookup.get('month')) - 1,
    Number(lookup.get('day')),
    Number(lookup.get('hour')),
    Number(lookup.get('minute')),
    Number(lookup.get('second')),
  );
  return asUtc - date.getTime();
}
