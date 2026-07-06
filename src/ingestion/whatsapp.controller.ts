import {
  Body,
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
import type { RawBodyRequest } from '@nestjs/common';
import type { Request } from 'express';
import { IngestionService } from './ingestion.service';
import type { WaWebhookPayload } from './ingestion.service';
import { verifyWhatsAppSignature } from './whatsapp-signature.util';

@Controller('webhooks/whatsapp')
export class WhatsAppController {
  constructor(
    private readonly ingestion: IngestionService,
    private readonly config: ConfigService,
  ) {}

  /** Meta webhook verification handshake (GET with hub.* query params). */
  @Get()
  verify(
    @Query('hub.mode') mode: string,
    @Query('hub.verify_token') token: string,
    @Query('hub.challenge') challenge: string,
  ): string {
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
    @Req() req: RawBodyRequest<Request>,
    @Body() body: WaWebhookPayload,
    @Headers('x-hub-signature-256') signature?: string,
  ): Promise<string> {
    const secret = this.config.get<string>('WHATSAPP_APP_SECRET');
    if (
      !secret ||
      !req.rawBody ||
      !verifyWhatsAppSignature(secret, req.rawBody, signature)
    ) {
      throw new UnauthorizedException('Invalid webhook signature');
    }
    await this.ingestion.ingestWebhook(body, req.rawBody);
    return 'EVENT_RECEIVED';
  }
}
