/**
 * Shared helpers for kit components.
 *
 * `ForcedState` lets the /kit component sheet show hover, pressed and focus side by side.
 * Components render it as `data-state`, and their CSS module styles `[data-state=…]`
 * with the same rule as the real pseudo-class, so the sheet shows exactly what users see.
 */
export type ForcedState = 'hover' | 'pressed' | 'focus';

export type DurationToken = '--dur-1' | '--dur-2' | '--dur-3' | '--dur-4';

export function cx(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(' ');
}

/** Reads a duration token from the running theme (so reduced motion is respected). */
export function readDurationMs(token: DurationToken): number {
  if (typeof window === 'undefined' || typeof getComputedStyle !== 'function') return 0;
  const raw = getComputedStyle(document.documentElement).getPropertyValue(token).trim();
  if (!raw) return 0;
  const value = parseFloat(raw);
  if (!Number.isFinite(value)) return 0;
  return raw.endsWith('ms') ? value : value * 1000;
}

/** True when motion tokens are collapsed (reduced motion) or unavailable. */
export function motionIsInstant(): boolean {
  return readDurationMs('--dur-1') <= 1;
}
