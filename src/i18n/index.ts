import { effect, signal } from '@preact/signals';
import type { ComponentChildren } from 'preact';
import { langSignal, type LocaleId } from '../domain/appearance';
import { en } from './locales/en';
import {
  formatLocaleNumber,
  formatLocalePercent,
  type FormatLocaleNumberOptions,
} from './localeNumbers';
import type { MessageCatalogue, MessageKey, PluralForms, TemplateVars } from './types';

export * from './localeNumbers';
export * from './localeNumberInput';

export const CATALOGUES: Partial<Record<LocaleId, MessageCatalogue>> = {
  en,
};

export const localeRevisionSignal = signal(0);
const pendingLoads = new Map<LocaleId, Promise<MessageCatalogue>>();

export async function ensureLocaleLoaded(locale: LocaleId): Promise<MessageCatalogue> {
  const existing = CATALOGUES[locale];
  if (existing) return existing;
  const inflight = pendingLoads.get(locale);
  if (inflight) return inflight;

  const load = (
    locale === 'ru'
      ? import('./locales/ru').then((m) => m.ru)
      : locale === 'he'
        ? import('./locales/he').then((m) => m.he)
        : Promise.resolve(en)
  ).then((cat) => {
    CATALOGUES[locale] = cat;
    pendingLoads.delete(locale);
    localeRevisionSignal.value += 1;
    return cat;
  });

  pendingLoads.set(locale, load);
  return load;
}

effect(() => {
  const lang = langSignal.value;
  if (lang !== 'en' && !CATALOGUES[lang]) {
    void ensureLocaleLoaded(lang);
  }
});

const pluralRulesCache = new Map<LocaleId, Intl.PluralRules>();

function getPluralRules(locale: LocaleId): Intl.PluralRules {
  let pr = pluralRulesCache.get(locale);
  if (!pr) {
    pr = new Intl.PluralRules(locale);
    pluralRulesCache.set(locale, pr);
  }
  return pr;
}

export function formatNumber(
  value: number,
  options?: FormatLocaleNumberOptions,
  locale: LocaleId = langSignal.value,
): string {
  return formatLocaleNumber(value, options, locale);
}

/** Formats a `[0, 1]` proportion (e.g. `0.256` -> `'25.6%'`) via the unified locale formatter. */
export function formatPercent(
  value: number,
  decimals = 1,
  locale: LocaleId = langSignal.value,
): string {
  return formatLocalePercent(value * 100, decimals, locale);
}

function selectPluralTemplate(forms: PluralForms, count: number, locale: LocaleId): string {
  if (count === 0 && forms.zero !== undefined) {
    return forms.zero;
  }
  const category = getPluralRules(locale).select(count);
  return forms[category] ?? forms.other;
}

function interpolate(
  template: string,
  vars: TemplateVars | undefined,
  locale: LocaleId,
): string {
  if (!vars) return template;
  return template.replace(/\{(\w+)\}/g, (match, name: string) => {
    const val = vars[name];
    if (val === undefined) return match;
    if (typeof val === 'number') {
      return formatNumber(val, undefined, locale);
    }
    return String(val);
  });
}

function resolveTemplate(key: MessageKey, vars: TemplateVars | undefined, locale: LocaleId): string {
  void localeRevisionSignal.value;
  const catalogue = CATALOGUES[locale] ?? en;
  const entry = catalogue[key];
  if (typeof entry === 'string') return entry;
  const count = typeof vars?.count === 'number' ? vars.count : 0;
  return selectPluralTemplate(entry, count, locale);
}

/**
 * Like t(), but lets named slots carry nodes (for example a <PokerNotation> amount)
 * so a sentence stays one template and is never assembled by concatenation.
 */
export function tNodes(
  key: MessageKey,
  slots: Record<string, ComponentChildren>,
  vars?: TemplateVars,
  locale: LocaleId = langSignal.value,
): ComponentChildren[] {
  const template = resolveTemplate(key, vars, locale);
  const out: ComponentChildren[] = [];
  const push = (piece: ComponentChildren) => {
    if (typeof piece === 'string' && typeof out[out.length - 1] === 'string') {
      out[out.length - 1] = `${out[out.length - 1] as string}${piece}`;
    } else {
      out.push(piece);
    }
  };
  const re = /\{(\w+)\}/g;
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(template))) {
    if (m.index > last) push(template.slice(last, m.index));
    const name = m[1] as string;
    if (name in slots) {
      push(slots[name]);
    } else {
      push(interpolate(m[0], vars, locale));
    }
    last = m.index + m[0].length;
  }
  if (last < template.length) push(template.slice(last));
  return out;
}

export function t(
  key: MessageKey,
  vars?: TemplateVars,
  locale: LocaleId = langSignal.value,
): string {
  return interpolate(resolveTemplate(key, vars, locale), vars, locale);
}
