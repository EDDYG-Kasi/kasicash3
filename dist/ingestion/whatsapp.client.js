"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CloudApiWhatsAppClient = exports.LoggingWhatsAppClient = exports.WHATSAPP_CLIENT = void 0;
const common_1 = require("@nestjs/common");
exports.WHATSAPP_CLIENT = Symbol('WHATSAPP_CLIENT');
class LoggingWhatsAppClient {
    logger = new common_1.Logger('WhatsAppClient');
    async sendText(to, body) {
        void body;
        this.logger.log(`[dev, not sent] -> ${maskRecipient(to)}: reply redacted`);
        return Promise.resolve();
    }
}
exports.LoggingWhatsAppClient = LoggingWhatsAppClient;
class CloudApiWhatsAppClient {
    accessToken;
    phoneNumberId;
    constructor(accessToken, phoneNumberId) {
        this.accessToken = accessToken;
        this.phoneNumberId = phoneNumberId;
    }
    async sendText(to, body) {
        const res = await fetch(`https://graph.facebook.com/v20.0/${this.phoneNumberId}/messages`, {
            method: 'POST',
            headers: {
                Authorization: `Bearer ${this.accessToken}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                messaging_product: 'whatsapp',
                to,
                type: 'text',
                text: { body },
            }),
        });
        if (!res.ok) {
            const detail = await res.text().catch(() => '');
            throw new Error(`WhatsApp send failed: ${res.status} ${detail.slice(0, 200)}`);
        }
    }
}
exports.CloudApiWhatsAppClient = CloudApiWhatsAppClient;
function maskRecipient(to) {
    const tail = to.slice(-4);
    return tail ? `***${tail}` : '***';
}
//# sourceMappingURL=whatsapp.client.js.map