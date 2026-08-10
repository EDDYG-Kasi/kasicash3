import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Request } from 'express';
import { requireAuthPrincipal } from '../auth/auth.guard';
import { DashboardTenantContextDto } from './dashboard.dto';
import { DashboardTenantContextService } from './dashboard-tenant-context.service';

export interface DashboardRequest extends Request {
  dashboardTenant?: DashboardTenantContextDto;
}

@Injectable()
export class DashboardTenantGuard implements CanActivate {
  constructor(private readonly tenantContext: DashboardTenantContextService) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<DashboardRequest>();
    request.dashboardTenant = this.tenantContext.fromPrincipal(
      requireAuthPrincipal(request),
    );
    return true;
  }
}
