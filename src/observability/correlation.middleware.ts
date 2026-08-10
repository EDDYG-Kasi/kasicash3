import { Injectable, NestMiddleware } from '@nestjs/common';
import type { NextFunction, Request, Response } from 'express';
import { CorrelationService } from './correlation.service';

@Injectable()
export class CorrelationMiddleware implements NestMiddleware {
  constructor(private readonly correlation: CorrelationService) {}

  use(request: Request, response: Response, next: NextFunction): void {
    const correlationId = this.correlation.resolveIncoming(
      request.headers['x-request-id'],
    );
    response.setHeader('x-request-id', correlationId);
    this.correlation.runWithId(correlationId, next);
  }
}
