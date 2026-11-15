import { render } from 'preact';
import { afterEach, describe, expect, it } from 'vitest';
import { appearanceSignal, DEFAULT_APPEARANCE } from '../domain/appearance';
import {
  activeLocale,
  bindLocaleNumberInput,
  bindLocaleNumberInputs,
  createLocaleNumberInputBridge,
  formatLocaleBb,
  formatLocaleFixed,
  formatLocaleInputNumber,
  formatLocaleInteger,
  formatLocaleNumber,
  formatLocalePercent,
  isolateLocaleText,
  parseLocaleNumber,
  UNKNOWN_NUMBER_TEXT,
} from './index';
import { PokerNotation } from './PokerNotation';

describe('locale number formatting, parsing, and RTL bidi isolation', () => {
  afterEach(() => {
    delete (window as { appLang?: string }).appLang;
    document.documentElement.lang = 'en';
    appearanceSignal.value = { ...DEFAULT_APPEARANCE };
  });

  it('resolves UI language by priority and never falls back to unknown tags', () => {
    appearanceSignal.value = { ...DEFAULT_APPEARANCE, lang: 'he' };
    expect(activeLocale()).toBe('he');

    document.documentElement.lang = 'ru';
    expect(activeLocale()).toBe('ru');

    (window as { appLang?: string }).appLang = 'en-US';
    expect(activeLocale()).toBe('en');

    expect(activeLocale('ru-RU')).toBe('ru');
    expect(activeLocale('he-IL')).toBe('he');
    expect(activeLocale('fr-FR')).toBe('en');
  });

  it('formats EN, RU, and HE decimals and grouping cleanly, without -0 or NaN leakage', () => {
    expect(formatLocaleNumber(1234.5, { minimumFractionDigits: 1, maximumFractionDigits: 1 }, 'en')).toBe(
      '1,234.5',
    );
    expect(formatLocaleNumber(1234.5, { minimumFractionDigits: 1, maximumFractionDigits: 1 }, 'ru')).toBe(
      '1\u00A0234,5',
    );
    expect(formatLocaleNumber(1234.5, { minimumFractionDigits: 1, maximumFractionDigits: 1 }, 'he')).toBe(
      '1,234.5',
    );

    expect(formatLocaleFixed(25.64, 1, 'ru')).toBe('25,6');
    expect(formatLocaleFixed(-0.0001, 1, 'en')).toBe('0.0');
    expect(formatLocaleFixed(-0, 1, 'ru')).toBe('0,0');
    expect(formatLocaleInteger(1070190, 'en')).toBe('1,070,190');
    expect(formatLocalePercent(91.2, 1, 'ru')).toBe('91,2%');
    expect(formatLocaleBb(2.5, 'ru')).toBe('2,5 bb');

    for (const unknown of [null, undefined, '', Number.NaN, Number.POSITIVE_INFINITY, 'not-a-num']) {
      expect(formatLocaleNumber(unknown, {}, 'en')).toBe(UNKNOWN_NUMBER_TEXT);
      expect(formatLocalePercent(unknown, 1, 'ru')).toBe(UNKNOWN_NUMBER_TEXT);
      expect(formatLocaleBb(unknown, 'he')).toBe(UNKNOWN_NUMBER_TEXT);
    }
  });

  it('parses dot, comma, grouped, negative-sign, and bidi-isolated numeric strings', () => {
    expect(parseLocaleNumber('2.5')).toBe(2.5);
    expect(parseLocaleNumber('2,5')).toBe(2.5);
    expect(parseLocaleNumber('1,234.5')).toBe(1234.5);
    expect(parseLocaleNumber('1.234,5')).toBe(1234.5);
    expect(parseLocaleNumber('1\u00A0234,75')).toBe(1234.75);
    expect(parseLocaleNumber('\u22123,25')).toBe(-3.25);
    expect(parseLocaleNumber(isolateLocaleText('2,5'))).toBe(2.5);
    expect(Object.is(parseLocaleNumber('-0'), 0)).toBe(true);
    expect(Object.is(parseLocaleNumber('-0.00'), 0)).toBe(true);

    expect(Number.isNaN(parseLocaleNumber(''))).toBe(true);
    expect(Number.isNaN(parseLocaleNumber('abc'))).toBe(true);
    expect(Number.isNaN(parseLocaleNumber('1.2.3'))).toBe(true);
    expect(Number.isNaN(parseLocaleNumber('1,2,3'))).toBe(true);
  });

  it('isolates RTL plain text and renders cards/ranges/amounts in <bdi dir="ltr">', () => {
    expect(isolateLocaleText('2.5 bb')).toBe('\u20662.5 bb\u2069');

    const host = document.createElement('div');
    document.body.appendChild(host);
    render(
      <div dir="rtl">
        <PokerNotation>AdKd</PokerNotation>
        <PokerNotation>2.5 bb</PokerNotation>
      </div>,
      host,
    );
    const bdis = [...host.querySelectorAll('bdi')];
    expect(bdis).toHaveLength(2);
    expect(bdis[0]?.getAttribute('dir')).toBe('ltr');
    expect(bdis[0]?.textContent).toBe('AdKd');
    expect(bdis[1]?.textContent).toBe('2.5 bb');
  });
});

describe('localeNumberInput DOM controller and language reactivity', () => {
  afterEach(() => {
    document.body.innerHTML = '';
    delete (window as { appLang?: string }).appLang;
    document.documentElement.lang = 'en';
  });

  it('displays localized decimal separator while exposing dot-decimal .value and .valueAsNumber', () => {
    let lang = 'ru';
    const input = document.createElement('input');
    document.body.appendChild(input);

    const nativeValue = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!;
    const ctrl = bindLocaleNumberInput(input, { language: () => lang });
    expect(ctrl).not.toBeNull();
    expect(input.type).toBe('text');
    expect(input.getAttribute('inputmode')).toBe('decimal');
    expect(input.hasAttribute('data-locale-number')).toBe(true);

    input.value = '2.75';
    expect(nativeValue.get?.call(input)).toBe('2,75');
    expect(input.value).toBe('2.75');
    expect(input.valueAsNumber).toBe(2.75);

    // Language change rewrites complete value into the active locale without losing canonical number
    lang = 'en';
    window.dispatchEvent(new Event('riverline:languagechange'));
    expect(nativeValue.get?.call(input)).toBe('2.75');
    expect(input.value).toBe('2.75');

    // Half-typed input preserves raw display until blur/change
    nativeValue.set?.call(input, '2,');
    input.dispatchEvent(new Event('input', { bubbles: true }));
    expect(nativeValue.get?.call(input)).toBe('2,');
    expect(input.valueAsNumber).toBe(2);

    // Non-numeric text stays untouched on blur
    nativeValue.set?.call(input, 'abc');
    input.dispatchEvent(new Event('blur'));
    expect(nativeValue.get?.call(input)).toBe('abc');
    expect(Number.isNaN(input.valueAsNumber)).toBe(true);

    ctrl?.dispose();
  });

  it('normalizes pasted numbers and supports bindLocaleNumberInputs + bridge cleanup', () => {
    const container = document.createElement('div');
    const a = document.createElement('input');
    const b = document.createElement('input');
    a.setAttribute('data-locale-number', '');
    b.setAttribute('data-locale-number', '');
    container.append(a, b);
    document.body.appendChild(container);

    const controllers = bindLocaleNumberInputs(container, { language: () => 'ru' });
    expect(controllers).toHaveLength(2);

    const nativeValue = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!;
    const inputEvents: string[] = [];
    a.addEventListener('input', () => inputEvents.push(a.value));

    const pasteEvent = new Event('paste', { bubbles: true, cancelable: true }) as Event & {
      clipboardData: { getData: (type: string) => string };
    };
    pasteEvent.clipboardData = { getData: () => '1,234.5' };
    a.dispatchEvent(pasteEvent);

    expect(pasteEvent.defaultPrevented).toBe(true);
    expect(nativeValue.get?.call(a)).toBe(formatLocaleInputNumber(1234.5, 'ru'));
    expect(a.value).toBe('1234.5');
    expect(inputEvents).toEqual(['1234.5']);

    controllers.forEach((c) => c.dispose());
    expect(nativeValue.get?.call(a)).toBe('1234,5');
    expect(a.value).toBe('1234,5');

    const bridge = createLocaleNumberInputBridge({ language: () => 'he' });
    const single = document.createElement('input');
    const ctrl = bridge.bind(single);
    expect(ctrl).not.toBeNull();
    single.value = '0,75';
    expect(nativeValue.get?.call(single)).toBe('0.75');
    ctrl?.dispose();
  });
});
