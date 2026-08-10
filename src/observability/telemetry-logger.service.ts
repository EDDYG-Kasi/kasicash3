import { Injectable, Logger } from '@nestjs/common';
import { createHash } from 'crypto';
import { CorrelationService } from './correlation.service';

type TelemetryFields = Record<string, unknown>;

const REDACTED = '[REDACTED]';
const OMITTED = '[OMITTED]';
const SENSITIVE_KEY_PATTERN =
  /(password|token|secret|signature|authorization|cookie|credential|session)/i;
const PRIVATE_CONTENT_KEY_PATTERN =
  /(payload|rawbody|body|textbody|messagebody|wafrom|phone|email|amount|money|formatted|figure)/i;
const SAFE_FIELD_KEYS = new Set([
  'method',
  'route',
  'status',
  'status_code',
  'result',
  'reason_code',
  'error_code',
  'operation',
  'component',
  'state',
  'attempt',
  'attempts',
  'max_attempts',
  'duration_ms',
  'in_flight',
  'count',
  'enabled',
  'fresh',
]);

@Injectable()
export class TelemetryLoggerService {
  private readonly logger = new Logger('Telemetry');

  constructor(private readonly correlation: CorrelationService) {}

  info(event: string, fields: TelemetryFields = {}): void {
    this.logger.log(this.serialize('info', event, fields));
  }

  warn(event: string, fields: TelemetryFields = {}): void {
    this.logger.warn(this.serialize('warn', event, fields));
  }

  error(event: string, fields: TelemetryFields = {}): void {
    this.logger.error(this.serialize('error', event, fields));
  }

  private serialize(level: string, event: string, fields: TelemetryFields) {
    return JSON.stringify({
      level,
      event: sanitizeEventName(event),
      timestamp: new Date().toISOString(),
      correlation_id: this.correlation.currentId() ?? null,
      fields: sanitizeTelemetryFields(fields),
    });
  }
}

export function sanitizeTelemetryFields(value: unknown): unknown {
  return sanitizeValue(value, '');
}

export function hashForTelemetry(value: string): string {
  return createHash('sha256').update(value).digest('hex').slice(0, 16);
}

function sanitizeValue(value: unknown, key: string): unknown {
  if (SENSITIVE_KEY_PATTERN.test(key)) return REDACTED;
  if (PRIVATE_CONTENT_KEY_PATTERN.test(key)) return OMITTED;
  if (key && !SAFE_FIELD_KEYS.has(key)) return OMITTED;
  if (value === null || value === undefined) return value;
  if (value instanceof Date) return value.toISOString();
  if (typeof value === 'string') return sanitizeAllowedString(value, key);
  if (typeof value === 'number' || typeof value === 'boolean') return value;
  if (typeof value === 'bigint') return OMITTED;
  if (typeof value === 'function') return '[FUNCTION]';
  if (typeof value === 'symbol') return '[SYMBOL]';
  if (Array.isArray(value)) {
    return value.slice(0, 20).map((item) => sanitizeValue(item, key));
  }
  if (typeof value === 'object') {
    return Object.entries(value as Record<string, unknown>).reduce<
      Record<string, unknown>
    >((safe, [childKey, childValue]) => {
      safe[childKey] = sanitizeValue(childValue, childKey);
      return safe;
    }, {});
  }
  return '[UNSUPPORTED]';
}

function sanitizeAllowedString(value: string, key: string): string {
  const bounded = value.slice(0, 120);
  if (key === 'method') {
    return /^(GET|POST|PUT|PATCH|DELETE|HEAD|OPTIONS)$/.test(bounded)
      ? bounded
      : OMITTED;
  }
  if (key === 'route') {
    return /^\/[A-Za-z0-9_./:-]*$/.test(bounded) ? bounded : OMITTED;
  }
  return /^[A-Za-z][A-Za-z0-9_.:-]*$/.test(bounded) ? bounded : OMITTED;
}

function sanitizeEventName(event: string): string {
  return event.replace(/[^a-zA-Z0-9_.:-]/g, '_').slice(0, 120);
}
