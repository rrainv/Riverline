import type { ComponentChildren } from 'preact';
import { t } from '../../../i18n';
import { Chip } from '../chip/Chip';
import styles from './KitSheet.module.css';

export type SheetStateKey =
  | 'rest'
  | 'hover'
  | 'pressed'
  | 'focus'
  | 'disabled'
  | 'selected'
  | 'error'
  | 'loading'
  | 'empty'
  | 'russianLong';

export const SHEET_STATE_ORDER: readonly SheetStateKey[] = [
  'rest',
  'hover',
  'pressed',
  'focus',
  'disabled',
  'selected',
  'error',
  'loading',
  'empty',
  'russianLong',
];

export type SheetStateMap = Partial<Record<SheetStateKey, ComponentChildren>>;

export function StateMatrix({
  states,
  title,
}: {
  states: SheetStateMap;
  title?: ComponentChildren;
}) {
  const presentKeys = SHEET_STATE_ORDER.filter((key) => {
    const cell = states[key];
    return cell !== undefined && cell !== null;
  });
  const missingKeys = SHEET_STATE_ORDER.filter((key) => {
    const cell = states[key];
    return cell === undefined || cell === null;
  });
  const naList = missingKeys.map((key) => t(`kit.state.${key}`)).join(', ');

  return (
    <div className={styles.matrixWrap}>
      {(title !== undefined || missingKeys.length > 0) && (
        <div className={styles.matrixHeader}>
          {title !== undefined && <h2 className={styles.specimenTitle}>{title}</h2>}
          {missingKeys.length > 0 && (
            <Chip>{`${t('kit.state.na')}: ${naList}`}</Chip>
          )}
        </div>
      )}
      <div className={styles.matrix}>
        {presentKeys.map((key) => {
          const cell = states[key];
          return (
            <div
              key={key}
              className={styles.cell}
              data-sheet-state={key}
              lang={key === 'russianLong' ? 'ru' : undefined}
              dir={key === 'russianLong' ? 'ltr' : undefined}
            >
              <div className={styles.cellLabel}>{t(`kit.state.${key}`)}</div>
              <div className={styles.cellStage}>{cell}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
