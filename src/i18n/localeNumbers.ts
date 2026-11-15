import { appearanceSignal, isLocaleId, type LocaleId } from '../domain/appearance';

export const LOCALE_NUMBER_FORMAT_SCHEMA_VERSION = 'locale-number-format/v1' as const;
export const UNKNOWN_NUMBER_TEXT = '-';

const SUPPORTED_LOCALES = new Set<string>(['en', 'ru', 'he']);
const FORMATTER_CACHE = new Map<string, Intl.NumberFormat>();

// Bidi marks (\u200e LRM, \u200f RLM, \u061c ALM, \u202a-\u202e isolates/embeddings, \u2066-\u2069)
const BIDI_MARKS = /[\u200e\u200f\u061c\u202a-\u202e\u2066-\u2069]/g;
const SPACE_LIKE = /[\s'\u2019]/g;
const MINUS_LIKE = /[\u2212\u2013\u2010]/g;

export interface FormatLocaleNumberOptions extends Intl.NumberFormatOptions {
  readonly language?: unknown;
}

/**
 * Resolves the UI language (`en`, `ru`, `he`), never using the operating system's locale.
 * Priority: explicit `language` -> `window.appLang` -> `document.documentElement.lang` -> `appearanceSignal` -> `'en'`.
 */
export function activeLocale(language?: unknown): LocaleId {
  let raw: string | undefined;
  if (typeof language === 'string' && language.trim()) {
    raw = language;
  } else if (
    typeof window !== 'undefined' &&
    typeof (window as { appLang?: unknown }).appLang === 'string' &&
    ((window as { appLang?: string }).appLang ?? '').trim()
  ) {
    raw = (window as { appLang?: string }).appLang;
  } else if (
    typeof document !== 'undefined' &&
    typeof document.documentElement?.lang === 'string' &&
    document.documentElement.lang.trim()
  ) {
    raw = document.documentElement.lang;
  } else {
    raw = appearanceSignal.value.lang;
  }
  const normalized = String(raw ?? 'en')
    .trim()
    .toLowerCase()
    .split(/[-_]/)[0] ?? 'en';
  return SUPPORTED_LOCALES.has(normalized) && isLocaleId(normalized) ? normalized : 'en';
}

function getFormatter(
  locale: LocaleId,
  minimumFractionDigits: number,
  maximumFractionDigits: number,
  useGrouping = true,
  extra?: Intl.NumberFormatOptions,
): Intl.NumberFormat {
  if (extra && (extra.style || extra.notation || extra.currency)) {
    return new Intl.NumberFormat(locale, {
      minimumFractionDigits,
      maximumFractionDigits,
      useGrouping,
      ...extra,
    });
  }
  const key = `${locale}:${minimumFractionDigits}:${maximumFractionDigits}:${useGrouping ? 1 : 0}`;
  let formatter = FORMATTER_CACHE.get(key);
  if (!formatter) {
    formatter = new Intl.NumberFormat(locale, {
      minimumFractionDigits,
      maximumFractionDigits,
      useGrouping,
    });
    FORMATTER_CACHE.set(key, formatter);
  }
  return formatter;
}

/** Formats a numeric value using the app language, returning `'-'` for unknown/non-finite inputs. */
export function formatLocaleNumber(
  value: unknown,
  options: FormatLocaleNumberOptions = {},
  language?: unknown,
): string {
  if (value === null || value === undefined || value === '') return UNKNOWN_NUMBER_TEXT;
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return UNKNOWN_NUMBER_TEXT;

  const locale = activeLocale(language ?? options?.language);
  const minimumFractionDigits = Number.isInteger(options?.minimumFractionDigits)
    ? options.minimumFractionDigits!
    : 0;
  const maximumFractionDigits = Number.isInteger(options?.maximumFractionDigits)
    ? Math.max(minimumFractionDigits, options.maximumFractionDigits!)
    : Math.max(minimumFractionDigits, 2);
  const useGrouping = options?.useGrouping !== false;
  const normalized = Object.is(numeric, -0) ? 0 : numeric;
  const { language: _lang, ...intlOpts } = options;
  const hasExtra =
    intlOpts.style !== undefined ||
    intlOpts.notation !== undefined ||
    intlOpts.currency !== undefined;

  const text = getFormatter(
    locale,
    minimumFractionDigits,
    maximumFractionDigits,
    useGrouping,
    hasExtra ? intlOpts : undefined,
  ).format(normalized);

  // A value that rounds to zero is shown as zero, not "-0".
  return text.replace(/^[-−](?=0(?:\D0*)?$)/, '');
}

export function formatLocaleFixed(
  value: unknown,
  digits = 1,
  language?: unknown,
  opts: { readonly useGrouping?: boolean } = {},
): string {
  const d = Number.isInteger(digits) && digits >= 0 ? digits : 0;
  return formatLocaleNumber(
    value,
    {
      minimumFractionDigits: d,
      maximumFractionDigits: d,
      useGrouping: opts.useGrouping ?? false,
    },
    language,
  );
}

export function formatLocaleInteger(value: unknown, language?: unknown): string {
  return formatLocaleNumber(
    value,
    { minimumFractionDigits: 0, maximumFractionDigits: 0, useGrouping: true },
    language,
  );
}

export function formatLocalePercent(
  value: unknown,
  digits = 1,
  language?: unknown,
): string {
  const text = formatLocaleFixed(value, digits, language);
  return text === UNKNOWN_NUMBER_TEXT ? text : `${text}%`;
}

export function formatLocaleBb(value: unknown, language?: unknown): string {
  const text = formatLocaleNumber(
    value,
    { minimumFractionDigits: 0, maximumFractionDigits: 2 },
    language,
  );
  return text === UNKNOWN_NUMBER_TEXT ? text : `${text} bb`;
}

/** Wraps a formatted numeric string in Unicode Left-to-Right Isolate markers for plain-text RTL contexts. */
export function isolateLocaleText(text: string): string {
  return `\u2066${text}\u2069`;
}

function groupedPattern(separator: '.' | ','): RegExp {
  return separator === '.' ? /^\d{1,3}(?:\.\d{3})+$/ : /^\d{1,3}(?:,\d{3})+$/;
}

/**
 * Parses numeric input accepting either `.` or `,` regardless of UI language.
 * Returns `NaN` for incomplete/non-numeric strings; strips bidi marks and spacing.
 */
export function parseLocaleNumber(text: unknown): number {
  if (typeof text === 'number') return Number.isFinite(text) ? text : Number.NaN;
  if (typeof text !== 'string') return Number.NaN;
  const cleaned = text.replace(BIDI_MARKS, '').replace(MINUS_LIKE, '-').replace(SPACE_LIKE, '');
  const match = /^([+-]?)([\d.,]+)$/.exec(cleaned);
  if (!match) return Number.NaN;
  const negative = match[1] === '-';
  const body = match[2]!;
  const dots = body.split('.').length - 1;
  const commas = body.split(',').length - 1;
  let normalized: string;
  if (dots > 0 && commas > 0) {
    const decimal: '.' | ',' = body.lastIndexOf('.') > body.lastIndexOf(',') ? '.' : ',';
    const group: '.' | ',' = decimal === '.' ? ',' : '.';
    const parts = body.split(decimal);
    if (
      parts.length !== 2 ||
      !/^\d*$/.test(parts[1] ?? '') ||
      !groupedPattern(group).test(parts[0] ?? '')
    ) {
      return Number.NaN;
    }
    normalized = `${parts[0]!.split(group).join('')}.${parts[1]}`;
  } else if (dots + commas > 1) {
    const separator: '.' | ',' = dots > 0 ? '.' : ',';
    if (!groupedPattern(separator).test(body)) return Number.NaN;
    normalized = body.split(separator).join('');
  } else {
    normalized = body.replace(',', '.');
  }
  if (!/\d/.test(normalized)) return Number.NaN;
  const value = Number(normalized);
  if (!Number.isFinite(value)) return Number.NaN;
  return value === 0 ? 0 : negative ? -value : value;
}

/** Display text for an editable numeric field: app decimal separator, no grouping, empty string if non-finite. */
export function formatLocaleInputNumber(
  value: unknown,
  language?: unknown,
  maximumFractionDigits = 6,
): string {
  const numeric = typeof value === 'number' ? value : parseLocaleNumber(String(value ?? ''));
  if (!Number.isFinite(numeric)) return '';
  return formatLocaleNumber(
    numeric,
    { minimumFractionDigits: 0, maximumFractionDigits, useGrouping: false },
    language,
  ).replace(BIDI_MARKS, '');
}
