import { createHmac, timingSafeEqual } from 'crypto';

/**
 * Verifies Meta's X-Hub-Signature-256 header: 'sha256=' + HMAC-SHA256(appSecret, rawBody).
 * Timing-safe comparison; never trust client input (Security Mindset).
 */
export function verifyWhatsAppSignature(
  appSecret: string,
  rawBody: Buffer,
  signatureHeader: string | undefined,
): boolean {
  if (!signatureHeader || !signatureHeader.startsWith('sha256=')) return false;
  const expected = createHmac('sha256', appSecret).update(rawBody).digest();
  const provided = Buffer.from(signatureHeader.slice('sha256='.length), 'hex');
  if (provided.length !== expected.length || expected.length === 0)
    return false;
  return timingSafeEqual(expected, provided);
}
