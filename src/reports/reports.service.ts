import {
  BadRequestException,
  Injectable,
  NotFoundException,
  Optional,
} from '@nestjs/common';
import { DataSource, QueryRunner } from 'typeorm';
import {
  AccountStatementInput,
  AccountStatementReportDto,
  CashPositionInput,
  CashPositionReportDto,
  IncomeStatementInput,
  IncomeStatementReportDto,
} from './reports.dto';
import {
  computeReportPeriod,
  normalizeCurrency,
  subtractMinorStrings,
  sumMinorStrings,
  toMoneyDto,
} from './reports.math';
import { MetricsService } from '../observability/metrics.service';

const MAX_STATEMENT_LIMIT = 200;
const DEFAULT_STATEMENT_LIMIT = 50;
const MAX_STATEMENT_OFFSET = 10_000;

const SIGNED_ENTRY_SQL = `
  CASE
    WHEN a.type IN ('ASSET', 'EXPENSE') AND e.type = 'DEBIT' THEN e.amount_minor
    WHEN a.type IN ('ASSET', 'EXPENSE') AND e.type = 'CREDIT' THEN -e.amount_minor
    WHEN a.type IN ('LIABILITY', 'EQUITY', 'REVENUE') AND e.type = 'CREDIT' THEN e.amount_minor
    WHEN a.type IN ('LIABILITY', 'EQUITY', 'REVENUE') AND e.type = 'DEBIT' THEN -e.amount_minor
    ELSE 0
  END
`;

interface AccountBalanceRow {
  accountId: string;
  code: string;
  name: string;
  type: string;
  isCash: boolean;
  balanceMinor: string;
}

interface IncomeStatementRow {
  revenueMinor: string;
  expensesMinor: string;
}

interface AccountRow {
  id: string;
  code: string;
  name: string;
  type: string;
}

interface StatementCountRow {
  total: string;
}

interface StatementOpeningRow {
  openingBalanceMinor: string;
}

interface StatementLineRow {
  transactionId: string;
  occurredAt: Date;
  postedAt: Date;
  description: string;
  deltaMinor: string;
  runningBalanceMinor: string;
}

@Injectable()
export class ReportsService {
  constructor(
    private readonly dataSource: DataSource,
    @Optional() private readonly metrics?: MetricsService,
  ) {}

  async getCashPosition(
    input: CashPositionInput,
  ): Promise<CashPositionReportDto> {
    const startedAt = Date.now();
    const currency = normalizeCurrency(input.currency);

    try {
      return await this.withReadOnlyQueryRunner(async (queryRunner) => {
        const rows = (await queryRunner.query(
          `
            SELECT
              a.id AS "accountId",
              a.code AS "code",
              a.name AS "name",
              a.type AS "type",
              (a.code = '100' OR a.code LIKE '100.%') AS "isCash",
              COALESCE(
                SUM(
                  CASE
                    WHEN t.id IS NULL THEN 0
                    ELSE ${SIGNED_ENTRY_SQL}
                  END
                ),
                0
              )::text AS "balanceMinor"
            FROM accounts a
            LEFT JOIN entries e
              ON e.business_id = a.business_id
             AND e.account_id = a.id
            LEFT JOIN transactions t
              ON t.business_id = e.business_id
             AND t.id = e.transaction_id
             AND t.status IN ('POSTED', 'REVERSED')
             AND t.currency = $2
            WHERE a.business_id = $1
            GROUP BY a.id, a.code, a.name, a.type
            ORDER BY a.code ASC, a.name ASC, a.id ASC
          `,
          [input.businessId, currency],
        )) as AccountBalanceRow[];

        const accounts = rows.map((row) => ({
          accountId: row.accountId,
          code: row.code,
          name: row.name,
          type: row.type,
          isCash: Boolean(row.isCash),
          balance: toMoneyDto(row.balanceMinor, currency),
        }));
        const netCashMinor = sumMinorStrings(
          rows
            .filter((row) => Boolean(row.isCash))
            .map((row) => row.balanceMinor),
        );

        return {
          businessId: input.businessId,
          currency,
          generatedAt: new Date().toISOString(),
          netCash: toMoneyDto(netCashMinor, currency),
          accounts,
        };
      });
    } finally {
      this.recordReportLatency('cash_position', startedAt);
    }
  }

  async getIncomeStatement(
    input: IncomeStatementInput,
  ): Promise<IncomeStatementReportDto> {
    const startedAt = Date.now();
    const currency = normalizeCurrency(input.currency);
    const period = computeReportPeriod(input.from, input.to, input.timezone);

    try {
      return await this.withReadOnlyQueryRunner(async (queryRunner) => {
        const rows = (await queryRunner.query(
          `
          SELECT
            COALESCE(
              SUM(
                CASE
                  WHEN a.code = '400' OR a.code LIKE '400.%' THEN ${SIGNED_ENTRY_SQL}
                  ELSE 0
                END
              ),
              0
            )::text AS "revenueMinor",
            COALESCE(
              SUM(
                CASE
                  WHEN a.code = '500' OR a.code LIKE '500.%' THEN ${SIGNED_ENTRY_SQL}
                  ELSE 0
                END
              ),
              0
            )::text AS "expensesMinor"
          FROM entries e
          JOIN accounts a
            ON a.business_id = e.business_id
           AND a.id = e.account_id
          JOIN transactions t
            ON t.business_id = e.business_id
           AND t.id = e.transaction_id
          WHERE e.business_id = $1
            AND t.status IN ('POSTED', 'REVERSED')
            AND t.currency = $2
            AND t.occurred_at >= $3
            AND t.occurred_at < $4
        `,
          [
            input.businessId,
            currency,
            new Date(period.startUtc),
            new Date(period.endUtcExclusive),
          ],
        )) as IncomeStatementRow[];

        const row = rows[0] ?? { revenueMinor: '0', expensesMinor: '0' };
        const netIncomeMinor = subtractMinorStrings(
          row.revenueMinor,
          row.expensesMinor,
        );

        return {
          businessId: input.businessId,
          currency,
          generatedAt: new Date().toISOString(),
          period,
          revenue: toMoneyDto(row.revenueMinor, currency),
          expenses: toMoneyDto(row.expensesMinor, currency),
          netIncome: toMoneyDto(netIncomeMinor, currency),
        };
      });
    } finally {
      this.recordReportLatency('income_statement', startedAt);
    }
  }

  async getAccountStatement(
    input: AccountStatementInput,
  ): Promise<AccountStatementReportDto> {
    const startedAt = Date.now();
    const currency = normalizeCurrency(input.currency);
    const period = computeReportPeriod(input.from, input.to, input.timezone);
    const limit = normalizeLimit(input.limit);
    const offset = normalizeOffset(input.offset);

    try {
      return await this.withReadOnlyQueryRunner(async (queryRunner) => {
        const account = await this.findBusinessAccount(
          queryRunner,
          input.businessId,
          input.accountId,
        );

        const countRows = (await queryRunner.query(
          `
          SELECT COUNT(*)::text AS "total"
          FROM (
            SELECT t.id
            FROM entries e
            JOIN transactions t
              ON t.business_id = e.business_id
             AND t.id = e.transaction_id
            WHERE e.business_id = $1
              AND e.account_id = $2
              AND t.status IN ('POSTED', 'REVERSED')
              AND t.currency = $3
              AND t.occurred_at >= $4
              AND t.occurred_at < $5
            GROUP BY t.id
          ) tx
        `,
          [
            input.businessId,
            input.accountId,
            currency,
            new Date(period.startUtc),
            new Date(period.endUtcExclusive),
          ],
        )) as StatementCountRow[];

        const openingRows = (await queryRunner.query(
          `
          SELECT COALESCE(SUM(${SIGNED_ENTRY_SQL}), 0)::text AS "openingBalanceMinor"
          FROM entries e
          JOIN accounts a
            ON a.business_id = e.business_id
           AND a.id = e.account_id
          JOIN transactions t
            ON t.business_id = e.business_id
           AND t.id = e.transaction_id
          WHERE e.business_id = $1
            AND e.account_id = $2
            AND t.status IN ('POSTED', 'REVERSED')
            AND t.currency = $3
            AND t.occurred_at < $4
        `,
          [
            input.businessId,
            input.accountId,
            currency,
            new Date(period.startUtc),
          ],
        )) as StatementOpeningRow[];

        const openingBalanceMinor =
          openingRows[0]?.openingBalanceMinor?.toString() ?? '0';

        const lineRows = (await queryRunner.query(
          `
          WITH account_tx AS (
            SELECT
              t.id AS "transactionId",
              t.occurred_at AS "occurredAt",
              t.posted_at AS "postedAt",
              t.description AS "description",
              COALESCE(SUM(${SIGNED_ENTRY_SQL}), 0) AS "deltaMinor"
            FROM entries e
            JOIN accounts a
              ON a.business_id = e.business_id
             AND a.id = e.account_id
            JOIN transactions t
              ON t.business_id = e.business_id
             AND t.id = e.transaction_id
            WHERE e.business_id = $1
              AND e.account_id = $2
              AND t.status IN ('POSTED', 'REVERSED')
              AND t.currency = $3
              AND t.occurred_at >= $4
              AND t.occurred_at < $5
            GROUP BY t.id, t.occurred_at, t.posted_at, t.description
          ),
          running AS (
            SELECT
              "transactionId",
              "occurredAt",
              "postedAt",
              "description",
              "deltaMinor",
              ($6::numeric + SUM("deltaMinor") OVER (
                ORDER BY "occurredAt" ASC, "postedAt" ASC, "transactionId" ASC
              )) AS "runningBalanceMinor"
            FROM account_tx
          )
          SELECT
            "transactionId",
            "occurredAt",
            "postedAt",
            "description",
            "deltaMinor"::text AS "deltaMinor",
            "runningBalanceMinor"::text AS "runningBalanceMinor"
          FROM running
          ORDER BY "occurredAt" ASC, "postedAt" ASC, "transactionId" ASC
          LIMIT $7 OFFSET $8
        `,
          [
            input.businessId,
            input.accountId,
            currency,
            new Date(period.startUtc),
            new Date(period.endUtcExclusive),
            openingBalanceMinor,
            limit,
            offset,
          ],
        )) as StatementLineRow[];

        return {
          businessId: input.businessId,
          accountId: input.accountId,
          accountCode: account.code,
          accountName: account.name,
          accountType: account.type,
          currency,
          generatedAt: new Date().toISOString(),
          period,
          openingBalance: toMoneyDto(openingBalanceMinor, currency),
          limit,
          offset,
          total: Number(countRows[0]?.total ?? 0),
          lines: lineRows.map((row) => ({
            transactionId: row.transactionId,
            occurredAt: row.occurredAt.toISOString(),
            postedAt: row.postedAt.toISOString(),
            description: row.description,
            delta: toMoneyDto(row.deltaMinor, currency),
            runningBalance: toMoneyDto(row.runningBalanceMinor, currency),
          })),
        };
      });
    } finally {
      this.recordReportLatency('account_statement', startedAt);
    }
  }

  private recordReportLatency(report: string, startedAt: number): void {
    this.metrics?.observe(
      'kasicash_report_latency_ms',
      Date.now() - startedAt,
      {
        report,
      },
    );
  }

  private async findBusinessAccount(
    queryRunner: QueryRunner,
    businessId: string,
    accountId: string,
  ): Promise<AccountRow> {
    const rows = (await queryRunner.query(
      `
        SELECT id, code, name, type
        FROM accounts
        WHERE business_id = $1
          AND id = $2
        LIMIT 1
      `,
      [businessId, accountId],
    )) as AccountRow[];
    const account = rows[0];
    if (!account) {
      throw new NotFoundException('Account not found for business');
    }
    return account;
  }

  private async withReadOnlyQueryRunner<T>(
    callback: (queryRunner: QueryRunner) => Promise<T>,
  ): Promise<T> {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();
    try {
      await queryRunner.query('SET TRANSACTION READ ONLY');
      const result = await callback(queryRunner);
      await queryRunner.commitTransaction();
      return result;
    } catch (err) {
      if (queryRunner.isTransactionActive) {
        await queryRunner.rollbackTransaction().catch(() => undefined);
      }
      throw err;
    } finally {
      if (!queryRunner.isReleased) await queryRunner.release();
    }
  }
}

function normalizeLimit(raw?: number): number {
  const value = Number(raw ?? DEFAULT_STATEMENT_LIMIT);
  if (!Number.isInteger(value) || value < 1 || value > MAX_STATEMENT_LIMIT) {
    throw new BadRequestException(
      `limit must be an integer from 1 to ${MAX_STATEMENT_LIMIT}`,
    );
  }
  return value;
}

function normalizeOffset(raw?: number): number {
  const value = Number(raw ?? 0);
  if (!Number.isInteger(value) || value < 0 || value > MAX_STATEMENT_OFFSET) {
    throw new BadRequestException(
      `offset must be an integer from 0 to ${MAX_STATEMENT_OFFSET}`,
    );
  }
  return value;
}
