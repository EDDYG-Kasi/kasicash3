import {
  BadRequestException,
  Controller,
  ForbiddenException,
  Get,
  Param,
  Query,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ReportsService } from './reports.service';

interface CashPositionQuery {
  businessId?: string;
  currency?: string;
}

interface PeriodQuery extends CashPositionQuery {
  from?: string;
  to?: string;
  timezone?: string;
}

interface StatementQuery extends PeriodQuery {
  limit?: string;
  offset?: string;
}

/**
 * Phase 4 read-only report routes. Disabled by default: the constitution does
 * not permit tenant selection from untrusted request input in production.
 */
@Controller('reports')
export class ReportsController {
  constructor(
    private readonly reports: ReportsService,
    private readonly config: ConfigService,
  ) {}

  @Get('balances')
  getCashPosition(@Query() query: CashPositionQuery) {
    this.assertReportRoutesEnabled();
    return this.reports.getCashPosition({
      businessId: requireQuery(query.businessId, 'businessId'),
      currency: query.currency,
    });
  }

  @Get('income-statement')
  getIncomeStatement(@Query() query: PeriodQuery) {
    this.assertReportRoutesEnabled();
    return this.reports.getIncomeStatement({
      businessId: requireQuery(query.businessId, 'businessId'),
      from: requireQuery(query.from, 'from'),
      to: requireQuery(query.to, 'to'),
      timezone: query.timezone,
      currency: query.currency,
    });
  }

  @Get('accounts/:accountId/statement')
  getAccountStatement(
    @Param('accountId') accountId: string,
    @Query() query: StatementQuery,
  ) {
    this.assertReportRoutesEnabled();
    return this.reports.getAccountStatement({
      businessId: requireQuery(query.businessId, 'businessId'),
      accountId,
      from: requireQuery(query.from, 'from'),
      to: requireQuery(query.to, 'to'),
      timezone: query.timezone,
      currency: query.currency,
      limit: query.limit === undefined ? undefined : Number(query.limit),
      offset: query.offset === undefined ? undefined : Number(query.offset),
    });
  }

  private assertReportRoutesEnabled(): void {
    if (this.config.get<string>('KASICASH_REPORT_ROUTES') !== 'true') {
      throw new ForbiddenException('Report routes are disabled');
    }
  }
}

function requireQuery(value: string | undefined, name: string): string {
  if (!value) {
    throw new BadRequestException(`${name} query parameter is required`);
  }
  return value;
}
