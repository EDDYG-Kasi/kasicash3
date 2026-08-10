import {
  BadRequestException,
  Controller,
  Get,
  Param,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard, requireAuthPrincipal } from '../auth/auth.guard';
import type { AuthenticatedRequest } from '../auth/auth.guard';
import { ReportsService } from './reports.service';

interface PeriodQuery {
  from?: string;
  to?: string;
  timezone?: string;
}

interface StatementQuery extends PeriodQuery {
  limit?: string;
  offset?: string;
}

/**
 * Authenticated read-only report routes. Tenant, currency, and timezone come
 * from the server-side principal context; caller-supplied tenant fields are
 * ignored.
 */
@Controller('reports')
@UseGuards(AuthGuard)
export class ReportsController {
  constructor(private readonly reports: ReportsService) {}

  @Get('balances')
  getCashPosition(@Req() request: AuthenticatedRequest) {
    const principal = requireAuthPrincipal(request);
    return this.reports.getCashPosition({
      businessId: principal.businessId,
      currency: principal.currency,
    });
  }

  @Get('income-statement')
  getIncomeStatement(
    @Req() request: AuthenticatedRequest,
    @Query() query: PeriodQuery,
  ) {
    const principal = requireAuthPrincipal(request);
    return this.reports.getIncomeStatement({
      businessId: principal.businessId,
      from: requireQuery(query.from, 'from'),
      to: requireQuery(query.to, 'to'),
      timezone: principal.timezone,
      currency: principal.currency,
    });
  }

  @Get('accounts/:accountId/statement')
  getAccountStatement(
    @Req() request: AuthenticatedRequest,
    @Param('accountId') accountId: string,
    @Query() query: StatementQuery,
  ) {
    const principal = requireAuthPrincipal(request);
    return this.reports.getAccountStatement({
      businessId: principal.businessId,
      accountId,
      from: requireQuery(query.from, 'from'),
      to: requireQuery(query.to, 'to'),
      timezone: principal.timezone,
      currency: principal.currency,
      limit: parseIntegerQuery(query.limit, 'limit'),
      offset: parseIntegerQuery(query.offset, 'offset'),
    });
  }
}

export function parseIntegerQuery(
  value: string | undefined,
  name: string,
): number | undefined {
  if (value === undefined) return undefined;
  if (!/^\d+$/.test(value)) {
    throw new BadRequestException(`${name} must be a base-10 integer`);
  }
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed)) {
    throw new BadRequestException(`${name} is outside the supported range`);
  }
  return parsed;
}

function requireQuery(value: string | undefined, name: string): string {
  if (!value) {
    throw new BadRequestException(`${name} query parameter is required`);
  }
  return value;
}
