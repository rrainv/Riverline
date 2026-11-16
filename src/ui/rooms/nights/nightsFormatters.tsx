import type { EngineClient, HomeGameCurrency } from '../../../engine-api';
import { PokerNotation } from '../../../i18n/PokerNotation';

export function formatNightAmountText(
  engine: EngineClient,
  amountMinor: number,
  currency: Pick<HomeGameCurrency, 'label' | 'minorUnit' | 'unitPreset'>,
  options: { readonly signed?: boolean; readonly trimWholeDecimals?: boolean } = {},
): string {
  const res = engine.sync.formatHomeGameAmount(amountMinor, currency, options);
  return res.ok ? res.data : String(amountMinor);
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
