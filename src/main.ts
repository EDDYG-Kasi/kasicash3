import { NestFactory } from '@nestjs/core';
import express from 'express';
import type { Server } from 'http';
import { AppModule } from './app.module';
import { validateRuntimeConfiguration } from './config/runtime-config';
import { resolveWebhookBodyLimits } from './config/webhook-body-limits';

async function bootstrap() {
  validateRuntimeConfiguration();
  const webhookBodyLimits = resolveWebhookBodyLimits(
    process.env.KASICASH_WEBHOOK_MAX_RAW_BYTES,
  );
  const app = await NestFactory.create(AppModule, { bodyParser: false });
  app.use(
    '/webhooks/whatsapp',
    express.raw({
      type: 'application/json',
      limit: webhookBodyLimits.transportBytes,
    }),
  );
  app.use(express.json({ limit: '1mb' }));
  app.use(express.urlencoded({ extended: true, limit: '1mb' }));
  const expressInstance = app.getHttpAdapter().getInstance() as {
    set: (name: string, value: boolean | number) => void;
  };
  const proxyHops = normalizeTrustProxyHops(
    process.env.KASICASH_TRUST_PROXY_HOPS,
  );
  expressInstance.set('trust proxy', proxyHops === 0 ? false : proxyHops);
  app.enableShutdownHooks();
  await app.listen(process.env.PORT ?? 3000);
  const server = app.getHttpServer() as Server;
  server.requestTimeout = Number(process.env.HTTP_REQUEST_TIMEOUT_MS ?? 30_000);
  server.headersTimeout = Number(process.env.HTTP_HEADERS_TIMEOUT_MS ?? 35_000);
}
void bootstrap();

export function normalizeTrustProxyHops(raw?: string): number {
  if (raw === undefined || raw.trim() === '') return 0;
  const hops = Number(raw);
  if (!Number.isInteger(hops) || hops < 0 || hops > 3) {
    throw new Error('KASICASH_TRUST_PROXY_HOPS must be an integer from 0 to 3');
  }
  return hops;
}
