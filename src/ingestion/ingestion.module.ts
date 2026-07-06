import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { InboundMessage } from './entities/inbound-message.entity';
import { WhatsAppController } from './whatsapp.controller';
import { IngestionService } from './ingestion.service';
import { RecoveryService } from './recovery.service';
import { OnboardingService } from './onboarding.service';
import { ParsingModule } from '../parsing/parsing.module';
import {
  CloudApiWhatsAppClient,
  LoggingWhatsAppClient,
  WHATSAPP_CLIENT,
} from './whatsapp.client';

@Module({
  imports: [TypeOrmModule.forFeature([InboundMessage]), ParsingModule],
  controllers: [WhatsAppController],
  providers: [
    IngestionService,
    RecoveryService,
    OnboardingService,
    {
      provide: WHATSAPP_CLIENT,
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const token = config.get<string>('WHATSAPP_ACCESS_TOKEN');
        const phoneNumberId = config.get<string>('WHATSAPP_PHONE_NUMBER_ID');
        return token && phoneNumberId
          ? new CloudApiWhatsAppClient(token, phoneNumberId)
          : new LoggingWhatsAppClient();
      },
    },
  ],
  exports: [IngestionService],
})
export class IngestionModule {}
