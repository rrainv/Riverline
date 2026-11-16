import { appearanceSignal } from '../../../domain/appearance';
import type { LearnGlossaryCategory, LearnStore } from '../../../domain/learn';
import { t } from '../../../i18n';
import type { MessageKey } from '../../../i18n/types';
import { PokerNotation } from '../../../i18n/PokerNotation';
import { Button } from '../../kit/button/Button';
import { ChipButton } from '../../kit/choice/Choice';
import { TextField } from '../../kit/input/TextField';
import { Panel } from '../../kit/panel/Panel';
import styles from './LearnRoom.module.css';

interface LearnGlossaryViewProps {
  readonly store: LearnStore;
  readonly compact?: boolean;
}

const CATEGORIES: readonly { readonly id: LearnGlossaryCategory; readonly key: MessageKey }[] = [
  { id: 'all', key: 'learn.glossary.catAll' },
  { id: 'actions', key: 'learn.glossary.catActions' },
  { id: 'table', key: 'learn.glossary.catTable' },
  { id: 'strategy', key: 'learn.glossary.catStrategy' },
  { id: 'product', key: 'learn.glossary.catProduct' },
];

function glossaryDefKey(id: string): MessageKey {
  return `learn.glossary.def.${id}` as MessageKey;
}

export function LearnGlossaryView({ store, compact = false }: LearnGlossaryViewProps) {
  const lang = appearanceSignal.value.lang;
  const query = store.glossaryQuerySignal.value;
  const category = store.glossaryCategorySignal.value;
  const allMatches = store.filteredGlossarySignal.value;

  const limit = compact ? 2 : allMatches.length;
  const shown = allMatches.slice(0, limit);

  return (
    <Panel title={compact ? undefined : t('learn.glossary.heading')} headingLevel="h2">
      <div className={compact ? styles.glossaryControlsCompact : styles.glossaryControls}>
        {compact && (
          <h2 className={styles.glossaryCompactTitle}>{t('learn.glossary.heading')}</h2>
        )}
        <div className={styles.glossarySearchBox}>
          <TextField
            value={query}
            onValueChange={(next) => store.setGlossaryQuery(next)}
            placeholder={t('learn.glossary.searchPlaceholder')}
            ariaLabel={t('learn.glossary.searchAria')}
            ltrInput={false}
          />
        </div>

        {!compact && (
          <div className={styles.glossaryCategoryRow} role="group" aria-label={t('learn.glossary.heading')}>
            {CATEGORIES.map((cat) => (
              <ChipButton
                key={cat.id}
                selected={category === cat.id}
                onToggle={() => store.setGlossaryCategory(cat.id)}
              >
                {t(cat.key)}
              </ChipButton>
            ))}
          </div>
        )}
      </div>

      <div className={styles.glossaryList}>
        {shown.map((entry) => {
          const primaryTerm = lang === 'ru' ? entry.ru : lang === 'he' ? entry.he : entry.en;
          return (
            <div key={entry.id} className={compact ? styles.glossaryRowCompact : styles.glossaryRow}>
              <span className={styles.glossaryTermPrimary}>
                {entry.isLatinAbbr ? <PokerNotation>{primaryTerm}</PokerNotation> : primaryTerm}
              </span>
              <div className={styles.glossaryDefColumn}>
                <span className={styles.glossaryDef}>{t(glossaryDefKey(entry.id))}</span>
                <div className={styles.glossaryTranslations}>
                  <span dir="ltr">
                    <PokerNotation>{entry.en}</PokerNotation>
                  </span>
                  <span dir="ltr">{entry.ru}</span>
                  <span dir="rtl">{entry.he}</span>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <div className={styles.glossaryFooter}>
        <p className={styles.glossaryNote}>
          {compact && allMatches.length > shown.length
            ? t('learn.glossary.previewNote', { shown: shown.length, total: allMatches.length })
            : t('learn.glossary.matchCount', { count: allMatches.length })}
        </p>
        {compact && (
          <Button
            variant="secondary"
            onClick={() => store.setActiveSection('glossary')}
          >
            {t('learn.glossary.openAll')}
          </Button>
        )}
      </div>
    </Panel>
  );
}
