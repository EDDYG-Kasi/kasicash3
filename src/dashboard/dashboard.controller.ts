import {
  Controller,
  Get,
  Param,
  Query,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import type { Response } from 'express';
import { dashboardClientScript, dashboardHtml } from './dashboard.frontend';
import type {
  DashboardOverviewQuery,
  DashboardPeriodQuery,
  DashboardStatementQuery,
} from './dashboard.dto';
import { AuthGuard } from '../auth/auth.guard';
import type { DashboardRequest } from './dashboard-tenant.guard';
import { DashboardTenantGuard } from './dashboard-tenant.guard';
import { DashboardService } from './dashboard.service';

@Controller('dashboard')
@UseGuards(AuthGuard, DashboardTenantGuard)
export class DashboardController {
  constructor(private readonly dashboard: DashboardService) {}

  @Get()
  getDashboard(@Res() response: Response) {
    response.type('html').send(dashboardHtml());
  }

  @Get('assets/app.js')
  getClientScript(@Res() response: Response) {
    response.type('application/javascript').send(dashboardClientScript());
  }

  @Get('api/overview')
  getOverview(
    @Req() request: DashboardRequest,
    @Query() query: DashboardOverviewQuery,
  ) {
    return this.dashboard.getOverview(requireTenant(request), query);
  }

  @Get('api/cash-position')
  getCashPosition(@Req() request: DashboardRequest) {
    return this.dashboard.getCashPosition(requireTenant(request));
  }

  @Get('api/income-statement')
  getIncomeStatement(
    @Req() request: DashboardRequest,
    @Query() query: DashboardPeriodQuery,
  ) {
    return this.dashboard.getIncomeStatement(requireTenant(request), query);
  }

  @Get('api/accounts/:accountId/statement')
  getAccountStatement(
    @Req() request: DashboardRequest,
    @Param('accountId') accountId: string,
    @Query() query: DashboardStatementQuery,
  ) {
    return this.dashboard.getAccountStatement(
      requireTenant(request),
      accountId,
      query,
    );
  }

  @Get('api/analytics/cash-balance')
  getCashBalanceSeries(
    @Req() request: DashboardRequest,
    @Query() query: DashboardPeriodQuery,
  ) {
    return this.dashboard.getCashBalanceSeries(requireTenant(request), query);
  }

  @Get('api/analytics/income-expenses')
  getIncomeVsExpensesSeries(
    @Req() request: DashboardRequest,
    @Query() query: DashboardPeriodQuery,
  ) {
    return this.dashboard.getIncomeVsExpensesSeries(
      requireTenant(request),
      query,
    );
  }

  @Get('api/analytics/spend-by-account')
  getSpendByAccountBreakdown(
    @Req() request: DashboardRequest,
    @Query() query: DashboardPeriodQuery,
  ) {
    return this.dashboard.getSpendByAccountBreakdown(
      requireTenant(request),
      query,
    );
  }

  @Get('api/anomalies')
  getCurrentAnomalies(
    @Req() request: DashboardRequest,
    @Query('asOfLocalDate') asOfLocalDate?: string,
  ) {
    return this.dashboard.getCurrentAnomalies(
      requireTenant(request),
      asOfLocalDate,
    );
  }
}

function requireTenant(request: DashboardRequest) {
  if (!request.dashboardTenant) {
    throw new Error('Dashboard tenant guard did not attach a tenant context');
  }
  return request.dashboardTenant;
}
