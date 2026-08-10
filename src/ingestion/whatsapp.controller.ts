import {
  Controller,
  ForbiddenException,
  Get,
  Headers,
  HttpCode,
  Post,
  Query,
  Req,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Request } from 'express';
import { SecurityRateLimiterService } from '../auth/rate-limiter.service';
import { WebhookSecurityService } from '../auth/webhook-security.service';
import { IngestionService } from './ingestion.service';
import { verifyWhatsAppSignature } from './whatsapp-signature.util';

@Controller('webhooks/whatsapp')
export class WhatsAppController {
  constructor(
    private readonly ingestion: IngestionService,
    private readonly config: ConfigService,
    private readonly rateLimiter: SecurityRateLimiterService,
    private readonly webhookSecurity: WebhookSecurityService,
  ) {}

  /** Meta webhook verification handshake (GET with hub.* query params). */
  @Get()
  async verify(
    @Req() req: Request,
    @Query('hub.mode') mode: string,
    @Query('hub.verify_token') token: string,
    @Query('hub.challenge') challenge: string,
  ): Promise<string> {
    await this.rateLimiter.assertAllowed(
      `webhook:verify:${clientIp(req)}`,
      60,
      60 * 1000,
    );
    const expected = this.config.get<string>('WHATSAPP_VERIFY_TOKEN');
    if (mode === 'subscribe' && expected && token === expected) {
      return challenge;
    }
    throw new ForbiddenException('Webhook verification failed');
  }

  /** Signed event delivery. Verify HMAC over the RAW body, store idempotently, ack fast. */
  @Post()
  @HttpCode(200)
  async receive(
    @Req() req: Request,
    @Headers('x-hub-signature-256') signature?: string,
  ): Promise<string> {
    const rawBody = Buffer.isBuffer(req.body) ? req.body : undefined;
    const secret = this.config.get<string>('WHATSAPP_APP_SECRET');
    if (!secret || !rawBody) {
      throw new UnauthorizedException('Invalid webhook signature');
    }
    if (!verifyWhatsAppSignature(secret, rawBody, signature)) {
      await this.rateLimiter.assertAllowed(
        `webhook:invalid-signature:${clientIp(req)}`,
        30,
        60 * 1000,
      );
      throw new UnauthorizedException('Invalid webhook signature');
    }
    await this.rateLimiter.assertAllowed(
      'webhook:verified-delivery',
      3000,
      60 * 1000,
    );
    await this.ingestion.ingestSignedWebhook(
      rawBody,
      signature ?? '',
      this.webhookSecurity.maxRawBodyBytes(),
    );
    return 'EVENT_RECEIVED';
  }
}

function clientIp(request: Request): string {
  return request.ip ?? request.socket.remoteAddress ?? 'unknown';
}
