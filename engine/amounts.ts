export const MILLI_BB_PER_BB = 1000 as const;

export function assertMilliBb(value: unknown, label = 'amount'): number {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < 0) {
    throw new TypeError(`${label} must be a nonnegative safe integer in milliBb`);
  }
  return value;
}

export function assertPositiveMilliBb(value: unknown, label = 'amount'): number {
  const valid = assertMilliBb(value, label);
  if (valid === 0) throw new RangeError(`${label} must be greater than zero`);
  return valid;
}

export function assertMilliBbAlignment(
  value: unknown,
  chipUnitMilliBb: unknown,
  label = 'amount',
): number {
  const valid = assertMilliBb(value, label);
  const unit = assertPositiveMilliBb(chipUnitMilliBb, 'chipUnitMilliBb');
  if (valid % unit !== 0) {
    throw new RangeError(`${label} must align to chipUnitMilliBb`);
  }
  return valid;
}

export function bbToMilliBb(valueBb: unknown, label = 'amountBb'): number {
  if (typeof valueBb !== 'number' || !Number.isFinite(valueBb) || valueBb < 0) {
    throw new TypeError(`${label} must be a nonnegative finite number`);
  }

  const scaled = valueBb * MILLI_BB_PER_BB;
  const rounded = Math.round(scaled);
  if (!Number.isSafeInteger(rounded) || Math.abs(scaled - rounded) > 1e-9) {
    throw new RangeError(`${label} cannot be represented exactly in integer milliBb`);
  }
  return rounded;
}

export function milliBbToBb(valueMilliBb: number, label = 'amountMilliBb'): number {
  return assertMilliBb(valueMilliBb, label) / MILLI_BB_PER_BB;
}
