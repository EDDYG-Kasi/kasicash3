import {
  BadRequestException,
  Body,
  Controller,
  ForbiddenException,
  Headers,
  Post,
  Req,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { timingSafeEqual } from 'crypto';
import type { Request } from 'express';
import { SecurityRateLimiterService } from '../auth/rate-limiter.service';
import { IngestionService } from './ingestion.service';

interface SimulateTextBody {
  from?: unknown;
  text?: unknown;
  contactName?: unknown;
  messageId?: unknown;
}

@Controller('dev')
export class DevController {
  constructor(
    private readonly ingestion: IngestionService,
    private readonly config: ConfigService,
    private readonly rateLimiter: SecurityRateLimiterService,
  ) {}

  @Post('whatsapp/text')
  async simulateWhatsAppText(
    @Req() request: Request,
    @Body() body?: SimulateTextBody,
    @Headers('x-kasicash-dev-token') devToken?: string,
  ) {
    await this.rateLimiter.assertAllowed(
      `dev:whatsapp:${clientIp(request)}`,
      30,
      60 * 1000,
    );
    if (this.config.get<string>('KASICASH_DEV_TOOLS') !== 'true') {
      throw new ForbiddenException('Developer tools are disabled');
    }
    const expected = this.config.get<string>('KASICASH_DEV_TOOLS_TOKEN');
    if (!expected || !constantTimeStringEqual(expected, devToken ?? '')) {
      throw new ForbiddenException('Developer tools are disabled');
    }

    const text = requiredTrimmedString(body?.text, 'text', 1000);
    const from = normalizeWaPhone(body?.from);
    const contactName = optionalTrimmedString(body?.contactName, 60);
    const messageId = optionalTrimmedString(body?.messageId, 120);
    const result = await this.ingestion.ingestSyntheticText({
      from,
      text,
      contactName,
      messageId,
    });

    return {
      ok: true,
      ...result,
    };
  }
}

function clientIp(request: Request): string {
  return request.ip ?? request.socket.remoteAddress ?? 'unknown';
}

function constantTimeStringEqual(left: string, right: string): boolean {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);
  return (
    leftBuffer.length === rightBuffer.length &&
    timingSafeEqual(leftBuffer, rightBuffer)
  );
}

function normalizeWaPhone(raw: unknown): string {
  const value = optionalTrimmedString(raw, 32) ?? '27831234567';
  const digits = value.replace(/[^\d]/g, '');
  if (!/^\d{8,15}$/.test(digits)) {
    throw new BadRequestException(
      'from must be an 8 to 15 digit WhatsApp phone number',
    );
  }
  return digits;
}

function requiredTrimmedString(
  raw: unknown,
  field: string,
  maxLength: number,
): string {
  const value = optionalTrimmedString(raw, maxLength);
  if (!value) throw new BadRequestException(`${field} is required`);
  return value;
}

function optionalTrimmedString(
  raw: unknown,
  maxLength: number,
): string | undefined {
  if (raw === undefined || raw === null) return undefined;
  if (typeof raw !== 'string') {
    throw new BadRequestException('Request fields must be strings');
  }
  const value = raw.replace(/\s+/g, ' ').trim();
  if (!value) return undefined;
  return value.slice(0, maxLength);
}
