import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { InboundMessage } from './entities/inbound-message.entity';
import { WebhookDelivery } from './entities/webhook-delivery.entity';
import { DevController } from './dev.controller';
import { WhatsAppController } from './whatsapp.controller';
import { IngestionService } from './ingestion.service';
import { RecoveryService } from './recovery.service';
import { OnboardingService } from './onboarding.service';
import { ParsingModule } from '../parsing/parsing.module';
import { ConversationalQueryModule } from '../conversational-query/conversational-query.module';
import {
  CloudApiWhatsAppClient,
  LoggingWhatsAppClient,
  normalizeGraphApiVersion,
  parseWhatsAppSendTimeoutMs,
  WHATSAPP_CLIENT,
} from './whatsapp.client';
import { includeDevelopmentControllers } from '../config/runtime-config';

export function ingestionControllersForEnvironment(
  env: Record<string, string | undefined> = process.env,
) {
  return includeDevelopmentControllers(env)
    ? [WhatsAppController, DevController]
    : [WhatsAppController];
}

export const INGESTION_CONTROLLERS = ingestionControllersForEnvironment();

@Module({
  imports: [
    TypeOrmModule.forFeature([InboundMessage, WebhookDelivery]),
    ParsingModule,
    ConversationalQueryModule,
  ],
  controllers: INGESTION_CONTROLLERS,
  providers: [
    IngestionService,
    RecoveryService,
    OnboardingService,
    {
      provide: WHATSAPP_CLIENT,
      inject: [ConfigService],
      useFactory: createWhatsAppClient,
    },
  ],
  exports: [IngestionService, RecoveryService, WHATSAPP_CLIENT],
})
export class IngestionModule {}

export function createWhatsAppClient(config: ConfigService) {
  const mode = config.get<string>('KASICASH_WHATSAPP_MODE')?.trim();
  const production = config.get<string>('NODE_ENV') === 'production';
  const token = config.get<string>('WHATSAPP_ACCESS_TOKEN')?.trim();
  const phoneNumberId = config.get<string>('WHATSAPP_PHONE_NUMBER_ID')?.trim();
  const graphApiVersion = normalizeGraphApiVersion(
    config.get<string>('WHATSAPP_GRAPH_API_VERSION'),
  );
  const timeoutMs = parseWhatsAppSendTimeoutMs(
    config.get<string>('WHATSAPP_SEND_TIMEOUT_MS'),
  );

  if (production && mode !== 'cloud') {
    throw new Error('KASICASH_WHATSAPP_MODE=cloud is required in production');
  }
  if (mode === 'cloud') {
    if (!token || !phoneNumberId) {
      throw new Error(
        'WhatsApp Cloud credentials are required when KASICASH_WHATSAPP_MODE=cloud',
      );
    }
    return new CloudApiWhatsAppClient(token, phoneNumberId, {
      graphApiVersion,
      timeoutMs,
    });
  }
  return new LoggingWhatsAppClient();
}
