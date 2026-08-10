import { Logger } from '@nestjs/common';

export const WHATSAPP_CLIENT = Symbol('WHATSAPP_CLIENT');
export const DEFAULT_WHATSAPP_GRAPH_API_VERSION = 'v24.0';
export const DEFAULT_WHATSAPP_SEND_TIMEOUT_MS = 5_000;
const MAX_PROVIDER_ERROR_BODY_BYTES = 2048;
const MAX_TEXT_BODY_CHARS = 4096;

type FetchLike = typeof fetch;

export type WhatsAppDeliveryFailureKind = 'RETRYABLE' | 'PERMANENT';

export interface CloudApiWhatsAppClientOptions {
  graphApiVersion?: string;
  timeoutMs?: number;
  baseUrl?: string;
  fetchImpl?: FetchLike;
}

/** Provider-agnostic outbound interface (Constitution: never couple to one provider). */
export interface WhatsAppClient {
  sendText(to: string, body: string): Promise<void>;
}

/** Dev/no-credentials implementation: logs instead of sending. Never logs full bodies. */
export class LoggingWhatsAppClient implements WhatsAppClient {
  private readonly logger = new Logger('WhatsAppClient');
  async sendText(to: string, body: string): Promise<void> {
    void to;
    void body;
    this.logger.log('[dev, not sent]: recipient and reply redacted');
    return Promise.resolve();
  }
}

/** WhatsApp Business Cloud API (Graph) implementation. */
export class CloudApiWhatsAppClient implements WhatsAppClient {
  private readonly graphApiVersion: string;
  private readonly timeoutMs: number;
  private readonly baseUrl: string;
  private readonly fetchImpl: FetchLike;

  constructor(
    private readonly accessToken: string,
    private readonly phoneNumberId: string,
    options: CloudApiWhatsAppClientOptions = {},
  ) {
    this.graphApiVersion = normalizeGraphApiVersion(options.graphApiVersion);
    this.timeoutMs = normalizeTimeoutMs(options.timeoutMs);
    this.baseUrl = normalizeGraphBaseUrl(options.baseUrl);
    this.fetchImpl = options.fetchImpl ?? fetch;
    if (!accessToken.trim()) {
      throw new Error('WhatsApp Cloud access token is required');
    }
    if (!/^\d{5,32}$/.test(phoneNumberId.trim())) {
      throw new Error('WhatsApp phone number id must be numeric');
    }
  }

  async sendText(to: string, body: string): Promise<void> {
    validateOutboundText(to, body);
    const endpoint = buildMessagesEndpoint(
      this.baseUrl,
      this.graphApiVersion,
      this.phoneNumberId,
    );
    let res: Response;
    try {
      res = await this.fetchImpl(endpoint, {
        method: 'POST',
        signal: AbortSignal.timeout(this.timeoutMs),
        headers: {
          Authorization: `Bearer ${this.accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messaging_product: 'whatsapp',
          recipient_type: 'individual',
          to,
          type: 'text',
          text: { preview_url: false, body },
        }),
      });
    } catch (err) {
      throw transportError(err);
    }
    if (!res.ok) {
      throw await providerHttpError(res);
    }
    await assertAcceptedResponse(res);
  }
}

export class WhatsAppDeliveryError extends Error {
  readonly retryable: boolean;

  constructor(
    readonly failureKind: WhatsAppDeliveryFailureKind,
    readonly code: string,
    readonly statusCode?: number,
    readonly providerErrorCode?: string,
    readonly providerErrorType?: string,
  ) {
    super('WhatsApp delivery failed');
    this.name = 'WhatsAppDeliveryError';
    this.retryable = failureKind === 'RETRYABLE';
  }

  toLogFields(): Record<string, string | number | boolean> {
    return {
      error_code: this.code,
      retryable: this.retryable,
      ...(this.statusCode === undefined
        ? {}
        : { status_code: this.statusCode }),
      ...(this.providerErrorCode
        ? { provider_error_code: this.providerErrorCode }
        : {}),
      ...(this.providerErrorType
        ? { provider_error_type: this.providerErrorType }
        : {}),
    };
  }
}

export function normalizeGraphApiVersion(value?: string): string {
  const version = value?.trim() || DEFAULT_WHATSAPP_GRAPH_API_VERSION;
  if (!/^v\d+\.\d+$/.test(version)) {
    throw new Error('WHATSAPP_GRAPH_API_VERSION must look like v24.0');
  }
  return version;
}

export function normalizeTimeoutMs(value?: number): number {
  const timeout = value ?? DEFAULT_WHATSAPP_SEND_TIMEOUT_MS;
  if (!Number.isInteger(timeout) || timeout < 1000 || timeout > 30_000) {
    throw new Error('WHATSAPP_SEND_TIMEOUT_MS must be between 1000 and 30000');
  }
  return timeout;
}

export function parseWhatsAppSendTimeoutMs(value?: string): number {
  if (value === undefined || value.trim() === '') {
    return DEFAULT_WHATSAPP_SEND_TIMEOUT_MS;
  }
  if (!/^\d+$/.test(value.trim())) {
    throw new Error('WHATSAPP_SEND_TIMEOUT_MS must be an integer');
  }
  return normalizeTimeoutMs(Number(value));
}

function normalizeGraphBaseUrl(value?: string): string {
  const baseUrl = (value?.trim() || 'https://graph.facebook.com').replace(
    /\/+$/,
    '',
  );
  const parsed = new URL(baseUrl);
  if (parsed.protocol !== 'https:' && parsed.hostname !== '127.0.0.1') {
    throw new Error('WhatsApp Graph API base URL must use https');
  }
  return parsed.toString().replace(/\/+$/, '');
}

function buildMessagesEndpoint(
  baseUrl: string,
  graphApiVersion: string,
  phoneNumberId: string,
): string {
  return new URL(
    `${graphApiVersion}/${encodeURIComponent(phoneNumberId)}/messages`,
    `${baseUrl}/`,
  ).toString();
}

function validateOutboundText(to: string, body: string): void {
  if (!/^\d{6,20}$/.test(to)) {
    throw new WhatsAppDeliveryError('PERMANENT', 'WHATSAPP_INVALID_RECIPIENT');
  }
  if (body.length === 0 || body.length > MAX_TEXT_BODY_CHARS) {
    throw new WhatsAppDeliveryError('PERMANENT', 'WHATSAPP_INVALID_TEXT_BODY');
  }
}

function transportError(err: unknown): WhatsAppDeliveryError {
  const name = err instanceof Error ? err.name : '';
  if (name === 'AbortError' || name === 'TimeoutError') {
    return new WhatsAppDeliveryError('RETRYABLE', 'WHATSAPP_SEND_TIMEOUT');
  }
  return new WhatsAppDeliveryError('RETRYABLE', 'WHATSAPP_NETWORK_ERROR');
}

async function providerHttpError(
  res: Response,
): Promise<WhatsAppDeliveryError> {
  const provider = await readProviderError(res);
  const failureKind = classifyStatus(res.status);
  return new WhatsAppDeliveryError(
    failureKind,
    failureKind === 'RETRYABLE'
      ? 'WHATSAPP_PROVIDER_RETRYABLE_FAILURE'
      : 'WHATSAPP_PROVIDER_PERMANENT_FAILURE',
    res.status,
    provider.code,
    provider.type,
  );
}

function classifyStatus(statusCode: number): WhatsAppDeliveryFailureKind {
  if (
    statusCode === 408 ||
    statusCode === 409 ||
    statusCode === 425 ||
    statusCode === 429 ||
    statusCode >= 500
  ) {
    return 'RETRYABLE';
  }
  return 'PERMANENT';
}

async function assertAcceptedResponse(res: Response): Promise<void> {
  const body = await boundedText(res);
  let parsed: unknown;
  try {
    parsed = JSON.parse(body) as unknown;
  } catch {
    throw new WhatsAppDeliveryError(
      'PERMANENT',
      'WHATSAPP_PROVIDER_MALFORMED_SUCCESS',
      res.status,
    );
  }
  const messages = isRecord(parsed) ? parsed.messages : undefined;
  const firstMessage =
    Array.isArray(messages) && isRecord(messages[0]) ? messages[0] : undefined;
  const id = firstMessage?.id;
  if (typeof id !== 'string' || !id.startsWith('wamid.')) {
    throw new WhatsAppDeliveryError(
      'PERMANENT',
      'WHATSAPP_PROVIDER_MALFORMED_SUCCESS',
      res.status,
    );
  }
}

async function readProviderError(
  res: Response,
): Promise<{ code?: string; type?: string }> {
  const text = await boundedText(res);
  let parsed: unknown;
  try {
    parsed = JSON.parse(text) as unknown;
  } catch {
    return {};
  }
  const error = isRecord(parsed) && isRecord(parsed.error) ? parsed.error : {};
  return {
    code: safeToken(error.code),
    type: safeToken(error.type),
  };
}

async function boundedText(res: Response): Promise<string> {
  const text = await res.text().catch(() => '');
  return text.slice(0, MAX_PROVIDER_ERROR_BODY_BYTES);
}

function safeToken(value: unknown): string | undefined {
  if (typeof value === 'number' && Number.isSafeInteger(value)) {
    return value.toString();
  }
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  return /^[A-Za-z0-9_.:-]{1,80}$/.test(trimmed) ? trimmed : undefined;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}
