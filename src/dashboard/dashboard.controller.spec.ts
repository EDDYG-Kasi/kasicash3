import { DashboardController } from './dashboard.controller';
import { DashboardTenantContextService } from './dashboard-tenant-context.service';
import { DashboardTenantGuard } from './dashboard-tenant.guard';
import {
  DashboardOverviewQuery,
  DashboardTenantContextDto,
} from './dashboard.dto';
import { DashboardService } from './dashboard.service';
import type { AuthPrincipalContext } from '../auth/auth.dto';

const tenant: DashboardTenantContextDto = {
  businessId: 'trusted-business',
  currency: 'ZAR',
  timezone: 'Africa/Johannesburg',
  authBoundary: 'PHASE_9_AUTHENTICATED_PRINCIPAL',
  productionReady: true,
};

describe('DashboardController', () => {
  it('uses the server-side tenant context and ignores client tenant fields', async () => {
    const getOverview = jest.fn().mockResolvedValue({ ok: true });
    const controller = new DashboardController({
      getOverview,
    } as unknown as DashboardService);
    const query = {
      businessId: 'attacker-business',
      currency: 'USD',
      timezone: 'UTC',
      from: '2026-07-01',
      to: '2026-07-31',
    } as DashboardOverviewQuery & Record<string, string>;

    await expect(
      controller.getOverview({ dashboardTenant: tenant }, query),
    ).resolves.toEqual({ ok: true });

    expect(getOverview).toHaveBeenCalledWith(tenant, query);
    expect(getOverview).toHaveBeenCalledWith(
      expect.objectContaining({ businessId: 'trusted-business' }),
      query,
    );
  });
});

describe('DashboardTenantContextService', () => {
  it('resolves tenant, currency, and timezone from the authenticated principal only', () => {
    const service = new DashboardTenantContextService();
    const principal: AuthPrincipalContext = {
      principalId: 'principal-1',
      email: 'owner@example.com',
      businessId: 'business-from-principal',
      currency: 'ZAR',
      timezone: 'Africa/Johannesburg',
    };

    expect(service.fromPrincipal(principal)).toEqual({
      businessId: 'business-from-principal',
      currency: 'ZAR',
      timezone: 'Africa/Johannesburg',
      authBoundary: 'PHASE_9_AUTHENTICATED_PRINCIPAL',
      productionReady: true,
    });
  });
});

describe('DashboardTenantGuard', () => {
  it('attaches a tenant derived from the authenticated principal to the request', () => {
    const guard = new DashboardTenantGuard(new DashboardTenantContextService());
    const request: Record<string, unknown> = {
      authPrincipal: {
        principalId: 'principal-1',
        email: 'owner@example.com',
        businessId: 'trusted-business',
        currency: 'ZAR',
        timezone: 'Africa/Johannesburg',
      } satisfies AuthPrincipalContext,
    };
    const context = {
      switchToHttp: () => ({
        getRequest: () => request,
      }),
    };

    expect(guard.canActivate(context as never)).toBe(true);
    expect(request.dashboardTenant).toEqual(tenant);
  });
});
