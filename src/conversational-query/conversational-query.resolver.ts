import { isProxy } from 'node:util/types';

export const CONVERSATIONAL_QUERY_RESOLVER = Symbol(
  'CONVERSATIONAL_QUERY_RESOLVER',
);

export type ConversationalQueryKind =
  | 'NOT_QUERY'
  | 'CLARIFY'
  | 'OUT_OF_SCOPE'
  | 'CASH_BALANCE'
  | 'INCOME_STATEMENT'
  | 'ACCOUNT_SPEND'
  | 'RECENT_TRANSACTIONS';

export type PeriodProposal =
  | 'TODAY'
  | 'YESTERDAY'
  | 'THIS_WEEK'
  | 'LAST_WEEK'
  | 'THIS_MONTH'
  | 'LAST_MONTH'
  | { from: string; to: string };

export type ResolvedConversationalQuery =
  | { kind: 'NOT_QUERY' }
  | { kind: 'CLARIFY'; reason: 'QUERY_TYPE' | 'PERIOD' | 'ACCOUNT' }
  | {
      kind: 'OUT_OF_SCOPE';
      reason: 'UNSUPPORTED' | 'UNSAFE_INSTRUCTIONS';
    }
  | { kind: 'CASH_BALANCE'; currency?: string }
  | {
      kind: 'INCOME_STATEMENT';
      period: PeriodProposal;
      currency?: string;
    }
  | {
      kind: 'ACCOUNT_SPEND';
      accountHint?: string;
      period: PeriodProposal;
      currency?: string;
    }
  | {
      kind: 'RECENT_TRANSACTIONS';
      accountHint?: string;
      limit?: number;
      period?: PeriodProposal;
      currency?: string;
    };

export interface ResolverAccountOption {
  code: string;
  name: string;
  type: string;
}

export interface ConversationalQueryResolverInput {
  text: string;
  timezone: string;
  currency: string;
  accounts: ResolverAccountOption[];
}

export interface ConversationalQueryResolver {
  resolve(input: ConversationalQueryResolverInput): Promise<unknown>;
}

export class HeuristicConversationalQueryResolver implements ConversationalQueryResolver {
  resolve(
    input: ConversationalQueryResolverInput,
  ): Promise<ResolvedConversationalQuery> {
    return Promise.resolve(resolveHeuristic(input));
  }
}

function resolveHeuristic(
  input: ConversationalQueryResolverInput,
): ResolvedConversationalQuery {
  const normalized = normalizeText(input.text);
  if (!normalized) return { kind: 'NOT_QUERY' };

  if (hasPromptInjectionShape(normalized)) {
    return {
      kind: 'OUT_OF_SCOPE',
      reason: 'UNSAFE_INSTRUCTIONS',
    };
  }

  const period = detectPeriod(normalized);
  const accountHint = detectAccountHint(normalized);
  const limit = detectLimit(normalized);

  if (isRecentQuery(normalized)) {
    return {
      kind: 'RECENT_TRANSACTIONS',
      accountHint: accountHint ?? 'sales',
      limit,
      period: period ?? 'THIS_MONTH',
    };
  }

  if (isCashBalanceQuery(normalized)) {
    return { kind: 'CASH_BALANCE' };
  }

  if (isSpendQuery(normalized)) {
    return {
      kind: 'ACCOUNT_SPEND',
      accountHint: accountHint ?? 'expenses',
      period: period ?? 'THIS_MONTH',
    };
  }

  if (isIncomeQuery(normalized)) {
    return {
      kind: 'INCOME_STATEMENT',
      period: period ?? 'THIS_MONTH',
    };
  }

  if (isQueryLike(normalized)) {
    return {
      kind: 'CLARIFY',
      reason: 'QUERY_TYPE',
    };
  }

  return { kind: 'NOT_QUERY' };
}

export function validateResolvedConversationalQuery(
  value: unknown,
): ResolvedConversationalQuery {
  const result = ownDataRecord(value);
  if (typeof result.kind !== 'string') {
    throw new Error('Invalid resolver result');
  }
  switch (result.kind) {
    case 'NOT_QUERY':
      assertExactKeys(result, ['kind']);
      return { kind: 'NOT_QUERY' };
    case 'CLARIFY': {
      assertExactKeys(result, ['kind', 'reason']);
      const reason = result.reason;
      if (
        reason !== 'QUERY_TYPE' &&
        reason !== 'PERIOD' &&
        reason !== 'ACCOUNT'
      ) {
        throw new Error('Invalid clarification reason');
      }
      return { kind: 'CLARIFY', reason };
    }
    case 'OUT_OF_SCOPE': {
      assertExactKeys(result, ['kind', 'reason']);
      const reason = result.reason;
      if (reason !== 'UNSUPPORTED' && reason !== 'UNSAFE_INSTRUCTIONS') {
        throw new Error('Invalid out-of-scope reason');
      }
      return { kind: 'OUT_OF_SCOPE', reason };
    }
    case 'CASH_BALANCE': {
      assertExactKeys(result, ['kind', 'currency']);
      const currency = optionalBoundedString(result.currency, 3);
      return currency === undefined
        ? { kind: 'CASH_BALANCE' }
        : { kind: 'CASH_BALANCE', currency };
    }
    case 'INCOME_STATEMENT': {
      assertExactKeys(result, ['kind', 'period', 'currency']);
      const period = normalizePeriod(result.period);
      const currency = optionalBoundedString(result.currency, 3);
      return currency === undefined
        ? { kind: 'INCOME_STATEMENT', period }
        : { kind: 'INCOME_STATEMENT', period, currency };
    }
    case 'ACCOUNT_SPEND': {
      assertExactKeys(result, ['kind', 'accountHint', 'period', 'currency']);
      const accountHint = optionalBoundedString(result.accountHint, 100);
      const period = normalizePeriod(result.period);
      const currency = optionalBoundedString(result.currency, 3);
      return compactOptionalFields({
        kind: 'ACCOUNT_SPEND' as const,
        accountHint,
        period,
        currency,
      });
    }
    case 'RECENT_TRANSACTIONS': {
      assertExactKeys(result, [
        'kind',
        'accountHint',
        'limit',
        'period',
        'currency',
      ]);
      const accountHint = optionalBoundedString(result.accountHint, 100);
      const currency = optionalBoundedString(result.currency, 3);
      const limit = result.limit;
      if (
        limit !== undefined &&
        (typeof limit !== 'number' || !Number.isSafeInteger(limit))
      ) {
        throw new Error('Invalid query limit');
      }
      const period =
        result.period === undefined
          ? undefined
          : normalizePeriod(result.period);
      return compactOptionalFields({
        kind: 'RECENT_TRANSACTIONS' as const,
        accountHint,
        limit,
        period,
        currency,
      });
    }
    default:
      throw new Error('Unsupported resolver result');
  }
}

function normalizePeriod(value: unknown): PeriodProposal {
  if (
    typeof value === 'string' &&
    [
      'TODAY',
      'YESTERDAY',
      'THIS_WEEK',
      'LAST_WEEK',
      'THIS_MONTH',
      'LAST_MONTH',
    ].includes(value)
  ) {
    return value as PeriodProposal;
  }
  const period = ownDataRecord(value);
  assertExactKeys(period, ['from', 'to']);
  if (isLocalDate(period.from) && isLocalDate(period.to)) {
    return { from: period.from, to: period.to };
  }
  throw new Error('Invalid query period');
}

function optionalBoundedString(
  value: unknown,
  maximumLength: number,
): string | undefined {
  if (value === undefined) return undefined;
  if (
    typeof value !== 'string' ||
    value.length < 1 ||
    value.length > maximumLength
  ) {
    throw new Error('Invalid resolver string');
  }
  return value;
}

function assertExactKeys(
  value: Record<string, unknown>,
  allowed: string[],
): void {
  if (Object.keys(value).some((key) => !allowed.includes(key))) {
    throw new Error('Resolver result contained unexpected fields');
  }
}

function ownDataRecord(value: unknown): Record<string, unknown> {
  if (
    value === null ||
    typeof value !== 'object' ||
    Array.isArray(value) ||
    isProxy(value)
  ) {
    throw new Error('Invalid resolver object');
  }
  const prototype = Reflect.getPrototypeOf(value);
  if (prototype !== Object.prototype && prototype !== null) {
    throw new Error('Resolver result must be a plain object');
  }
  const keys = Reflect.ownKeys(value);
  if (keys.some((key) => typeof key === 'symbol')) {
    throw new Error('Resolver result contained symbol fields');
  }
  const descriptors = Object.getOwnPropertyDescriptors(value);
  const copy: Record<string, unknown> = Object.create(null) as Record<
    string,
    unknown
  >;
  for (const key of keys as string[]) {
    const descriptor = descriptors[key];
    if (!descriptor?.enumerable || !('value' in descriptor)) {
      throw new Error(
        'Resolver result must contain own enumerable data fields',
      );
    }
    copy[key] = descriptor.value;
  }
  return copy;
}

function compactOptionalFields<T extends Record<string, unknown>>(value: T): T {
  return Object.fromEntries(
    Object.entries(value).filter(([, field]) => field !== undefined),
  ) as T;
}

function isLocalDate(value: unknown): value is string {
  return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value);
}

export type MessageRoute = 'QUERY' | 'TRANSACTION' | 'FALLBACK';

export function classifyConversationalRoute(
  textBody?: string | null,
  messageType = 'text',
): MessageRoute {
  if (messageType !== 'text' || !textBody?.trim()) return 'FALLBACK';
  const normalized = normalizeText(textBody);
  if (isQueryLike(normalized)) return 'QUERY';
  if (isTransactionLike(normalized)) return 'TRANSACTION';
  return 'FALLBACK';
}

function normalizeText(raw: string): string {
  return raw
    .toLowerCase()
    .replace(/[^\p{L}\p{N}.,?\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function isQueryLike(normalized: string): boolean {
  return (
    /\?/.test(normalized) ||
    /^(how|what|whats|what's|show|tell|give|do i|did i)\b/.test(normalized) ||
    /\b(how much|balance|recent|last\s+\d+|cash do i have|did i make|what did i make)\b/.test(
      normalized,
    ) ||
    (/\b(this week|last week|this month|last month|today|yesterday)\b/.test(
      normalized,
    ) &&
      /\b(make|made|earn|earned|income|sales|spend|spent|expenses|stock)\b/.test(
        normalized,
      )) ||
    (hasPromptInjectionShape(normalized) &&
      /\b(cash|sales|income|expenses|stock|balance|tenant|business)\b/.test(
        normalized,
      ))
  );
}

function isTransactionLike(normalized: string): boolean {
  return (
    /\b(r|zar)\s*[0-9]/.test(normalized) &&
    /\b(sold|sale|sales|received|income|earned|spent|bought|buy|expense|expenses|paid)\b/.test(
      normalized,
    )
  );
}

function isCashBalanceQuery(normalized: string): boolean {
  return /\b(cash|balance)\b/.test(normalized);
}

function isIncomeQuery(normalized: string): boolean {
  return /\b(make|made|earn|earned|income|sales|profit)\b/.test(normalized);
}

function isSpendQuery(normalized: string): boolean {
  return /\b(spend|spent|expenses|expense|stock)\b/.test(normalized);
}

function isRecentQuery(normalized: string): boolean {
  return /\b(recent|last\s+\d+)\b/.test(normalized);
}

function detectAccountHint(normalized: string): string | undefined {
  if (/\b(cash|balance)\b/.test(normalized)) return 'cash';
  if (/\b(sale|sales|income|earned|made)\b/.test(normalized)) return 'sales';
  if (/\b(expense|expenses|spend|spent|stock)\b/.test(normalized)) {
    return 'expenses';
  }
  return undefined;
}

function detectLimit(normalized: string): number | undefined {
  const match = /\blast\s+(\d{1,3})\b/.exec(normalized);
  return match ? Number(match[1]) : undefined;
}

function detectPeriod(normalized: string): PeriodProposal | undefined {
  if (/\byesterday\b/.test(normalized)) return 'YESTERDAY';
  if (/\btoday\b/.test(normalized)) return 'TODAY';
  if (/\blast\s+week\b/.test(normalized)) return 'LAST_WEEK';
  if (/\bthis\s+week\b/.test(normalized)) return 'THIS_WEEK';
  if (/\blast\s+month\b/.test(normalized)) return 'LAST_MONTH';
  if (/\bthis\s+month\b/.test(normalized)) return 'THIS_MONTH';
  return undefined;
}

function hasPromptInjectionShape(normalized: string): boolean {
  return /\b(ignore|override|system|developer|tenant|another business|other business|other tenant|insert|update|delete|drop|write|post|create transaction|fabricate|make up|pretend|say i have|read another)\b/.test(
    normalized,
  );
}
