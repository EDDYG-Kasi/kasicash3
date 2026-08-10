import { Injectable } from '@nestjs/common';
import { AuthPrincipalContext } from '../auth/auth.dto';
import { DashboardTenantContextDto } from './dashboard.dto';

const AUTH_BOUNDARY = 'PHASE_9_AUTHENTICATED_PRINCIPAL' as const;

@Injectable()
export class DashboardTenantContextService {
  fromPrincipal(principal: AuthPrincipalContext): DashboardTenantContextDto {
    return {
      businessId: principal.businessId,
      currency: principal.currency,
      timezone: principal.timezone,
      authBoundary: AUTH_BOUNDARY,
      productionReady: true,
    };
  }
}
