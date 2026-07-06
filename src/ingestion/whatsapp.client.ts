import { Logger } from '@nestjs/common';

export const WHATSAPP_CLIENT = Symbol('WHATSAPP_CLIENT');

/** Provider-agnostic outbound interface (Constitution: never couple to one provider). */
export interface WhatsAppClient {
  sendText(to: string, body: string): Promise<void>;
}

/** Dev/no-credentials implementation: logs instead of sending. Never logs full bodies. */
export class LoggingWhatsAppClient implements WhatsAppClient {
  private readonly logger = new Logger('WhatsAppClient');
  async sendText(to: string, body: string): Promise<void> {
    void body;
    this.logger.log(`[dev, not sent] -> ${maskRecipient(to)}: reply redacted`);
    return Promise.resolve();
  }
}

/** WhatsApp Business Cloud API (Graph) implementation. */
export class CloudApiWhatsAppClient implements WhatsAppClient {
  constructor(
    private readonly accessToken: string,
    private readonly phoneNumberId: string,
  ) {}

  async sendText(to: string, body: string): Promise<void> {
    const res = await fetch(
      `https://graph.facebook.com/v20.0/${this.phoneNumberId}/messages`,
      {
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
      },
    );
    if (!res.ok) {
      const detail = await res.text().catch(() => '');
      throw new Error(
        `WhatsApp send failed: ${res.status} ${detail.slice(0, 200)}`,
      );
    }
  }
}

function maskRecipient(to: string): string {
  const tail = to.slice(-4);
  return tail ? `***${tail}` : '***';
}
