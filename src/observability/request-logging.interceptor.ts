import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { Observable, finalize } from 'rxjs';
import { MetricsService } from './metrics.service';
import { TelemetryLoggerService } from './telemetry-logger.service';

interface RouteMetadata {
  route?: {
    path?: unknown;
  };
}

@Injectable()
export class RequestLoggingInterceptor implements NestInterceptor {
  constructor(
    private readonly metrics: MetricsService,
    private readonly telemetry: TelemetryLoggerService,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    if (context.getType() !== 'http') {
      return next.handle();
    }
    const request = context.switchToHttp().getRequest<Request>();
    const response = context.switchToHttp().getResponse<Response>();
    const start = Date.now();

    return next.handle().pipe(
      finalize(() => {
        const route = routeTemplate(request);
        const labels = {
          method: request.method,
          route,
          status: response.statusCode,
        };
        this.metrics.increment('kasicash_http_requests_total', labels);
        this.metrics.observe(
          'kasicash_http_request_duration_ms',
          Date.now() - start,
          {
            method: request.method,
            route,
          },
        );
        this.telemetry.info('http_request_completed', labels);
      }),
    );
  }
}

function routeTemplate(request: Request): string {
  const path = (request as unknown as RouteMetadata).route?.path;
  if (typeof path === 'string') {
    return path.startsWith('/') ? path : `/${path}`;
  }
  return 'unmatched';
}
