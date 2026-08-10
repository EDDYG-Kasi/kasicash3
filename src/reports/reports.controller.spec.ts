import { ReportsController, parseIntegerQuery } from './reports.controller';
import { ReportsService } from './reports.service';
import type { AuthenticatedRequest } from '../auth/auth.guard';

describe('ReportsController', () => {
  it('uses the authenticated principal for cash-position tenant scoping', () => {
    const getCashPosition = jest.fn().mockReturnValue({ ok: true });
    const reports = {
      getCashPosition,
    } as unknown as ReportsService;
    const controller = new ReportsController(reports);

    expect(controller.getCashPosition(authRequest())).toEqual({ ok: true });
    expect(getCashPosition).toHaveBeenCalledWith({
      businessId: 'trusted-business',
      currency: 'ZAR',
    });
  });

  it('ignores caller-supplied tenant, currency, and timezone fields on period reports', () => {
    const getIncomeStatement = jest.fn().mockReturnValue({ ok: true });
    const reports = {
      getIncomeStatement,
    } as unknown as ReportsService;
    const controller = new ReportsController(reports);

    expect(
      controller.getIncomeStatement(authRequest(), {
        businessId: 'attacker-business',
        currency: 'USD',
        timezone: 'UTC',
        from: '2026-07-01',
        to: '2026-07-31',
      } as never),
    ).toEqual({
      ok: true,
    });
    expect(getIncomeStatement).toHaveBeenCalledWith({
      businessId: 'trusted-business',
      currency: 'ZAR',
      timezone: 'Africa/Johannesburg',
      from: '2026-07-01',
      to: '2026-07-31',
    });
  });

  it('rejects scientific, infinite, fractional, and malformed pagination', () => {
    for (const value of ['1e2', 'Infinity', '1.5', '-1', ' 2', '2x']) {
      expect(() => parseIntegerQuery(value, 'offset')).toThrow(
        'offset must be a base-10 integer',
      );
    }
  });
});

function authRequest(): AuthenticatedRequest {
  return {
    authPrincipal: {
      principalId: 'principal-1',
      email: 'owner@example.com',
      businessId: 'trusted-business',
      currency: 'ZAR',
      timezone: 'Africa/Johannesburg',
    },
  } as AuthenticatedRequest;
}
