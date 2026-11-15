import { activeLocale, formatLocaleInputNumber, parseLocaleNumber } from './localeNumbers';

export const LOCALE_NUMBER_INPUT_SCHEMA_VERSION = 'locale-number-input/v1' as const;

const ENTRY_CHARACTERS = /^[\d.,\s'\u2019+\-\u2212\u2013\u2010\u200e\u200f\u061c]*$/;
const boundControllers = new WeakMap<HTMLInputElement, LocaleNumberInputController>();

export interface LocaleNumberInputController {
  readonly schemaVersion: typeof LOCALE_NUMBER_INPUT_SCHEMA_VERSION;
  refresh(): void;
  dispose(): void;
}

export interface BindLocaleNumberInputOptions {
  readonly language?: () => unknown;
  readonly fractionDigits?: number;
  readonly view?: Window & typeof globalThis;
}

function nativeValueDescriptor(input: HTMLInputElement): PropertyDescriptor | null {
  for (
    let prototype = Object.getPrototypeOf(input) as object | null;
    prototype;
    prototype = Object.getPrototypeOf(prototype) as object | null
  ) {
    const descriptor = Object.getOwnPropertyDescriptor(prototype, 'value');
    if (descriptor?.get && descriptor?.set) return descriptor;
  }
  return null;
}

export function bindLocaleNumberInput(
  input: HTMLInputElement | null | undefined,
  options: BindLocaleNumberInputOptions = {},
): LocaleNumberInputController | null {
  if (!input) return null;
  const existing = boundControllers.get(input);
  if (existing) return existing;

  const native = nativeValueDescriptor(input);
  if (!native?.get || !native?.set) return null;

  const {
    language = () => undefined,
    fractionDigits = 6,
    view = globalThis as unknown as Window & typeof globalThis,
  } = options;

  const readDisplay = (): string => String(native.get!.call(input) ?? '');
  const writeDisplay = (text: string): void => {
    native.set!.call(input, text);
  };
  const locale = () => activeLocale(language());
  const display = (number: number) => formatLocaleInputNumber(number, locale(), fractionDigits);

  input.type = 'text';
  input.setAttribute('inputmode', 'decimal');
  input.setAttribute('autocomplete', 'off');
  input.setAttribute('spellcheck', 'false');
  input.setAttribute('data-locale-number', '');

  const canonical = (): string => {
    const text = readDisplay();
    const number = parseLocaleNumber(text);
    if (Number.isFinite(number)) return String(number);
    return text.trim() === '' ? '' : text;
  };

  Object.defineProperty(input, 'value', {
    configurable: true,
    get: canonical,
    set(next: unknown) {
      const text = next === null || next === undefined ? '' : String(next);
      const number = parseLocaleNumber(text);
      writeDisplay(Number.isFinite(number) ? display(number) : text);
    },
  });

  Object.defineProperty(input, 'valueAsNumber', {
    configurable: true,
    get: () => parseLocaleNumber(readDisplay()),
    set(next: number) {
      writeDisplay(Number.isFinite(next) ? display(next) : '');
    },
  });

  // Complete text is rewritten in the app language once the user leaves the field
  // or the language changes; half-typed text ("2,", "abc") is never touched.
  const normalize = (): void => {
    const number = parseLocaleNumber(readDisplay());
    if (!Number.isFinite(number)) return;
    const text = display(number);
    if (text !== readDisplay()) writeDisplay(text);
  };

  const onPaste = (event: ClipboardEvent): void => {
    const pasted = event.clipboardData?.getData('text');
    if (typeof pasted !== 'string' || !ENTRY_CHARACTERS.test(pasted)) return;
    const number = parseLocaleNumber(pasted);
    if (!Number.isFinite(number)) return;
    event.preventDefault();
    const text = display(number);
    const start = input.selectionStart ?? readDisplay().length;
    const end = input.selectionEnd ?? start;
    const current = readDisplay();
    writeDisplay(current.slice(0, start) + text + current.slice(end));
    const caret = start + text.length;
    input.setSelectionRange?.(caret, caret);
    const EventCtor = view.Event ?? globalThis.Event;
    input.dispatchEvent(new EventCtor('input', { bubbles: true }));
  };

  const onLanguage = (): void => normalize();
  input.addEventListener('change', normalize);
  input.addEventListener('blur', normalize);
  input.addEventListener('paste', onPaste);
  view.addEventListener?.('riverline:languagechange', onLanguage);
  normalize();

  const controller: LocaleNumberInputController = Object.freeze({
    schemaVersion: LOCALE_NUMBER_INPUT_SCHEMA_VERSION,
    refresh: normalize,
    dispose() {
      input.removeEventListener('change', normalize);
      input.removeEventListener('blur', normalize);
      input.removeEventListener('paste', onPaste);
      view.removeEventListener?.('riverline:languagechange', onLanguage);
      Reflect.deleteProperty(input, 'value');
      Reflect.deleteProperty(input, 'valueAsNumber');
      boundControllers.delete(input);
    },
  });
  boundControllers.set(input, controller);
  return controller;
}

export function bindLocaleNumberInputs(
  root: ParentNode | null | undefined,
  options?: BindLocaleNumberInputOptions,
): LocaleNumberInputController[] {
  if (!root?.querySelectorAll) return [];
  return [...root.querySelectorAll<HTMLInputElement>('[data-locale-number]')]
    .map((input) => bindLocaleNumberInput(input, options))
    .filter((ctrl): ctrl is LocaleNumberInputController => ctrl !== null);
}

export function createLocaleNumberInputBridge(options: BindLocaleNumberInputOptions = {}) {
  return Object.freeze({
    schemaVersion: LOCALE_NUMBER_INPUT_SCHEMA_VERSION,
    bind: (input: HTMLInputElement | null | undefined, overrides?: BindLocaleNumberInputOptions) =>
      bindLocaleNumberInput(input, { ...options, ...overrides }),
    bindAll: (root: ParentNode | null | undefined, overrides?: BindLocaleNumberInputOptions) =>
      bindLocaleNumberInputs(root, { ...options, ...overrides }),
  });
}
