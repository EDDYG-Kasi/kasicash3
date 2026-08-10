import { Injectable } from '@nestjs/common';
import { AsyncLocalStorage } from 'async_hooks';
import { randomBytes } from 'crypto';

const REQUEST_ID_PATTERN = /^[A-Za-z0-9_.:-]{8,80}$/;

interface CorrelationState {
  correlationId: string;
}

@Injectable()
export class CorrelationService {
  private readonly storage = new AsyncLocalStorage<CorrelationState>();

  runWithId<T>(correlationId: string, callback: () => T): T {
    return this.storage.run({ correlationId }, callback);
  }

  currentId(): string | undefined {
    return this.storage.getStore()?.correlationId;
  }

  resolveIncoming(raw: unknown): string {
    if (typeof raw === 'string' && REQUEST_ID_PATTERN.test(raw)) {
      return raw;
    }
    if (Array.isArray(raw) && raw.length === 1) {
      return this.resolveIncoming(raw[0]);
    }
    return this.createId();
  }

  createId(): string {
    return `req_${randomBytes(12).toString('base64url')}`;
  }
}
