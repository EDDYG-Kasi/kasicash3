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
  | { kind: 'CLARIFY'; question: string }
  | { kind: 'OUT_OF_SCOPE'; reason: string }
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
  resolve(
    input: ConversationalQueryResolverInput,
  ): Promise<ResolvedConversationalQuery>;
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
      reason: 'Unsafe query instructions are not supported',
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
      question:
        'Do you want your cash balance, sales and expenses for a period, or recent transactions?',
    };
  }

  return { kind: 'NOT_QUERY' };
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
