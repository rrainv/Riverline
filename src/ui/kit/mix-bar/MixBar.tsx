import type { JSX } from 'preact';
import { t } from '../../../i18n';
import { cx } from '../state';
import styles from './MixBar.module.css';

export type MixSegmentTone =
  | 'fold'
  | 'call'
  | 'raise1'
  | 'raise2'
  | 'raise3'
  | 'brass'
  | 'ok';

export interface MixSegment {
  id: string;
  /** Share from 0..100. */
  pct: number;
  label: string;
  tone: MixSegmentTone;
}

export interface MixLegendGroup {
  id: string;
  pct: number;
  label: string;
  highlighted?: boolean;
}

export interface MixBarProps {
  segments: MixSegment[];
  /** Horizontal position along the LTR scale (0..100) for the "you" pointer below the bar. */
  youPositionPct?: number;
  youLabel?: string;
  legendGroups?: MixLegendGroup[];
  /** Increment to replay the uniform left-to-right wipe. */
  wipeKey?: number;
  ariaLabel?: string;
}

/**
 * Mix bar (#10). Uniform left-to-right clip wipe, high-contrast segment text,
 * and a dedicated track below for the spring-gliding "you" pointer.
 */
export function MixBar({
  segments,
  youPositionPct,
  youLabel,
  legendGroups,
  wipeKey = 0,
  ariaLabel,
}: MixBarProps) {
  const clampedYou =
    youPositionPct !== undefined ? Math.min(94, Math.max(6, youPositionPct)) : undefined;

  return (
    <div
      dir="ltr"
      role="region"
      aria-label={ariaLabel ?? t('kit.mix.ariaLabel')}
      className={styles.mixBar}
    >
      <div key={wipeKey} className={styles.barFrame}>
        {segments.map((seg) => (
          <div
            key={seg.id}
            className={cx(styles.segment, styles[`tone_${seg.tone}`])}
            style={{ width: `${seg.pct}%` }}
            title={seg.label}
          >
            {seg.pct >= 8 ? seg.label : ''}
          </div>
        ))}
      </div>

      {clampedYou !== undefined && (
        <div className={styles.pointerLane}>
          <div
            className={styles.pointerMover}
            style={{ '--you-pos': clampedYou } as JSX.CSSProperties}
          >
            <div className={styles.pointerPin}>
              <span className={styles.pointerArrow} aria-hidden="true" />
              <span className={styles.pointerTag}>{youLabel ?? t('kit.mix.you')}</span>
            </div>
          </div>
        </div>
      )}

      {legendGroups && legendGroups.length > 0 && (
        <div className={styles.legendRow}>
          {legendGroups.map((g) => (
            <div
              key={g.id}
              className={cx(styles.legendGroup, g.highlighted && styles.legendRaise)}
              style={{ width: `${g.pct}%` }}
            >
              {g.label}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
