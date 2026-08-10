import { Controller, Get, Query, Req, Res, UseGuards } from '@nestjs/common';
import type { Response } from 'express';
import { DataSource } from 'typeorm';
import { AuthGuard, requireAuthPrincipal } from '../auth/auth.guard';
import type { AuthenticatedRequest } from '../auth/auth.guard';
import { InboundMessage } from '../ingestion/entities/inbound-message.entity';
import { HealthService } from './health.service';
import { MetricsService } from './metrics.service';

interface DeadLetterRow {
  id: string;
  waMessageId: string;
  status: string;
  attempts: number;
  receivedAt: Date;
  processedAt: Date | null;
  nextRetryAt: Date | null;
  errorCode: string | null;
}

@Controller()
export class ObservabilityController {
  constructor(
    private readonly health: HealthService,
    private readonly metrics: MetricsService,
    private readonly dataSource: DataSource,
  ) {}

  @Get('health')
  healthCheck() {
    return this.health.liveness();
  }

  @Get('ready')
  async ready(@Res({ passthrough: true }) response: Response) {
    const readiness = await this.health.readiness();
    if (!readiness.ok) {
      response.status(503);
    }
    return readiness;
  }

  @Get('metrics')
  metricsText(@Res() response: Response) {
    response.type('text/plain').send(this.metrics.renderPrometheus());
  }

  @Get('ops/dead-letter')
  @UseGuards(AuthGuard)
  async deadLetters(
    @Req() request: AuthenticatedRequest,
    @Query('limit') rawLimit?: string,
  ) {
    const principal = requireAuthPrincipal(request);
    const limit = normalizeLimit(rawLimit);
    const rawRows = (await this.dataSource.manager
      .createQueryBuilder(InboundMessage, 'message')
      .select([
        'message.id AS "id"',
        'message.waMessageId AS "waMessageId"',
        'message.status AS "status"',
        'message.attempts AS "attempts"',
        'message.receivedAt AS "receivedAt"',
        'message.processedAt AS "processedAt"',
        'message.nextRetryAt AS "nextRetryAt"',
        'message.errorCode AS "errorCode"',
      ])
      .where('message.businessId = :businessId', {
        businessId: principal.businessId,
      })
      .andWhere('message.status = :status', { status: 'DEAD' })
      .orderBy('message.receivedAt', 'ASC')
      .limit(limit)
      .getRawMany()) as unknown;
    const rows = normalizeDeadLetterRows(rawRows);

    return {
      businessId: principal.businessId,
      count: rows.length,
      items: rows.map((row) => ({
        id: row.id,
        waMessageId: row.waMessageId,
        status: row.status,
        attempts: row.attempts,
        receivedAt: row.receivedAt.toISOString(),
        processedAt: row.processedAt?.toISOString() ?? null,
        nextRetryAt: row.nextRetryAt?.toISOString() ?? null,
        errorCode: row.errorCode,
      })),
    };
  }
}

function normalizeLimit(raw?: string): number {
  const value = Number(raw ?? 50);
  if (!Number.isInteger(value) || value < 1) return 50;
  return Math.min(value, 100);
}

function normalizeDeadLetterRows(rawRows: unknown): DeadLetterRow[] {
  if (!Array.isArray(rawRows)) return [];
  return rawRows.flatMap((row) => {
    if (!isRecord(row)) return [];
    const id = safeString(row.id);
    const waMessageId = safeString(row.waMessageId);
    const status = safeString(row.status);
    const receivedAt = safeDate(row.receivedAt);
    if (!id || !waMessageId || !status || !receivedAt) return [];
    return [
      {
        id,
        waMessageId,
        status,
        attempts: Number(row.attempts ?? 0),
        receivedAt,
        processedAt: safeDate(row.processedAt),
        nextRetryAt: safeDate(row.nextRetryAt),
        errorCode: row.errorCode === null ? null : safeErrorCode(row.errorCode),
      },
    ];
  });
}

function safeString(value: unknown): string {
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }
  return '';
}

function safeErrorCode(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  return /^[A-Z0-9_]{1,64}$/.test(value) ? value : null;
}

function safeDate(value: unknown): Date | null {
  if (value instanceof Date) return value;
  if (typeof value !== 'string') return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}
