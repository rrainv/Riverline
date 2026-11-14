import { appearanceSignal, type LocaleId } from '../domain/appearance';
import { en } from './locales/en';
import { he } from './locales/he';
import { ru } from './locales/ru';
import type { MessageCatalogue, MessageKey, PluralForms, TemplateVars } from './types';

export const CATALOGUES: Record<LocaleId, MessageCatalogue> = {
  en,
  ru,
  he,
};

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
  options?: Intl.NumberFormatOptions,
  locale: LocaleId = appearanceSignal.value.lang,
): string {
  return new Intl.NumberFormat(locale, options).format(value);
}

export function formatPercent(
  value: number,
  decimals = 1,
  locale: LocaleId = appearanceSignal.value.lang,
): string {
  return new Intl.NumberFormat(locale, {
    style: 'percent',
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(value);
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

export function t(
  key: MessageKey,
  vars?: TemplateVars,
  locale: LocaleId = appearanceSignal.value.lang,
): string {
  const catalogue = CATALOGUES[locale] ?? CATALOGUES.en;
  const entry = catalogue[key];
  if (typeof entry === 'string') {
    return interpolate(entry, vars, locale);
  }
  const count = typeof vars?.count === 'number' ? vars.count : 0;
  const template = selectPluralTemplate(entry, count, locale);
  return interpolate(template, vars, locale);
}
