import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import { appearanceSignal } from '../../domain/appearance';
import {
  ALL_ROUTE_IDS,
  closePalette,
  navigateTo,
  ROUTE_PATHS,
  type RouteId,
} from '../../domain/shellState';
import { CATALOGUES, t } from '../../i18n';
import { PokerNotation } from '../../i18n/PokerNotation';
import { RouteIcon, SearchIcon } from './Icons';
import styles from './CommandPalette.module.css';

interface CommandPaletteProps {
  open: boolean;
  activeRoute: RouteId;
  returnFocusTo?: HTMLElement | null;
}

export function CommandPalette({ open, activeRoute, returnFocusTo }: CommandPaletteProps) {
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const wasOpenRef = useRef(false);
  const lang = appearanceSignal.value.lang;

  const items = useMemo(
    () =>
      ALL_ROUTE_IDS.map((id) => ({
        id,
        label: t(`rooms.${id}.title`, undefined, lang),
        hint: ROUTE_PATHS[id],
        searchIndex: [
          id,
          ROUTE_PATHS[id],
          CATALOGUES.en[`rooms.${id}.title`],
          CATALOGUES.ru[`rooms.${id}.title`],
          CATALOGUES.he[`rooms.${id}.title`],
        ]
          .join(' ')
          .toLowerCase(),
      })),
    [lang, activeRoute],
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return items;
    return items.filter((item) => item.searchIndex.includes(q));
  }, [items, query]);

  useEffect(() => {
    if (open) {
      wasOpenRef.current = true;
      setQuery('');
      setSelectedIndex(0);
      queueMicrotask(() => {
        inputRef.current?.focus();
      });
    } else if (wasOpenRef.current) {
      wasOpenRef.current = false;
      if (returnFocusTo && returnFocusTo.isConnected) {
        returnFocusTo.focus();
      }
    }
  }, [open, returnFocusTo]);

  useEffect(() => {
    if (selectedIndex >= filtered.length) {
      setSelectedIndex(0);
    }
  }, [filtered.length, selectedIndex]);

  if (!open) return null;

  const handleKeyDown = (event: KeyboardEvent) => {
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      if (filtered.length > 0) {
        setSelectedIndex((prev) => (prev + 1) % filtered.length);
      }
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      if (filtered.length > 0) {
        setSelectedIndex((prev) => (prev - 1 + filtered.length) % filtered.length);
      }
    } else if (event.key === 'Enter') {
      const target = filtered[selectedIndex];
      if (target) {
        event.preventDefault();
        navigateTo(target.id);
      }
    }
  };

  return (
    <div
      className={styles.backdrop}
      role="dialog"
      aria-modal="true"
      aria-label={t('topbar.searchLabel')}
      onKeyDown={handleKeyDown}
    >
      <button
        type="button"
        className={styles.scrim}
        onClick={closePalette}
        aria-label={t('palette.close')}
        tabIndex={-1}
      />

      <div className={styles.dialog}>
        <div className={styles.searchRow}>
          <SearchIcon size={15} />
          <input
            ref={inputRef}
            type="text"
            className={styles.input}
            value={query}
            onInput={(e) => {
              setQuery(e.currentTarget.value);
              setSelectedIndex(0);
            }}
            placeholder={t('palette.placeholder')}
            aria-label={t('palette.inputLabel')}
          />
          <span className={styles.countChip}>
            {t('palette.resultCount', { count: filtered.length })}
          </span>
          <PokerNotation className={styles.kbd}>Esc</PokerNotation>
        </div>

        <div className={styles.list} role="listbox" aria-label={t('palette.inputLabel')}>
          {filtered.length === 0 ? (
            <div className={styles.empty}>{t('palette.empty')}</div>
          ) : (
            filtered.map((item, idx) => {
              const isSelected = idx === selectedIndex;
              return (
                <button
                  key={item.id}
                  type="button"
                  role="option"
                  aria-selected={isSelected}
                  className={
                    isSelected
                      ? `${styles.resultBtn} ${styles.resultBtnSelected}`
                      : styles.resultBtn
                  }
                  onClick={() => navigateTo(item.id)}
                  onMouseEnter={() => setSelectedIndex(idx)}
                >
                  <span className={styles.resultMain}>
                    <RouteIcon route={item.id} size={18} className={styles.resultIcon} />
                    <span>{item.label}</span>
                  </span>
                  <PokerNotation className={styles.resultHint}>{item.hint}</PokerNotation>
                </button>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
