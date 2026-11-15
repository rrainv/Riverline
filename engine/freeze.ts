/**
 * Recursively freezes objects and arrays in place.
 */
export function deepFreeze<T>(value: T): T {
  if (!value || typeof value !== 'object') return value;
  if (!Object.isFrozen(value)) {
    Object.freeze(value);
  }
  const children = Array.isArray(value) ? value : Object.values(value as Record<string, unknown>);
  for (const child of children) {
    if (child && typeof child === 'object' && !Object.isFrozen(child)) {
      deepFreeze(child);
    }
  }
  return value;
}

/**
 * Pure ES2022 structural deep clone for plain objects and arrays (no DOM structuredClone needed).
 */
export function cloneData<T>(value: T): T {
  if (value === null || typeof value !== 'object') return value;
  if (Array.isArray(value)) {
    return value.map((item) => cloneData(item)) as unknown as T;
  }
  const source = value as Record<string, unknown>;
  const target: Record<string, unknown> = {};
  for (const key of Object.keys(source)) {
    target[key] = cloneData(source[key]);
  }
  return target as T;
}

/**
 * Canonical structural equality check for JSON-shaped domain records and arrays.
 */
export function dataEquals(left: unknown, right: unknown): boolean {
  if (Object.is(left, right)) return true;
  if (left === null || right === null || typeof left !== 'object' || typeof right !== 'object') {
    return false;
  }
  if (Array.isArray(left) !== Array.isArray(right)) return false;
  if (Array.isArray(left) && Array.isArray(right)) {
    return left.length === right.length && left.every((item, index) => dataEquals(item, right[index]));
  }
  const leftObj = left as Record<string, unknown>;
  const rightObj = right as Record<string, unknown>;
  const leftKeys = Object.keys(leftObj).sort();
  const rightKeys = Object.keys(rightObj).sort();
  return (
    leftKeys.length === rightKeys.length &&
    leftKeys.every((key, index) => key === rightKeys[index] && dataEquals(leftObj[key], rightObj[key]))
  );
}
