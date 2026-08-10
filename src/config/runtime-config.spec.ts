import {
  includeDevelopmentControllers,
  validateRuntimeConfiguration,
} from './runtime-config';

describe('runtime configuration containment', () => {
  it('rejects every non-Postgres database mode', () => {
    expect(() =>
      validateRuntimeConfiguration({ KASICASH_DB_MODE: 'memory' }),
    ).toThrow('KASICASH_DB_MODE must be postgres');
    expect(() =>
      validateRuntimeConfiguration({
        NODE_ENV: 'production',
        KASICASH_DB_MODE: 'memory',
      }),
    ).toThrow('KASICASH_DB_MODE must be postgres');
  });

  it('rejects unsafe production modes before application initialization', () => {
    expect(() =>
      validateRuntimeConfiguration({
        NODE_ENV: 'production',
        KASICASH_DB_MODE: 'postgres',
        KASICASH_DEV_TOOLS: 'true',
        KASICASH_WHATSAPP_MODE: 'cloud',
      }),
    ).toThrow('Developer tools cannot be enabled in production');
    expect(() =>
      validateRuntimeConfiguration({
        NODE_ENV: 'production',
        KASICASH_DB_MODE: 'postgres',
        KASICASH_AUTH_COOKIE_SECURE: 'false',
        KASICASH_WHATSAPP_MODE: 'cloud',
      }),
    ).toThrow('Secure auth cookies cannot be disabled in production');
    expect(() =>
      validateRuntimeConfiguration({
        NODE_ENV: 'production',
        KASICASH_DB_MODE: 'postgres',
      }),
    ).toThrow('KASICASH_WHATSAPP_MODE=cloud is required in production');
  });

  it('only includes development controllers outside production', () => {
    expect(includeDevelopmentControllers({ NODE_ENV: 'production' })).toBe(
      false,
    );
    expect(includeDevelopmentControllers({ NODE_ENV: 'test' })).toBe(true);
  });

  it('accepts a fully contained production configuration', () => {
    expect(() =>
      validateRuntimeConfiguration({
        NODE_ENV: 'production',
        KASICASH_DB_MODE: 'postgres',
        KASICASH_WHATSAPP_MODE: 'cloud',
        KASICASH_AUTH_COOKIE_SECURE: 'true',
        WHATSAPP_ACCESS_TOKEN: 'token',
        WHATSAPP_PHONE_NUMBER_ID: '1234567890',
        WHATSAPP_APP_SECRET: 'app-secret',
        WHATSAPP_VERIFY_TOKEN: 'verify-token',
        WHATSAPP_GRAPH_API_VERSION: 'v24.0',
        WHATSAPP_SEND_TIMEOUT_MS: '5000',
      }),
    ).not.toThrow();
  });

  it('rejects malformed WhatsApp Cloud API version and timeout settings', () => {
    expect(() =>
      validateRuntimeConfiguration({ WHATSAPP_PHONE_NUMBER_ID: 'phone-id' }),
    ).toThrow('WHATSAPP_PHONE_NUMBER_ID must be numeric');
    expect(() =>
      validateRuntimeConfiguration({ WHATSAPP_GRAPH_API_VERSION: 'latest' }),
    ).toThrow('WHATSAPP_GRAPH_API_VERSION must look like v24.0');
    expect(() =>
      validateRuntimeConfiguration({ WHATSAPP_SEND_TIMEOUT_MS: '999' }),
    ).toThrow('WHATSAPP_SEND_TIMEOUT_MS must be between 1000 and 30000');
    expect(() =>
      validateRuntimeConfiguration({ WHATSAPP_SEND_TIMEOUT_MS: '1e4' }),
    ).toThrow('WHATSAPP_SEND_TIMEOUT_MS must be between 1000 and 30000');
  });
});
