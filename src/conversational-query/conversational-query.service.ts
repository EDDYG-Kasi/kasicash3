import { Inject, Injectable, Logger } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { Account } from '../ledger/entities/account.entity';
import { ReportsService } from '../reports/reports.service';
import {
  CONVERSATIONAL_QUERY_RESOLVER,
  PeriodProposal,
  ResolvedConversationalQuery,
  classifyConversationalRoute,
} from './conversational-query.resolver';
import type { ConversationalQueryResolver } from './conversational-query.resolver';

const DEFAULT_CURRENCY = 'ZAR';
const DEFAULT_TIMEZONE = 'Africa/Johannesburg';
const MAX_PERIOD_DAYS = 366;
const MAX_RECENT_LIMIT = 5;
const STATEMENT_READ_LIMIT = 200;

export interface ConversationalQueryInput {
  businessId: string;
  textBody?: string | null;
  messageType: string;
  waTimestamp: Date;
}

export type ConversationalQueryResult =
  | {
      handled: true;
      replyBody: string;
    }
  | {
      handled: false;
      route: 'TRANSACTION' | 'FALLBACK';
    };

interface AllowedAccount {
  id: string;
  code: string;
  name: string;
  type: string;
  aliases: string[];
}

interface LocalDateParts {
  year: number;
  month: number;
  day: number;
}

interface ResolvedPeriod {
  from: string;
  to: string;
}

@Injectable()
export class ConversationalQueryService {
  private readonly logger = new Logger(ConversationalQueryService.name);

  constructor(
    private readonly dataSource: DataSource,
    private readonly reports: ReportsService,
    @Inject(CONVERSATIONAL_QUERY_RESOLVER)
    private readonly resolver: ConversationalQueryResolver,
  ) {}

  async handle(
    input: ConversationalQueryInput,
  ): Promise<ConversationalQueryResult> {
    const route = classifyConversationalRoute(
      input.textBody,
      input.messageType,
    );
    if (route !== 'QUERY') return { handled: false, route };

    const text = input.textBody?.trim() ?? '';
    let proposal: ResolvedConversationalQuery;
    try {
      proposal = await this.resolver.resolve({
        text,
        timezone: DEFAULT_TIMEZONE,
        currency: DEFAULT_CURRENCY,
        accounts: [],
      });
    } catch (err) {
      this.logger.warn(
        `Conversational query resolver failed: ${errorMessage(err)}`,
      );
      return {
        handled: true,
        replyBody:
          "I couldn't answer that question just now. Please try again in a moment.",
      };
    }

    try {
      return await this.answerProposal(input, proposal);
    } catch (err) {
      this.logger.warn(
        `Conversational query failed safely: ${errorMessage(err)}`,
      );
      return {
        handled: true,
        replyBody:
          "I couldn't answer that question safely. I can answer cash, sales and expenses, or recent transactions.",
      };
    }
  }

  private async answerProposal(
    input: ConversationalQueryInput,
    proposal: ResolvedConversationalQuery,
  ): Promise<ConversationalQueryResult> {
    switch (proposal.kind) {
      case 'NOT_QUERY':
        return { handled: false, route: 'FALLBACK' };
      case 'CLARIFY':
        return { handled: true, replyBody: sanitizeReply(proposal.question) };
      case 'OUT_OF_SCOPE':
        return {
          handled: true,
          replyBody:
            "I can't answer that yet. I can answer cash, sales and expenses for a period, or recent transactions.",
        };
      case 'CASH_BALANCE':
        return {
          handled: true,
          replyBody: await this.answerCashBalance(input, proposal.currency),
        };
      case 'INCOME_STATEMENT':
        return {
          handled: true,
          replyBody: await this.answerIncomeStatement(input, proposal),
        };
      case 'ACCOUNT_SPEND':
        return {
          handled: true,
          replyBody: await this.answerAccountSpend(input, proposal),
        };
      case 'RECENT_TRANSACTIONS':
        return {
          handled: true,
          replyBody: await this.answerRecentTransactions(input, proposal),
        };
    }
  }

  private async answerCashBalance(
    input: ConversationalQueryInput,
    currencyInput?: string,
  ): Promise<string> {
    const currency = validateCurrency(currencyInput);
    const report = await this.reports.getCashPosition({
      businessId: input.businessId,
      currency,
    });
    const suffix =
      report.netCash.amountMinor === '0'
        ? " I don't see posted cash movement yet."
        : '';
    return `You have ${report.netCash.formatted} cash right now.${suffix}`;
  }

  private async answerIncomeStatement(
    input: ConversationalQueryInput,
    proposal: Extract<
      ResolvedConversationalQuery,
      { kind: 'INCOME_STATEMENT' }
    >,
  ): Promise<string> {
    const currency = validateCurrency(proposal.currency);
    const period = resolvePeriod(proposal.period, input.waTimestamp);
    const report = await this.reports.getIncomeStatement({
      businessId: input.businessId,
      from: period.from,
      to: period.to,
      timezone: DEFAULT_TIMEZONE,
      currency,
    });

    if (
      report.revenue.amountMinor === '0' &&
      report.expenses.amountMinor === '0'
    ) {
      return `I don't see posted sales or expenses from ${period.from} to ${period.to} yet.`;
    }

    return `From ${period.from} to ${period.to}: sales ${report.revenue.formatted}, expenses ${report.expenses.formatted}, net income ${report.netIncome.formatted}.`;
  }

  private async answerAccountSpend(
    input: ConversationalQueryInput,
    proposal: Extract<ResolvedConversationalQuery, { kind: 'ACCOUNT_SPEND' }>,
  ): Promise<string> {
    const accounts = await this.loadAllowedAccounts(input.businessId);
    const account = resolveAllowedAccount(
      proposal.accountHint ?? 'expenses',
      accounts,
    );
    if (!account) return unknownAccountReply(proposal.accountHint);
    if (account.type !== 'EXPENSE' && account.code !== '500') {
      return 'Which expense account should I check? I can answer stock or expenses right now.';
    }

    const currency = validateCurrency(proposal.currency);
    const period = resolvePeriod(proposal.period, input.waTimestamp);
    const report = await this.reports.getIncomeStatement({
      businessId: input.businessId,
      from: period.from,
      to: period.to,
      timezone: DEFAULT_TIMEZONE,
      currency,
    });

    if (report.expenses.amountMinor === '0') {
      return `I don't see posted expenses from ${period.from} to ${period.to} yet.`;
    }

    return `From ${period.from} to ${period.to}, I see ${report.expenses.formatted} in expenses.`;
  }

  private async answerRecentTransactions(
    input: ConversationalQueryInput,
    proposal: Extract<
      ResolvedConversationalQuery,
      { kind: 'RECENT_TRANSACTIONS' }
    >,
  ): Promise<string> {
    const limit = validateRecentLimit(proposal.limit);
    if (limit === null) {
      return `Please ask for between 1 and ${MAX_RECENT_LIMIT} recent transactions.`;
    }

    const accounts = await this.loadAllowedAccounts(input.businessId);
    const account = resolveAllowedAccount(
      proposal.accountHint ?? 'sales',
      accounts,
    );
    if (!account) return unknownAccountReply(proposal.accountHint);

    const currency = validateCurrency(proposal.currency);
    const period = resolvePeriod(
      proposal.period ?? 'THIS_MONTH',
      input.waTimestamp,
    );
    const report = await this.reports.getAccountStatement({
      businessId: input.businessId,
      accountId: account.id,
      from: period.from,
      to: period.to,
      timezone: DEFAULT_TIMEZONE,
      currency,
      limit: STATEMENT_READ_LIMIT,
      offset: 0,
    });

    if (report.total === 0) {
      return `I don't see posted ${account.name} transactions from ${period.from} to ${period.to} yet.`;
    }
    if (report.total > report.lines.length) {
      return 'There are too many transactions in that period. Please ask for a narrower period.';
    }

    const recent = report.lines.slice(-limit).reverse();
    const lines = recent.map(
      (line) =>
        `${formatLocalDate(line.occurredAt)}: ${line.description} (${line.delta.formatted})`,
    );
    return `Last ${recent.length} ${account.name} transaction(s): ${lines.join('; ')}.`;
  }

  private async loadAllowedAccounts(
    businessId: string,
  ): Promise<AllowedAccount[]> {
    const accounts = await this.dataSource.manager.find(Account, {
      where: { businessId },
    });
    return accounts.map((account) => ({
      id: account.id,
      code: account.code,
      name: account.name,
      type: account.type,
      aliases: accountAliases(account),
    }));
  }
}

function validateCurrency(raw?: string): string {
  const currency = (raw ?? DEFAULT_CURRENCY).trim().toUpperCase();
  if (!/^[A-Z]{3}$/.test(currency)) {
    throw new Error('Invalid currency');
  }
  return currency;
}

function validateRecentLimit(raw?: number): number | null {
  const limit = Number(raw ?? MAX_RECENT_LIMIT);
  if (!Number.isInteger(limit) || limit < 1 || limit > MAX_RECENT_LIMIT) {
    return null;
  }
  return limit;
}

function resolveAllowedAccount(
  hint: string | undefined,
  accounts: AllowedAccount[],
): AllowedAccount | null {
  if (!hint) return null;
  const normalized = normalizeAlias(hint);
  return (
    accounts.find((account) => account.aliases.includes(normalized)) ?? null
  );
}

function unknownAccountReply(hint?: string): string {
  const suffix = hint ? ` for "${sanitizeReply(hint)}"` : '';
  return `Which account should I check${suffix}? I can answer cash, sales, stock, or expenses right now.`;
}

function accountAliases(account: Account): string[] {
  const aliases = new Set<string>([
    normalizeAlias(account.id),
    normalizeAlias(account.code),
    normalizeAlias(account.name),
  ]);
  if (account.code === '100') {
    aliases.add('cash');
    aliases.add('balance');
  }
  if (account.code === '400') {
    aliases.add('sale');
    aliases.add('sales');
    aliases.add('income');
    aliases.add('earned');
    aliases.add('made');
  }
  if (account.code === '500') {
    aliases.add('expense');
    aliases.add('expenses');
    aliases.add('spend');
    aliases.add('spent');
    aliases.add('stock');
  }
  return [...aliases].filter(Boolean);
}

function normalizeAlias(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function resolvePeriod(proposal: PeriodProposal, anchor: Date): ResolvedPeriod {
  if (typeof proposal === 'object') {
    const from = parseIsoDate(proposal.from, 'from');
    const to = parseIsoDate(proposal.to, 'to');
    assertSanePeriod(from, to);
    return { from: proposal.from, to: proposal.to };
  }

  const today = localDateParts(anchor, DEFAULT_TIMEZONE);
  let from: LocalDateParts;
  let to: LocalDateParts;
  switch (proposal) {
    case 'TODAY':
      from = today;
      to = today;
      break;
    case 'YESTERDAY':
      from = addDays(today, -1);
      to = from;
      break;
    case 'THIS_WEEK':
      from = startOfWeek(today);
      to = addDays(from, 6);
      break;
    case 'LAST_WEEK':
      to = addDays(startOfWeek(today), -1);
      from = addDays(to, -6);
      break;
    case 'THIS_MONTH':
      from = { year: today.year, month: today.month, day: 1 };
      to = lastDayOfMonth(today.year, today.month);
      break;
    case 'LAST_MONTH': {
      const firstThisMonth = { year: today.year, month: today.month, day: 1 };
      const lastPreviousMonth = addDays(firstThisMonth, -1);
      from = {
        year: lastPreviousMonth.year,
        month: lastPreviousMonth.month,
        day: 1,
      };
      to = lastPreviousMonth;
      break;
    }
  }

  assertSanePeriod(from, to);
  return { from: formatLocalDateParts(from), to: formatLocalDateParts(to) };
}

function parseIsoDate(value: string, field: string): LocalDateParts {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) throw new Error(`${field} must be YYYY-MM-DD`);
  const parts = {
    year: Number(match[1]),
    month: Number(match[2]),
    day: Number(match[3]),
  };
  if (formatLocalDateParts(parts) !== value) {
    throw new Error(`${field} must be a valid calendar date`);
  }
  return parts;
}

function assertSanePeriod(from: LocalDateParts, to: LocalDateParts): void {
  const fromMs = localPartsToUtcMs(from);
  const toMs = localPartsToUtcMs(to);
  if (toMs < fromMs) throw new Error('Invalid period');
  const days = (toMs - fromMs) / 86_400_000 + 1;
  if (days > MAX_PERIOD_DAYS) throw new Error('Date range is too wide');
}

function localDateParts(date: Date, timezone: string): LocalDateParts {
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  const parts = formatter.formatToParts(date);
  const lookup = new Map(parts.map((part) => [part.type, part.value]));
  return {
    year: Number(lookup.get('year')),
    month: Number(lookup.get('month')),
    day: Number(lookup.get('day')),
  };
}

function startOfWeek(parts: LocalDateParts): LocalDateParts {
  const date = new Date(localPartsToUtcMs(parts));
  const day = date.getUTCDay();
  const daysSinceMonday = day === 0 ? 6 : day - 1;
  return addDays(parts, -daysSinceMonday);
}

function lastDayOfMonth(year: number, month: number): LocalDateParts {
  const date = new Date(Date.UTC(year, month, 0));
  return {
    year: date.getUTCFullYear(),
    month: date.getUTCMonth() + 1,
    day: date.getUTCDate(),
  };
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

function localPartsToUtcMs(parts: LocalDateParts): number {
  return Date.UTC(parts.year, parts.month - 1, parts.day);
}

function formatLocalDateParts(parts: LocalDateParts): string {
  const date = new Date(localPartsToUtcMs(parts));
  return date.toISOString().slice(0, 10);
}

function formatLocalDate(isoInstant: string): string {
  return formatLocalDateParts(
    localDateParts(new Date(isoInstant), DEFAULT_TIMEZONE),
  );
}

function sanitizeReply(raw: string): string {
  return raw.replace(/\s+/g, ' ').trim().slice(0, 240);
}

function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message.slice(0, 200) : String(err);
}
