import {
  BadRequestException,
  Controller,
  Get,
  Param,
  Query,
} from '@nestjs/common';
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
 * Phase 4 read-only report routes. These are intentionally unauthenticated for
 * now; auth/access control is deferred to Phase 9.
 */
@Controller('reports')
export class ReportsController {
  constructor(private readonly reports: ReportsService) {}

  @Get('balances')
  getCashPosition(@Query() query: CashPositionQuery) {
    return this.reports.getCashPosition({
      businessId: requireQuery(query.businessId, 'businessId'),
      currency: query.currency,
    });
  }

  @Get('income-statement')
  getIncomeStatement(@Query() query: PeriodQuery) {
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
}

function requireQuery(value: string | undefined, name: string): string {
  if (!value) {
    throw new BadRequestException(`${name} query parameter is required`);
  }
  return value;
}
