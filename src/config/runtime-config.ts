export type RuntimeEnvironment = Record<string, string | undefined>;

export function validateRuntimeConfiguration(
  env: RuntimeEnvironment = process.env,
): void {
  const production = env.NODE_ENV === 'production';
  const databaseMode = env.KASICASH_DB_MODE?.trim().toLowerCase();

  if (databaseMode && databaseMode !== 'postgres') {
    throw new Error('KASICASH_DB_MODE must be postgres');
  }
  if (production && env.KASICASH_DEV_TOOLS === 'true') {
    throw new Error('Developer tools cannot be enabled in production');
  }
  if (production && env.KASICASH_AUTH_COOKIE_SECURE === 'false') {
    throw new Error('Secure auth cookies cannot be disabled in production');
  }
  if (production && env.KASICASH_WHATSAPP_MODE !== 'cloud') {
    throw new Error('KASICASH_WHATSAPP_MODE=cloud is required in production');
  }
  if (
    production &&
    (!env.WHATSAPP_ACCESS_TOKEN?.trim() ||
      !env.WHATSAPP_PHONE_NUMBER_ID?.trim() ||
      !env.WHATSAPP_APP_SECRET?.trim() ||
      !env.WHATSAPP_VERIFY_TOKEN?.trim())
  ) {
    throw new Error('Complete WhatsApp credentials are required in production');
  }
  if (
    env.WHATSAPP_PHONE_NUMBER_ID?.trim() &&
    !/^\d{5,32}$/.test(env.WHATSAPP_PHONE_NUMBER_ID.trim())
  ) {
    throw new Error('WHATSAPP_PHONE_NUMBER_ID must be numeric');
  }
  if (
    env.WHATSAPP_GRAPH_API_VERSION?.trim() &&
    !/^v\d+\.\d+$/.test(env.WHATSAPP_GRAPH_API_VERSION.trim())
  ) {
    throw new Error('WHATSAPP_GRAPH_API_VERSION must look like v24.0');
  }
  if (
    env.WHATSAPP_SEND_TIMEOUT_MS?.trim() &&
    (!/^\d+$/.test(env.WHATSAPP_SEND_TIMEOUT_MS.trim()) ||
      Number(env.WHATSAPP_SEND_TIMEOUT_MS) < 1000 ||
      Number(env.WHATSAPP_SEND_TIMEOUT_MS) > 30_000)
  ) {
    throw new Error('WHATSAPP_SEND_TIMEOUT_MS must be between 1000 and 30000');
  }
}

export function includeDevelopmentControllers(
  env: RuntimeEnvironment = process.env,
): boolean {
  return env.NODE_ENV !== 'production';
}
