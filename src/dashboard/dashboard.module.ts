import { Module } from '@nestjs/common';
import { AnalyticsModule } from '../analytics/analytics.module';
import { AnomalyModule } from '../anomaly/anomaly.module';
import { ReportsModule } from '../reports/reports.module';
import { DashboardController } from './dashboard.controller';
import { DashboardTenantGuard } from './dashboard-tenant.guard';
import { DashboardTenantContextService } from './dashboard-tenant-context.service';
import { DashboardService } from './dashboard.service';

@Module({
  imports: [ReportsModule, AnalyticsModule, AnomalyModule],
  controllers: [DashboardController],
  providers: [
    DashboardService,
    DashboardTenantContextService,
    DashboardTenantGuard,
  ],
})
export class DashboardModule {}
