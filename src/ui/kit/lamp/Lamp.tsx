import { useEffect, useId, useRef, useState } from 'preact/hooks';
import { appearanceSignal, type TeacherTypingSpeed } from '../../../domain/appearance';
import { t } from '../../../i18n';
import { Button } from '../button/Button';
import { TierBadge, type TierBadgeProps } from '../chip/Chip';
import { cx, motionIsInstant, readDurationMs, type ForcedState } from '../state';
import styles from './Lamp.module.css';

export const LAMP_SIZES = [28, 44, 72, 128] as const;
export type LampSize = (typeof LAMP_SIZES)[number];

export const LAMP_MOODS = [
  'idle',
  'thinking',
  'curious',
  'speaking',
  'approving',
  'celebrating',
  'stern',
  'resting',
] as const;
export type LampMood = (typeof LAMP_MOODS)[number];

const SIZE_CLASS: Record<LampSize, string> = {
  28: styles.size28 ?? '',
  44: styles.size44 ?? '',
  72: styles.size72 ?? '',
  128: styles.size128 ?? '',
};

const MOOD_CLASS: Record<LampMood, string> = {
  idle: styles.idle ?? '',
  thinking: styles.thinking ?? '',
  curious: styles.curious ?? '',
  speaking: styles.speaking ?? '',
  approving: styles.approving ?? '',
  celebrating: styles.celebrating ?? '',
  stern: styles.stern ?? '',
  resting: styles.resting ?? '',
};

const CHARS_PER_SECOND: Record<TeacherTypingSpeed, number> = {
  slow: 22,
  normal: 48,
  fast: 110,
  instant: 0,
};

export interface LampProps {
  size?: LampSize;
  mood?: LampMood;
  label?: string;
  decorative?: boolean;
  onWake?: () => void;
  onCelebrateEnd?: () => void;
  persistCelebrating?: boolean;
  forceState?: ForcedState;
  className?: string;
}

export function Lamp({
  size = 44,
  mood = 'idle',
  label,
  decorative = false,
  onWake,
  onCelebrateEnd,
  persistCelebrating = false,
  forceState,
  className,
}: LampProps) {
  const uid = useId().replace(/[^a-zA-Z0-9_-]/g, '');
  const beamGradId = `${uid}-beam`;
  const sternGradId = `${uid}-stern`;
  const glowGradId = `${uid}-glow`;

  const [celebratingSettled, setCelebratingSettled] = useState(false);

  useEffect(() => {
    setCelebratingSettled(false);
    if (mood !== 'celebrating' || persistCelebrating) {
      return;
    }
    const burstMs = motionIsInstant() ? 0 : Math.max(900, readDurationMs('--dur-4') * 5);
    const id = setTimeout(() => {
      setCelebratingSettled(true);
      onCelebrateEnd?.();
    }, burstMs);
    return () => clearTimeout(id);
  }, [mood, persistCelebrating, onCelebrateEnd]);

  const effectiveMood: LampMood = mood === 'celebrating' && celebratingSettled ? 'idle' : mood;
  const moodName = t(`kit.lamp.mood.${effectiveMood}`);
  const accessibleLabel =
    label ??
    (effectiveMood === 'resting' && onWake
      ? t('kit.lamp.wakeLabel', { mood: moodName })
      : t('kit.lamp.defaultAria', { mood: moodName }));

  const svg = (
    <svg
      viewBox="0 0 120 120"
      className={styles.svg}
      aria-hidden="true"
      focusable="false"
    >
      <defs>
        <linearGradient id={beamGradId} x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="var(--lamp-glow)" stopOpacity="0.24" />
          <stop offset="100%" stopColor="var(--lamp-glow)" stopOpacity="0" />
        </linearGradient>
        <linearGradient id={sternGradId} x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="var(--lamp-stern)" stopOpacity="0.26" />
          <stop offset="100%" stopColor="var(--lamp-stern)" stopOpacity="0" />
        </linearGradient>
        <radialGradient id={glowGradId}>
          <stop offset="0%" stopColor="var(--lamp-glow)" stopOpacity="0.34" />
          <stop offset="100%" stopColor="var(--lamp-glow)" stopOpacity="0" />
        </radialGradient>
      </defs>

      <polygon
        className={styles.beam}
        points="20,118 60,72 100,118"
        style={{ fill: `url(#${effectiveMood === 'stern' || effectiveMood === 'thinking' ? sternGradId : beamGradId})` }}
      />

      <circle
        className={styles.glow}
        cx="60"
        cy="52"
        r="46"
        style={{ fill: `url(#${glowGradId})` }}
      />

      <circle className={styles.orbit} cx="60" cy="52" r="32" />
      <circle className={cx(styles.wave, styles.waveOne)} cx="60" cy="52" r="28" />
      <circle className={cx(styles.wave, styles.waveTwo)} cx="60" cy="52" r="34" />

      <g className={styles.bulbGroup}>
        <circle className={styles.bulbCircle} cx="60" cy="52" r="24" />
        <g transform="translate(60, 52)">
          <g className={styles.eyes}>
            <circle cx="-6.5" cy="-1" r="2.7" />
            <circle cx="6.5" cy="-1" r="2.7" />
          </g>
          <path className={styles.eyeLid} d="M -9.5 -1 Q -6.5 2 -3.5 -1" />
          <path className={styles.eyeLid} d="M 3.5 -1 Q 6.5 2 9.5 -1" />
          <path className={cx(styles.brow, styles.browLeft)} d="M -10 -7.5 L -3 -7.5" />
          <path className={cx(styles.brow, styles.browRight)} d="M 3 -7.5 L 10 -7.5" />
        </g>
      </g>

      <path
        className={styles.spark}
        d="M96 19 L98 24 L103 26 L98 28 L96 33 L94 28 L89 26 L94 24 Z"
      />
    </svg>
  );

  if (effectiveMood === 'resting' && onWake) {
    return (
      <button
        type="button"
        className={cx(styles.lampWrap, SIZE_CLASS[size], MOOD_CLASS[effectiveMood], styles.wakeButton, className)}
        aria-label={accessibleLabel}
        data-mood={effectiveMood}
        data-size={size}
        data-force-state={forceState}
        onClick={onWake}
      >
        {svg}
      </button>
    );
  }

  return (
    <span
      className={cx(styles.lampWrap, SIZE_CLASS[size], MOOD_CLASS[effectiveMood], className)}
      role={decorative ? undefined : 'img'}
      aria-label={decorative ? undefined : accessibleLabel}
      aria-hidden={decorative ? true : undefined}
      data-mood={effectiveMood}
      data-size={size}
    >
      {svg}
    </span>
  );
}

export interface TeacherCalloutAction {
  label: string;
  onClick: () => void;
  variant?: 'primary' | 'secondary' | 'danger';
  disabled?: boolean;
}

export interface TeacherCalloutProps {
  text: string;
  heading?: string;
  mood?: LampMood;
  settledMood?: LampMood;
  lampSize?: LampSize;
  showLamp?: boolean;
  typingSpeed?: TeacherTypingSpeed;
  tier?: TierBadgeProps;
  action?: TeacherCalloutAction;
  surface?: 'panel' | 'well';
  onWakeLamp?: () => void;
  onTypingComplete?: () => void;
  className?: string;
}

const FIXED_MOODS_HOLD: ReadonlySet<LampMood> = new Set([
  'stern',
  'curious',
  'approving',
  'resting',
  'thinking',
]);

export function TeacherCallout({
  text,
  heading,
  mood,
  settledMood = 'idle',
  lampSize = 44,
  showLamp,
  typingSpeed,
  tier,
  action,
  surface = 'panel',
  onWakeLamp,
  onTypingComplete,
  className,
}: TeacherCalloutProps) {
  const prefs = appearanceSignal.value;
  const effectiveShowLamp = showLamp ?? prefs.showLamp;
  const effectiveSpeed = typingSpeed ?? prefs.teacherTypingSpeed;
  const osReduced =
    typeof window !== 'undefined' &&
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const reducedMotion = prefs.motion === 'reduced' || osReduced;
  const instant = effectiveSpeed === 'instant' || reducedMotion;

  const [visibleChars, setVisibleChars] = useState<number>(() => (instant ? text.length : 0));
  const completedRef = useRef(instant || text.length === 0);

  useEffect(() => {
    const shouldCompleteImmediately = instant || text.length === 0 || (motionIsInstant() && prefs.motion === 'reduced');
    if (shouldCompleteImmediately) {
      setVisibleChars(text.length);
      if (!completedRef.current) {
        completedRef.current = true;
        onTypingComplete?.();
      }
      return;
    }

    setVisibleChars(0);
    completedRef.current = false;
    const cps = CHARS_PER_SECOND[effectiveSpeed];
    const stepMs = Math.max(8, Math.round(1000 / cps));

    const timer = setInterval(() => {
      setVisibleChars((prev) => {
        const next = Math.min(text.length, prev + 1);
        if (next >= text.length) {
          clearInterval(timer);
          if (!completedRef.current) {
            completedRef.current = true;
            onTypingComplete?.();
          }
        }
        return next;
      });
    }, stepMs);

    return () => clearInterval(timer);
  }, [text, effectiveSpeed, instant, onTypingComplete]);

  const isTyping = visibleChars < text.length;

  const completeNow = () => {
    if (!isTyping) return;
    setVisibleChars(text.length);
    if (!completedRef.current) {
      completedRef.current = true;
      onTypingComplete?.();
    }
  };

  const resolvedMood: LampMood =
    mood && FIXED_MOODS_HOLD.has(mood)
      ? mood
      : isTyping
        ? (mood ?? 'speaking')
        : mood === 'celebrating'
          ? 'celebrating'
          : settledMood;

  const displayedText = text.slice(0, visibleChars);

  return (
    <section
      className={cx(
        styles.callout,
        surface === 'panel' ? styles.calloutPanel : styles.calloutWell,
        !effectiveShowLamp && styles.calloutNoLamp,
        className,
      )}
      aria-label={heading ?? t('kit.lamp.calloutLabel')}
    >
      {effectiveShowLamp && (
        <div className={styles.lampSlot}>
          <Lamp
            size={lampSize}
            mood={resolvedMood}
            decorative={!onWakeLamp || resolvedMood !== 'resting'}
            onWake={onWakeLamp}
          />
        </div>
      )}

      <div className={styles.body}>
        {(heading || tier) && (
          <div className={styles.headerRow}>
            {heading ? <span className={styles.heading}>{heading}</span> : <span />}
            {tier && <TierBadge {...tier} />}
          </div>
        )}

        <p
          className={cx(styles.textBlock, isTyping && styles.textBlockTyping)}
          role={isTyping ? 'button' : undefined}
          tabIndex={isTyping ? 0 : undefined}
          aria-label={isTyping ? t('kit.lamp.finishType') : undefined}
          onClick={isTyping ? completeNow : undefined}
          onKeyDown={
            isTyping
              ? (e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    completeNow();
                  }
                }
              : undefined
          }
        >
          {displayedText}
        </p>

        {action && (
          <div className={styles.footerRow}>
            <span />
            <div className={styles.actions}>
              <Button
                variant={action.variant ?? 'primary'}
                disabled={action.disabled}
                onClick={action.onClick}
              >
                {action.label}
              </Button>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
