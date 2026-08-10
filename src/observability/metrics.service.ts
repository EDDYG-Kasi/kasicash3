import { Injectable } from '@nestjs/common';

type Labels = Record<string, string | number | boolean | undefined>;

interface MetricKey {
  name: string;
  labels: Record<string, string>;
}

interface Observation {
  count: number;
  sum: number;
  max: number;
}

@Injectable()
export class MetricsService {
  private readonly counters = new Map<string, number>();
  private readonly gauges = new Map<string, number>();
  private readonly observations = new Map<string, Observation>();

  increment(name: string, labels: Labels = {}, by = 1): void {
    const key = encodeKey(name, labels);
    this.counters.set(key, (this.counters.get(key) ?? 0) + by);
  }

  setGauge(name: string, value: number, labels: Labels = {}): void {
    this.gauges.set(encodeKey(name, labels), normalizeNumber(value));
  }

  observe(name: string, value: number, labels: Labels = {}): void {
    const key = encodeKey(name, labels);
    const existing = this.observations.get(key) ?? {
      count: 0,
      sum: 0,
      max: 0,
    };
    const safeValue = normalizeNumber(value);
    this.observations.set(key, {
      count: existing.count + 1,
      sum: existing.sum + safeValue,
      max: Math.max(existing.max, safeValue),
    });
  }

  snapshot() {
    return {
      counters: decodeMetricMap(this.counters),
      gauges: decodeMetricMap(this.gauges),
      observations: Array.from(this.observations.entries()).map(
        ([key, value]) => ({
          ...decodeKey(key),
          ...value,
        }),
      ),
    };
  }

  renderPrometheus(): string {
    const lines: string[] = [];
    for (const [key, value] of this.counters.entries()) {
      const metric = decodeKey(key);
      lines.push(`${metric.name}${formatLabels(metric.labels)} ${value}`);
    }
    for (const [key, value] of this.gauges.entries()) {
      const metric = decodeKey(key);
      lines.push(`${metric.name}${formatLabels(metric.labels)} ${value}`);
    }
    for (const [key, value] of this.observations.entries()) {
      const metric = decodeKey(key);
      lines.push(
        `${metric.name}_count${formatLabels(metric.labels)} ${value.count}`,
      );
      lines.push(
        `${metric.name}_sum${formatLabels(metric.labels)} ${value.sum}`,
      );
      lines.push(
        `${metric.name}_max${formatLabels(metric.labels)} ${value.max}`,
      );
    }
    return `${lines.join('\n')}\n`;
  }
}

function encodeKey(name: string, labels: Labels): string {
  return JSON.stringify({
    name: sanitizeMetricName(name),
    labels: sanitizeLabels(labels),
  } satisfies MetricKey);
}

function decodeKey(raw: string): MetricKey {
  return JSON.parse(raw) as MetricKey;
}

function decodeMetricMap(map: Map<string, number>) {
  return Array.from(map.entries()).map(([key, value]) => ({
    ...decodeKey(key),
    value,
  }));
}

function sanitizeMetricName(name: string): string {
  return name.replace(/[^A-Za-z0-9_:]/g, '_').slice(0, 120);
}

function sanitizeLabels(labels: Labels): Record<string, string> {
  return Object.entries(labels).reduce<Record<string, string>>(
    (safe, [key, value]) => {
      if (value === undefined) return safe;
      safe[key.replace(/[^A-Za-z0-9_]/g, '_').slice(0, 60)] = String(value)
        .replace(/[^A-Za-z0-9_.:/-]/g, '_')
        .slice(0, 120);
      return safe;
    },
    {},
  );
}

function formatLabels(labels: Record<string, string>): string {
  const entries = Object.entries(labels);
  if (entries.length === 0) return '';
  return `{${entries
    .map(([key, value]) => `${key}="${value.replace(/"/g, '\\"')}"`)
    .join(',')}}`;
}

function normalizeNumber(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, value);
}
