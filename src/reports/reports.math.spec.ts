import { AccountType } from '../ledger/entities/account.entity';
import {
  computeReportPeriod,
  signedEntryAmountMinor,
  sumMinorStrings,
  toMoneyDto,
} from './reports.math';

describe('reports math', () => {
  it('maps debit and credit sides by account type', () => {
    expect(signedEntryAmountMinor(AccountType.ASSET, 'DEBIT', '1250')).toBe(
      '1250',
    );
    expect(signedEntryAmountMinor(AccountType.ASSET, 'CREDIT', '1250')).toBe(
      '-1250',
    );
    expect(signedEntryAmountMinor(AccountType.REVENUE, 'CREDIT', '1250')).toBe(
      '1250',
    );
    expect(signedEntryAmountMinor(AccountType.REVENUE, 'DEBIT', '1250')).toBe(
      '-1250',
    );
  });

  it('nets a reversed posted transaction to zero with its posted reversal', () => {
    const rows = [
      {
        businessId: 'b-1',
        status: 'REVERSED',
        accountType: AccountType.ASSET,
        entryType: 'DEBIT',
        amountMinor: '3000',
      },
      {
        businessId: 'b-1',
        status: 'POSTED',
        accountType: AccountType.ASSET,
        entryType: 'CREDIT',
        amountMinor: '3000',
      },
    ];

    expect(projectRows(rows, 'b-1')).toBe('0');
  });

  it('excludes unconfirmed rows and other tenants from report math', () => {
    const rows = [
      {
        businessId: 'b-1',
        status: 'POSTED',
        accountType: AccountType.ASSET,
        entryType: 'DEBIT',
        amountMinor: '1000',
      },
      {
        businessId: 'b-1',
        status: 'POSTING',
        accountType: AccountType.ASSET,
        entryType: 'DEBIT',
        amountMinor: '9999',
      },
      {
        businessId: 'b-1',
        status: 'PROPOSED',
        accountType: AccountType.ASSET,
        entryType: 'DEBIT',
        amountMinor: '9999',
      },
      {
        businessId: 'b-2',
        status: 'POSTED',
        accountType: AccountType.ASSET,
        entryType: 'DEBIT',
        amountMinor: '7777',
      },
    ];

    expect(projectRows(rows, 'b-1')).toBe('1000');
  });

  it('computes Africa/Johannesburg local date bounds as UTC instants', () => {
    const period = computeReportPeriod(
      '2026-07-06',
      '2026-07-06',
      'Africa/Johannesburg',
    );

    expect(period.startUtc).toBe('2026-07-05T22:00:00.000Z');
    expect(period.endUtcExclusive).toBe('2026-07-06T22:00:00.000Z');
  });

  it('formats minor-unit strings without floats', () => {
    expect(toMoneyDto('-12345', 'ZAR')).toEqual({
      amountMinor: '-12345',
      formatted: '-ZAR 123.45',
      currency: 'ZAR',
    });
  });
});

function projectRows(
  rows: {
    businessId: string;
    status: string;
    accountType: AccountType;
    entryType: string;
    amountMinor: string;
  }[],
  businessId: string,
): string {
  return sumMinorStrings(
    rows
      .filter((row) => row.businessId === businessId)
      .filter((row) => row.status === 'POSTED' || row.status === 'REVERSED')
      .map((row) =>
        signedEntryAmountMinor(row.accountType, row.entryType, row.amountMinor),
      ),
  );
}
