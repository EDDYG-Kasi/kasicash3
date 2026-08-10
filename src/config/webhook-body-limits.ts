export const DEFAULT_WEBHOOK_POLICY_BYTES = 256 * 1024;
export const MIN_WEBHOOK_POLICY_BYTES = 1024;
export const MAX_WEBHOOK_POLICY_BYTES = 10 * 1024 * 1024;

// Keep a small envelope above the largest accepted policy so an authenticated
// over-policy delivery can still be durably quarantined. Bodies above this
// absolute transport ceiling are rejected before application processing as an
// anti-DoS boundary and therefore cannot be authenticated or persisted.
export const MAX_WEBHOOK_TRANSPORT_BYTES = MAX_WEBHOOK_POLICY_BYTES + 64 * 1024;

export interface WebhookBodyLimits {
  policyBytes: number;
  transportBytes: number;
}

export function resolveWebhookBodyLimits(raw?: string): WebhookBodyLimits {
  const parsed = raw === undefined ? DEFAULT_WEBHOOK_POLICY_BYTES : Number(raw);
  const policyBytes =
    Number.isInteger(parsed) &&
    parsed >= MIN_WEBHOOK_POLICY_BYTES &&
    parsed <= MAX_WEBHOOK_POLICY_BYTES
      ? parsed
      : DEFAULT_WEBHOOK_POLICY_BYTES;
  return {
    policyBytes,
    transportBytes: MAX_WEBHOOK_TRANSPORT_BYTES,
  };
}
