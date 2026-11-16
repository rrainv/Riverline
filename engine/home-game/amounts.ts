import type { HomeGameCurrency } from './types';

function requireSafeInteger(value: number, label: string): number {
  if (!Number.isSafeInteger(value)) {
    throw new RangeError(`${label} must be a safe integer`);
  }
  return value;
}

/**
 * Exact decimal parser into integer minor units (e.g. minorUnit=2 for ILS agorot, 0 for chips).
 * Rejects scientific notation, non-numeric characters, and excessive fractional digits.
 */
export function parseHomeGameAmount(value: string | number, minorUnit: 0 | 2 = 0): number {
  if (minorUnit !== 0 && minorUnit !== 2) {
    throw new RangeError('Currency minor unit must be 0 or 2');
  }
  const normalized = String(value ?? '').trim();
  const match = /^([+-]?)(\d+)(?:\.(\d+))?$/.exec(normalized);
  if (!match) {
    throw new TypeError('Amount must be an exact decimal number');
  }
  const fraction = match[3] ?? '';
  if (fraction.length > minorUnit) {
    throw new RangeError(`Amount supports at most ${minorUnit} decimal places`);
  }
  const scale = 10n ** BigInt(minorUnit);
  const wholePart = BigInt(match[2]!) * scale;
  const fracPadded = (fraction + '0'.repeat(minorUnit)).slice(0, minorUnit) || '0';
  const absolute = wholePart + BigInt(fracPadded);
  const signed = match[1] === '-' ? -absolute : absolute;
  if (signed > BigInt(Number.MAX_SAFE_INTEGER) || signed < BigInt(Number.MIN_SAFE_INTEGER)) {
    throw new RangeError('Amount exceeds safe accounting range');
  }
  return Number(signed);
}

/**
 * Converts exact minor units to a major-unit number for display/stepper controls.
 */
export function minorToMajorNumber(amountMinor: number, minorUnit: 0 | 2): number {
  requireSafeInteger(amountMinor, 'Minor amount');
  if (minorUnit === 0) return amountMinor;
  return amountMinor / 100;
}

/**
 * Formats exact minor units into a deterministic decimal string without unit symbol.
 */
export function formatMinorUnitsDecimal(
  amountMinor: number,
  minorUnit: 0 | 2,
  options: { readonly trimWholeDecimals?: boolean } = {},
): string {
  requireSafeInteger(amountMinor, 'Minor amount');
  const negative = amountMinor < 0;
  const absolute = Math.abs(amountMinor);
  if (minorUnit === 0) {
    return `${negative ? '-' : ''}${absolute}`;
  }
  const whole = Math.floor(absolute / 100);
  const rem = absolute % 100;
  if (options.trimWholeDecimals && rem === 0) {
    return `${negative ? '-' : ''}${whole}`;
  }
  return `${negative ? '-' : ''}${whole}.${String(rem).padStart(2, '0')}`;
}

/**
 * Formats a home-game amount canonically for engine/notation readouts.
 */
export function formatHomeGameAmount(
  amountMinor: number,
  currency: Pick<HomeGameCurrency, 'label' | 'minorUnit' | 'unitPreset'>,
  options: { readonly signed?: boolean; readonly trimWholeDecimals?: boolean } = {},
): string {
  requireSafeInteger(amountMinor, 'Minor amount');
  const absMinor = Math.abs(amountMinor);
  const dec = formatMinorUnitsDecimal(absMinor, currency.minorUnit, {
    trimWholeDecimals: options.trimWholeDecimals ?? true,
  });
  const sign = amountMinor < 0 ? '−' : options.signed && amountMinor > 0 ? '+' : '';
  if (currency.unitPreset === 'ils') {
    return `${sign}${currency.label}${dec}`;
  }
  return `${sign}${dec} ${currency.label}`;
}
