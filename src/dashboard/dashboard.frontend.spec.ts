import { DashboardOverviewDto } from './dashboard.dto';
import {
  dashboardClientScript,
  dashboardHtml,
  renderDashboardMarkup,
} from './dashboard.frontend';

describe('dashboard front end renderer', () => {
  it('renders South African money display from service DTO strings without exposing raw minor units', () => {
    const html = renderDashboardMarkup(sampleDashboard());

    expect(html).toContain('You sold R 7 777.77 this period');
    expect(html).toContain('kept R 6 666.66 after costs');
    expect(html).toContain('Sales R 7 777.77');
    expect(html).toContain('Costs R 1 111.11');
    expect(html).toContain('Profit R 6 666.66');
    expect(html).toContain('R 8 888.88');
    expect(html).toContain('-R 180.00');
    expect(html).toContain('name="from"');
    expect(html).toContain('name="accountId"');
    expect(html).toContain('Quick date ranges');
    expect(html).toContain('statement-mobile');
    expect(html).toContain('Cash after R 100.00');
    expect(html).toContain('>1W<');
    expect(html).toContain('>1M<');
    expect(html).toContain('>3M<');
    expect(html).toContain('>1Y<');
    expect(html).toContain('100.0%');
    expect(html).toContain(
      '1</strong><span class="caption">100 money movements',
    );
    expect(html).toContain('30 Jul');
    expect(html).not.toContain('ZAR DISPLAY');
    expect(html).not.toContain('ZAR 7777.77');
    expect(html).not.toContain('ZAR -180.00');
    expect(html).not.toContain('123456789');
    expect(html).not.toContain('777777');
  });

  it('renders an empty-state for a new business without posted dashboard data', () => {
    const html = renderDashboardMarkup(emptyDashboard());

    expect(html).toContain('No posted activity yet.');
    expect(html).toContain('No cash accounts yet.');
    expect(html).toContain('No unusual activity to check right now.');
  });

  it('does not render internal phase labels or debug wording in the trader UI', () => {
    const html = renderDashboardMarkup(sampleDashboard());

    expect(html).not.toContain('P4');
    expect(html).not.toContain('P6');
    expect(html).not.toContain('P7');
    expect(html).not.toContain('Read-only trader dashboard');
    expect(html).not.toContain('Bucket');
    expect(html).not.toContain('Delta');
    expect(html).not.toContain('Running');
    expect(html).not.toContain('statement lines');
  });

  it('uses the KasiCash brand sheet colors and lockup in the shell', () => {
    const html = dashboardHtml();

    expect(html).toContain('#00c853');
    expect(html).toContain('#0e0e0e');
    expect(html).toContain('#f7f6f1');
    expect(html).toContain('kc-mark-c');
    expect(html).toContain('Simple to run. Easy to grow.');
    expect(html).toContain('dashboard-topbar');
    expect(html).toContain('.statement-mobile');
  });

  it('keeps the browser script free of client-side money parsing helpers', () => {
    const script = dashboardClientScript();

    expect(script).not.toContain('parseFloat');
    expect(script).not.toContain('amountMinor');
    expect(script).not.toContain('.toFixed');
    expect(script).not.toContain('Number(');
  });
});

function sampleDashboard(): DashboardOverviewDto {
  const money = (amountMinor: string, formatted: string) => ({
    amountMinor,
    formatted,
    currency: 'ZAR',
  });

  return {
    generatedAt: '2026-07-30T10:00:00.000Z',
    tenant: {
      businessId: 'business-1',
      currency: 'ZAR',
      timezone: 'Africa/Johannesburg',
      authBoundary: 'PHASE_9_AUTHENTICATED_PRINCIPAL',
      productionReady: true,
    },
    period: {
      from: '2026-07-01',
      to: '2026-07-30',
      granularity: 'day',
      limit: 20,
      offset: 0,
      asOfLocalDate: '2026-07-30',
      accountId: 'cash-1',
    },
    kpis: {
      transactionCount: 1,
      transactionCountLabel: '100 money movements',
    },
    cashPosition: {
      businessId: 'business-1',
      currency: 'ZAR',
      generatedAt: '2026-07-30T10:00:00.000Z',
      netCash: money('123456789', 'ZAR 1234567.89'),
      accounts: [
        {
          accountId: 'cash-1',
          code: '100',
          name: 'Cash',
          type: 'ASSET',
          isCash: true,
          balance: money('123456789', 'ZAR 1234567.89'),
        },
      ],
    },
    incomeStatement: {
      businessId: 'business-1',
      currency: 'ZAR',
      generatedAt: '2026-07-30T10:00:00.000Z',
      period: {
        fromLocalDate: '2026-07-01',
        toLocalDate: '2026-07-30',
        timezone: 'Africa/Johannesburg',
        startUtc: '2026-06-30T22:00:00.000Z',
        endUtcExclusive: '2026-07-30T22:00:00.000Z',
      },
      revenue: money('777777', 'ZAR 7777.77'),
      expenses: money('111111', 'ZAR 1111.11'),
      netIncome: money('666666', 'ZAR 6666.66'),
    },
    accountStatement: {
      businessId: 'business-1',
      accountId: 'cash-1',
      accountCode: '100',
      accountName: 'Cash',
      accountType: 'ASSET',
      currency: 'ZAR',
      generatedAt: '2026-07-30T10:00:00.000Z',
      period: {
        fromLocalDate: '2026-07-01',
        toLocalDate: '2026-07-30',
        timezone: 'Africa/Johannesburg',
        startUtc: '2026-06-30T22:00:00.000Z',
        endUtcExclusive: '2026-07-30T22:00:00.000Z',
      },
      openingBalance: money('0', 'ZAR 0.00'),
      limit: 20,
      offset: 0,
      total: 1,
      lines: [
        {
          transactionId: 'tx-1',
          occurredAt: '2026-07-30T08:00:00.000Z',
          postedAt: '2026-07-30T08:00:01.000Z',
          description: 'Sale',
          delta: money('10000', 'ZAR 100.00'),
          runningBalance: money('10000', 'ZAR 100.00'),
        },
        {
          transactionId: 'tx-2',
          occurredAt: '2026-07-29T08:00:00.000Z',
          postedAt: '2026-07-29T08:00:01.000Z',
          description: 'Stock bought',
          delta: money('-18000', 'ZAR -180.00'),
          runningBalance: money('-8000', 'ZAR -80.00'),
        },
      ],
    },
    analytics: {
      cashBalance: {
        businessId: 'business-1',
        currency: 'ZAR',
        generatedAt: '2026-07-30T10:00:00.000Z',
        period: {
          fromLocalDate: '2026-07-01',
          toLocalDate: '2026-07-30',
          timezone: 'Africa/Johannesburg',
          startUtc: '2026-06-30T22:00:00.000Z',
          endUtcExclusive: '2026-07-30T22:00:00.000Z',
        },
        granularity: 'day',
        points: [
          {
            label: '2026-07-29',
            bucketStartLocal: '2026-07-29',
            bucketStartUtc: '2026-07-28T22:00:00.000Z',
            bucketEndUtcExclusive: '2026-07-29T22:00:00.000Z',
            cashDelta: money('5000', 'ZAR 50.00'),
            cashBalance: money('5000', 'ZAR 50.00'),
          },
          {
            label: '2026-07-30',
            bucketStartLocal: '2026-07-30',
            bucketStartUtc: '2026-07-29T22:00:00.000Z',
            bucketEndUtcExclusive: '2026-07-30T22:00:00.000Z',
            cashDelta: money('10000', 'ZAR 100.00'),
            cashBalance: money('123456789', 'ZAR 1234567.89'),
          },
        ],
      },
      incomeVsExpenses: {
        businessId: 'business-1',
        currency: 'ZAR',
        generatedAt: '2026-07-30T10:00:00.000Z',
        period: {
          fromLocalDate: '2026-07-01',
          toLocalDate: '2026-07-30',
          timezone: 'Africa/Johannesburg',
          startUtc: '2026-06-30T22:00:00.000Z',
          endUtcExclusive: '2026-07-30T22:00:00.000Z',
        },
        granularity: 'day',
        points: [
          {
            label: '2026-07-29',
            bucketStartLocal: '2026-07-29',
            bucketStartUtc: '2026-07-28T22:00:00.000Z',
            bucketEndUtcExclusive: '2026-07-29T22:00:00.000Z',
            revenue: money('5000', 'ZAR 50.00'),
            expenses: money('0', 'ZAR 0.00'),
            netIncome: money('5000', 'ZAR 50.00'),
          },
          {
            label: '2026-07-30',
            bucketStartLocal: '2026-07-30',
            bucketStartUtc: '2026-07-29T22:00:00.000Z',
            bucketEndUtcExclusive: '2026-07-30T22:00:00.000Z',
            revenue: money('777777', 'ZAR 7777.77'),
            expenses: money('111111', 'ZAR 1111.11'),
            netIncome: money('666666', 'ZAR 6666.66'),
          },
        ],
      },
      spendByAccount: {
        businessId: 'business-1',
        currency: 'ZAR',
        generatedAt: '2026-07-30T10:00:00.000Z',
        period: {
          fromLocalDate: '2026-07-01',
          toLocalDate: '2026-07-30',
          timezone: 'Africa/Johannesburg',
          startUtc: '2026-06-30T22:00:00.000Z',
          endUtcExclusive: '2026-07-30T22:00:00.000Z',
        },
        totalExpenses: money('111111', 'ZAR 1111.11'),
        accounts: [
          {
            accountId: 'expense-1',
            accountCode: '500',
            accountName: 'Stock',
            expense: money('111111', 'ZAR 1111.11'),
          },
          {
            accountId: 'expense-2',
            accountCode: '510',
            accountName: 'Airtime',
            expense: money('5000', 'ZAR 50.00'),
          },
        ],
      },
      chartScales: {
        cashBalance: [
          { label: '2026-07-29', valuePermille: 10, valuePercent: '1.0' },
          { label: '2026-07-30', valuePermille: 1000, valuePercent: '100.0' },
        ],
        incomeVsExpenses: [
          {
            label: '2026-07-29',
            valuePermille: 6,
            valuePercent: '0.6',
            secondaryValuePermille: 0,
            secondaryValuePercent: '0.0',
          },
          {
            label: '2026-07-30',
            valuePermille: 1000,
            valuePercent: '100.0',
            secondaryValuePermille: 500,
            secondaryValuePercent: '50.0',
          },
        ],
        spendByAccount: [
          { label: '500 Stock', valuePermille: 1000, valuePercent: '100.0' },
          { label: '510 Airtime', valuePermille: 45, valuePercent: '4.5' },
        ],
      },
    },
    anomalies: {
      items: [
        {
          key: 'anomaly-key',
          type: 'LARGE_EXPENSE',
          severity: 'WARNING',
          businessId: 'business-1',
          currency: 'ZAR',
          timezone: 'Africa/Johannesburg',
          detectedAt: '2026-07-30T10:00:00.000Z',
          title: 'Large expense',
          summary: 'Large expense detected',
          explanation: 'Rule based',
          period: {
            fromLocalDate: '2026-07-30',
            toLocalDate: '2026-07-30',
          },
          figures: [
            {
              label: 'Expense',
              value: money('888888', 'ZAR 8888.88'),
            },
          ],
          metadata: {},
        },
      ],
      alertStatuses: [],
    },
  };
}

function emptyDashboard(): DashboardOverviewDto {
  const dashboard = sampleDashboard();
  dashboard.cashPosition.accounts = [];
  dashboard.cashPosition.netCash = {
    amountMinor: '0',
    formatted: 'ZAR 0.00',
    currency: 'ZAR',
  };
  dashboard.incomeStatement.revenue = {
    amountMinor: '0',
    formatted: 'ZAR 0.00',
    currency: 'ZAR',
  };
  dashboard.incomeStatement.expenses = {
    amountMinor: '0',
    formatted: 'ZAR 0.00',
    currency: 'ZAR',
  };
  dashboard.incomeStatement.netIncome = {
    amountMinor: '0',
    formatted: 'ZAR 0.00',
    currency: 'ZAR',
  };
  dashboard.accountStatement = null;
  dashboard.kpis = {
    transactionCount: 0,
    transactionCountLabel: 'No account selected',
  };
  dashboard.analytics.cashBalance.points = [];
  dashboard.analytics.incomeVsExpenses.points = [];
  dashboard.analytics.spendByAccount.accounts = [];
  dashboard.analytics.spendByAccount.totalExpenses = {
    amountMinor: '0',
    formatted: 'ZAR 0.00',
    currency: 'ZAR',
  };
  dashboard.analytics.chartScales = {
    cashBalance: [],
    incomeVsExpenses: [],
    spendByAccount: [],
  };
  dashboard.anomalies.items = [];
  dashboard.anomalies.alertStatuses = [];
  return dashboard;
}
