import { MetricsService } from './metrics.service';
import { GracefulShutdownService } from './shutdown.service';

describe('GracefulShutdownService', () => {
  it('blocks new work once draining begins and waits for in-flight work', async () => {
    const service = new GracefulShutdownService(new MetricsService());
    let release!: () => void;

    const work = service.track(
      () =>
        new Promise<string>((resolve) => {
          release = () => resolve('done');
        }),
    );
    expect(service.inFlightCount()).toBe(1);

    const drain = service.drain(1_000);
    expect(service.isDraining()).toBe(true);
    expect(service.canStartWork()).toBe(false);

    release();
    await expect(work).resolves.toBe('done');
    await expect(drain).resolves.toBe(true);
    expect(service.inFlightCount()).toBe(0);
  });

  it('reports a drain timeout without dropping the tracked operation', async () => {
    const service = new GracefulShutdownService(new MetricsService());

    const work = service.track(() => new Promise(() => undefined));

    await expect(service.drain(1)).resolves.toBe(false);
    expect(service.inFlightCount()).toBe(1);
    void work.catch(() => undefined);
  });

  it('begins draining in the before-application-shutdown hook', async () => {
    const service = new GracefulShutdownService(new MetricsService());
    await service.track(() => Promise.resolve(undefined));

    await service.beforeApplicationShutdown();

    expect(service.isDraining()).toBe(true);
    expect(service.canStartWork()).toBe(false);
  });
});
