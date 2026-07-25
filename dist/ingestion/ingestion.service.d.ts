import type { WhatsAppClient } from './whatsapp.client';
import { DataSource } from 'typeorm';
import { OnboardingService } from './onboarding.service';
import { ParsingService } from '../parsing/parsing.service';
interface WaText {
    body: string;
}
export interface WaMessage {
    id: string;
    from: string;
    timestamp: string;
    type: string;
    text?: WaText;
}
interface WaContactProfile {
    name?: string;
}
interface WaContact {
    wa_id?: string;
    profile?: WaContactProfile;
}
interface WaValue {
    messages?: WaMessage[];
    contacts?: WaContact[];
    statuses?: unknown[];
}
interface WaChange {
    field?: string;
    value?: WaValue;
}
interface WaEntry {
    changes?: WaChange[];
}
export interface WaWebhookPayload {
    object?: string;
    entry?: WaEntry[];
}
export interface SyntheticTextInput {
    from: string;
    text: string;
    contactName?: string;
    messageId?: string;
    timestamp?: Date;
}
export interface SyntheticTextResult {
    stored: boolean;
    duplicate: boolean;
    processed: boolean;
    inboundId?: string;
    waMessageId: string;
}
export declare class IngestionService {
    private dataSource;
    private onboarding;
    private parsing;
    private wa;
    private readonly logger;
    constructor(dataSource: DataSource, onboarding: OnboardingService, parsing: ParsingService, wa: WhatsAppClient);
    ingestWebhook(payload: WaWebhookPayload, rawBody: Buffer): Promise<{
        stored: number;
        duplicates: number;
    }>;
    ingestSyntheticText(input: SyntheticTextInput): Promise<SyntheticTextResult>;
    private storeIdempotent;
    processMessage(id: string, contactName?: string): Promise<boolean>;
    private recordFailure;
}
export declare const MAX_ATTEMPTS = 5;
export declare function backoffMs(attempts: number): number;
export {};
