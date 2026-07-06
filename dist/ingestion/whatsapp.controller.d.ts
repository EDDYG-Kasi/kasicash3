import { ConfigService } from '@nestjs/config';
import type { RawBodyRequest } from '@nestjs/common';
import type { Request } from 'express';
import { IngestionService } from './ingestion.service';
import type { WaWebhookPayload } from './ingestion.service';
export declare class WhatsAppController {
    private readonly ingestion;
    private readonly config;
    constructor(ingestion: IngestionService, config: ConfigService);
    verify(mode: string, token: string, challenge: string): string;
    receive(req: RawBodyRequest<Request>, body: WaWebhookPayload, signature?: string): Promise<string>;
}
