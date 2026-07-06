export declare class InboundMessage {
    id: string;
    waMessageId: string;
    waFrom: string;
    businessId: string;
    payload: Record<string, unknown>;
    payloadHash: string;
    messageType: string;
    textBody: string;
    waTimestamp: Date;
    receivedAt: Date;
    status: string;
    attempts: number;
    nextRetryAt: Date | null;
    processedAt: Date;
    error: string | null;
}
