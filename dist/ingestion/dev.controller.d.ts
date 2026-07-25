import { ConfigService } from '@nestjs/config';
import { IngestionService } from './ingestion.service';
interface SimulateTextBody {
    from?: unknown;
    text?: unknown;
    contactName?: unknown;
    messageId?: unknown;
}
export declare class DevController {
    private readonly ingestion;
    private readonly config;
    constructor(ingestion: IngestionService, config: ConfigService);
    simulateWhatsAppText(body?: SimulateTextBody): Promise<{
        stored: boolean;
        duplicate: boolean;
        processed: boolean;
        inboundId?: string;
        waMessageId: string;
        ok: boolean;
    }>;
}
export {};
