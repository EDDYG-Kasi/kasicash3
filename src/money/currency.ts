export const SUPPORTED_CURRENCY_SCALES = {
  ZAR: 2,
  USD: 2,
  JPY: 0,
  BHD: 3,
} as const;

export type SupportedCurrency = keyof typeof SUPPORTED_CURRENCY_SCALES;

export function isSupportedCurrency(value: string): value is SupportedCurrency {
  return Object.prototype.hasOwnProperty.call(SUPPORTED_CURRENCY_SCALES, value);
}

export function currencyMinorUnitScale(currency: SupportedCurrency): number {
  return SUPPORTED_CURRENCY_SCALES[currency];
}

export const SUPPORTED_CURRENCY_CODES = Object.freeze(
  Object.keys(SUPPORTED_CURRENCY_SCALES) as SupportedCurrency[],
);
