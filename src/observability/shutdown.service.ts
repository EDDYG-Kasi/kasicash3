import { BeforeApplicationShutdown, Injectable, Logger } from '@nestjs/common';
import { MetricsService } from './metrics.service';

const DEFAULT_DRAIN_TIMEOUT_MS = 10_000;

@Injectable()
export class GracefulShutdownService implements BeforeApplicationShutdown {
  private readonly logger = new Logger(GracefulShutdownService.name);
  private draining = false;
  private inFlight = 0;
  private readonly waiters: Array<() => void> = [];

  constructor(private readonly metrics: MetricsService) {}

  isDraining(): boolean {
    return this.draining;
  }

  inFlightCount(): number {
    return this.inFlight;
  }

  beginShutdown(): void {
    this.draining = true;
    this.metrics.setGauge('kasicash_shutdown_draining', 1);
  }

  canStartWork(): boolean {
    return !this.draining;
  }

  async track<T>(work: () => Promise<T>): Promise<T> {
    this.inFlight += 1;
    try {
      return await work();
    } finally {
      this.inFlight -= 1;
      if (this.inFlight === 0) {
        this.waiters.splice(0).forEach((resolve) => resolve());
      }
    }
  }

  async drain(timeoutMs = DEFAULT_DRAIN_TIMEOUT_MS): Promise<boolean> {
    this.beginShutdown();
    if (this.inFlight === 0) return true;

    return Promise.race([
      new Promise<boolean>((resolve) => {
        this.waiters.push(() => resolve(true));
      }),
      new Promise<boolean>((resolve) => {
        setTimeout(() => resolve(false), timeoutMs).unref?.();
      }),
    ]);
  }

  async beforeApplicationShutdown(): Promise<void> {
    const drained = await this.drain();
    if (!drained) {
      this.logger.warn(
        `Shutdown timeout reached with ${this.inFlight} in-flight operation(s)`,
      );
    }
  }
}
