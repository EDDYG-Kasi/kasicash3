import { ForbiddenException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ReportsController } from './reports.controller';
import { ReportsService } from './reports.service';

describe('ReportsController', () => {
  it('keeps caller-selected tenant report routes disabled by default', () => {
    const getCashPosition = jest.fn();
    const reports = {
      getCashPosition,
    } as unknown as ReportsService;
    const config = { get: jest.fn().mockReturnValue(undefined) };
    const controller = new ReportsController(
      reports,
      config as unknown as ConfigService,
    );

    expect(() =>
      controller.getCashPosition({ businessId: 'business-from-client' }),
    ).toThrow(ForbiddenException);
    expect(getCashPosition).not.toHaveBeenCalled();
  });

  it('allows explicit report-route enablement for controlled environments', () => {
    const getCashPosition = jest.fn().mockReturnValue({ ok: true });
    const reports = {
      getCashPosition,
    } as unknown as ReportsService;
    const config = {
      get: (key: string) =>
        key === 'KASICASH_REPORT_ROUTES' ? 'true' : undefined,
    };
    const controller = new ReportsController(
      reports,
      config as unknown as ConfigService,
    );

    expect(controller.getCashPosition({ businessId: 'b-1' })).toEqual({
      ok: true,
    });
    expect(getCashPosition).toHaveBeenCalledWith({
      businessId: 'b-1',
      currency: undefined,
    });
  });
});
