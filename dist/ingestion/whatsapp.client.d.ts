export declare const WHATSAPP_CLIENT: unique symbol;
export interface WhatsAppClient {
    sendText(to: string, body: string): Promise<void>;
}
export declare class LoggingWhatsAppClient implements WhatsAppClient {
    private readonly logger;
    sendText(to: string, body: string): Promise<void>;
}
export declare class CloudApiWhatsAppClient implements WhatsAppClient {
    private readonly accessToken;
    private readonly phoneNumberId;
    constructor(accessToken: string, phoneNumberId: string);
    sendText(to: string, body: string): Promise<void>;
}
