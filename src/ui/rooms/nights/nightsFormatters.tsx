import { minorToMajorNumber, type EngineClient, type HomeGameCurrency } from '../../../engine-api';
import { formatNumber } from '../../../i18n';
import { PokerNotation } from '../../../i18n/PokerNotation';

export function majorDecimals(amountMinor: number, minorUnit: 0 | 2): 0 | 2 {
  return minorUnit === 2 && amountMinor % 100 !== 0 ? 2 : 0;
}

export function formatNightAmountText(
  _engine: EngineClient,
  amountMinor: number,
  currency: Pick<HomeGameCurrency, 'label' | 'minorUnit' | 'unitPreset'>,
  options: { readonly signed?: boolean; readonly trimWholeDecimals?: boolean } = {},
): string {
  const absMinor = Math.abs(amountMinor);
  const decCount =
    options.trimWholeDecimals === false
      ? currency.minorUnit
      : majorDecimals(absMinor, currency.minorUnit);
  const absMajor = minorToMajorNumber(absMinor, currency.minorUnit);
  const formatted = formatNumber(absMajor, {
    minimumFractionDigits: decCount,
    maximumFractionDigits: decCount,
  });
  const sign = amountMinor < 0 ? '−' : options.signed && amountMinor > 0 ? '+' : '';
  if (currency.unitPreset === 'ils') {
    return `${sign}${currency.label}${formatted}`;
  }
  return `${sign}${formatted} ${currency.label}`;
}

export function NightAmount({
  engine,
  amountMinor,
  currency,
  signed = false,
}: {
  readonly engine: EngineClient;
  readonly amountMinor: number;
  readonly currency: Pick<HomeGameCurrency, 'label' | 'minorUnit' | 'unitPreset'>;
  readonly signed?: boolean;
}) {
  return (
    <PokerNotation>
      {formatNightAmountText(engine, amountMinor, currency, {
        signed,
        trimWholeDecimals: true,
      })}
    </PokerNotation>
  );
}

export function formatTimeShort(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
}
