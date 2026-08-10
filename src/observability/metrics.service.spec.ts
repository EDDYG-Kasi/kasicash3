import { MetricsService } from './metrics.service';

describe('MetricsService', () => {
  it('records counters, gauges, and observations with sanitized labels', () => {
    const metrics = new MetricsService();

    metrics.increment('kasicash.http requests', {
      'route.name': '/reports/balances',
      weird: 'bad"value',
    });
    metrics.setGauge('kasicash_recovery_queue_depth', 2, {
      status: 'DEAD',
    });
    metrics.observe('kasicash_report_latency_ms', 12.5, {
      report: 'cash_position',
    });

    expect(metrics.snapshot()).toMatchObject({
      counters: [
        {
          name: 'kasicash_http_requests',
          labels: {
            route_name: '/reports/balances',
            weird: 'bad_value',
          },
          value: 1,
        },
      ],
      gauges: [
        {
          name: 'kasicash_recovery_queue_depth',
          labels: { status: 'DEAD' },
          value: 2,
        },
      ],
      observations: [
        {
          name: 'kasicash_report_latency_ms',
          labels: { report: 'cash_position' },
          count: 1,
          sum: 12.5,
          max: 12.5,
        },
      ],
    });

    expect(metrics.renderPrometheus()).toContain(
      'kasicash_report_latency_ms_count{report="cash_position"} 1',
    );
  });

  it('normalizes non-finite or negative numeric values', () => {
    const metrics = new MetricsService();

    metrics.setGauge('bad_gauge', -10);
    metrics.observe('bad_observation', Number.POSITIVE_INFINITY);

    expect(metrics.renderPrometheus()).toContain('bad_gauge 0');
    expect(metrics.renderPrometheus()).toContain('bad_observation_sum 0');
  });
});
