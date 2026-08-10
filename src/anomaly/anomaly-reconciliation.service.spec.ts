import type { DataSource } from 'typeorm';
import { AnomalyReconciliationService } from './anomaly-reconciliation.service';

describe('AnomalyReconciliationService', () => {
  it('terminally quarantines started unresolved sends without calling a provider', async () => {
    const query = jest
      .fn<Promise<Array<{ id: string }>>, [string]>()
      .mockResolvedValue([{ id: 'alert-1' }]);
    const service = new AnomalyReconciliationService({ query } as DataSource);

    await expect(service.reconcileUnresolvedDispatches()).resolves.toBe(1);
    const sql = String(query.mock.calls[0][0]);
    expect(sql).toContain("status = 'DELIVERY_UNCERTAIN'");
    expect(sql).toContain('dispatch_started_at IS NOT NULL');
    expect(sql).not.toContain('INSERT INTO');
  });
});
