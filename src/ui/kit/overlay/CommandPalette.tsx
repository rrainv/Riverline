import { useEffect, useId, useMemo, useRef, useState } from 'preact/hooks';
import { appearanceSignal } from '../../../domain/appearance';
import {
  ALL_ROUTE_IDS,
  closePalette,
  navigateTo,
  ROUTE_PATHS,
  type RouteId,
} from '../../../domain/shellState';
import { CATALOGUES, t } from '../../../i18n';
import { PokerNotation } from '../../../i18n/PokerNotation';
import { RouteIcon, SearchIcon } from '../icons/Icons';
import shimmer from '../shimmer/shimmer.module.css';
import { cx } from '../state';
import { trapFocusKeyDown, useEscapeLayer, useModalFocus } from './Overlay';
import styles from './CommandPalette.module.css';

export type CommandPaletteGroup = 'rooms' | 'hands' | 'concepts' | 'nights';

export interface CommandPaletteItem {
  readonly id: string;
  readonly group: CommandPaletteGroup;
  readonly label: string;
  readonly hint?: string;
  readonly searchIndex: string;
  readonly iconRoute?: RouteId;
  readonly onSelect: () => void;
}

const GROUP_ORDER: readonly CommandPaletteGroup[] = ['rooms', 'hands', 'concepts', 'nights'];

export interface CommandPaletteProps {
  open: boolean;
  activeRoute: RouteId;
  returnFocusTo?: HTMLElement | null;
  loading?: boolean;
  inlinePreview?: boolean;
  initialQuery?: string;
  extraItems?: readonly CommandPaletteItem[];
}

export function CommandPalette({
  open,
  activeRoute,
  returnFocusTo,
  loading = false,
  inlinePreview = false,
  initialQuery = '',
  extraItems,
}: CommandPaletteProps) {
  const [query, setQuery] = useState(initialQuery);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const dialogRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const listId = useId();
  const lang = appearanceSignal.value.lang;

  const baseItems: readonly CommandPaletteItem[] = useMemo(
    () =>
      ALL_ROUTE_IDS.map((id) => ({
        id,
        group: 'rooms' as const,
        label: t(`rooms.${id}.title`, undefined, lang),
        iconRoute: id,
        onSelect: () => navigateTo(id),
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

  const items = useMemo(
    () => (extraItems && extraItems.length > 0 ? [...baseItems, ...extraItems] : baseItems),
    [baseItems, extraItems],
  );

  const { sections, filtered } = useMemo(() => {
    const q = query.trim().toLowerCase();
    const matched = q
      ? items.filter((item) => item.searchIndex.toLowerCase().includes(q))
      : items;

    const byGroup = new Map<CommandPaletteGroup, CommandPaletteItem[]>();
    for (const group of GROUP_ORDER) {
      byGroup.set(group, []);
    }
    for (const item of matched) {
      byGroup.get(item.group)?.push(item);
    }

    const grouped: Array<{
      group: CommandPaletteGroup;
      items: readonly CommandPaletteItem[];
      startIndex: number;
    }> = [];
    const flat: CommandPaletteItem[] = [];

    for (const group of GROUP_ORDER) {
      const groupItems = byGroup.get(group);
      if (!groupItems || groupItems.length === 0) continue;
      grouped.push({ group, items: groupItems, startIndex: flat.length });
      flat.push(...groupItems);
    }

    return { sections: grouped, filtered: flat };
  }, [items, query]);

  useEffect(() => {
    if (open) {
      setQuery(initialQuery);
      setSelectedIndex(0);
    }
  }, [open, initialQuery]);

  useEscapeLayer(open && !inlinePreview, closePalette);
  useModalFocus(open && !inlinePreview, dialogRef, inputRef, returnFocusTo);

  useEffect(() => {
    if (selectedIndex >= filtered.length) {
      setSelectedIndex(0);
    }
  }, [filtered.length, selectedIndex]);

  if (!open) return null;

  const selectItem = (item: CommandPaletteItem) => {
    item.onSelect();
    if (!inlinePreview) {
      closePalette();
    }
  };

  const handleKeyDown = (event: KeyboardEvent) => {
    if (!inlinePreview) {
      trapFocusKeyDown(event, dialogRef.current);
    }
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
        selectItem(target);
      }
    }
  };

  return (
    <div
      className={cx(styles.backdrop, inlinePreview && styles.backdropInline)}
      role="dialog"
      aria-modal={inlinePreview ? undefined : 'true'}
      aria-label={t('topbar.searchLabel')}
      aria-busy={loading ? 'true' : undefined}
      onKeyDown={handleKeyDown}
    >
      <button
        type="button"
        className={styles.scrim}
        onClick={closePalette}
        aria-label={t('palette.close')}
        tabIndex={-1}
      />

      <div ref={dialogRef} className={styles.dialog}>
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
          {loading ? (
            <div className={styles.skeletonList} aria-hidden="true">
              <span className={cx(shimmer.shimmer, styles.skeletonRow)} />
              <span className={cx(shimmer.shimmer, styles.skeletonRow)} />
              <span className={cx(shimmer.shimmer, styles.skeletonRow)} />
            </div>
          ) : filtered.length === 0 ? (
            <div className={styles.empty}>{t('palette.empty')}</div>
          ) : (
            sections.map((section) => {
              const headingId = `${listId}-group-${section.group}`;
              return (
                <div
                  key={section.group}
                  className={styles.group}
                  role="group"
                  aria-labelledby={headingId}
                >
                  <div id={headingId} className={styles.groupLabel}>
                    {t(`palette.group.${section.group}`, undefined, lang)}
                  </div>
                  {section.items.map((item, localIdx) => {
                    const idx = section.startIndex + localIdx;
                    const isSelected = idx === selectedIndex;
                    return (
                      <button
                        key={`${item.group}:${item.id}`}
                        type="button"
                        role="option"
                        aria-selected={isSelected}
                        className={cx(styles.resultBtn, isSelected && styles.resultBtnSelected)}
                        onClick={() => selectItem(item)}
                        onMouseEnter={() => setSelectedIndex(idx)}
                        onFocus={() => setSelectedIndex(idx)}
                      >
                        <span className={styles.resultMain}>
                          {item.iconRoute && (
                            <RouteIcon route={item.iconRoute} size={18} className={styles.resultIcon} />
                          )}
                          <span className={styles.resultLabel}>{item.label}</span>
                        </span>
                        {item.hint && (
                          <PokerNotation className={styles.resultHint}>{item.hint}</PokerNotation>
                        )}
                      </button>
                    );
                  })}
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
