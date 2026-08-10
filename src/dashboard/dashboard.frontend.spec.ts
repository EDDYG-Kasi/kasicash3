import { DashboardOverviewDto } from './dashboard.dto';
import {
  dashboardClientScript,
  renderDashboardMarkup,
} from './dashboard.frontend';

describe('dashboard front end renderer', () => {
  it('renders formatted money strings from the DTO without exposing raw minor units', () => {
    const html = renderDashboardMarkup(sampleDashboard());

    expect(html).toContain('ZAR DISPLAY CASH');
    expect(html).toContain('ZAR DISPLAY REVENUE');
    expect(html).toContain('ZAR DISPLAY ALERT');
    expect(html).not.toContain('123456789');
    expect(html).not.toContain('777777');
  });

  it('keeps the browser script free of client-side money parsing helpers', () => {
    const script = dashboardClientScript();

    expect(script).not.toContain('parseFloat');
    expect(script).not.toContain('amountMinor');
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
    },
    cashPosition: {
      businessId: 'business-1',
      currency: 'ZAR',
      generatedAt: '2026-07-30T10:00:00.000Z',
      netCash: money('123456789', 'ZAR DISPLAY CASH'),
      accounts: [
        {
          accountId: 'cash-1',
          code: '100',
          name: 'Cash',
          type: 'ASSET',
          isCash: true,
          balance: money('123456789', 'ZAR DISPLAY CASH'),
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
      revenue: money('777777', 'ZAR DISPLAY REVENUE'),
      expenses: money('111111', 'ZAR DISPLAY EXPENSES'),
      netIncome: money('666666', 'ZAR DISPLAY NET'),
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
          delta: money('10000', 'ZAR DISPLAY DELTA'),
          runningBalance: money('10000', 'ZAR DISPLAY RUNNING'),
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
        points: [],
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
        points: [],
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
        totalExpenses: money('111111', 'ZAR DISPLAY EXPENSES'),
        accounts: [],
      },
      chartScales: {
        cashBalance: [{ label: '2026-07-30', valuePermille: 1000 }],
        incomeVsExpenses: [
          {
            label: '2026-07-30',
            valuePermille: 1000,
            secondaryValuePermille: 500,
          },
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
              value: money('888888', 'ZAR DISPLAY ALERT'),
            },
          ],
          metadata: {},
        },
      ],
      alertStatuses: [],
    },
  };
}
