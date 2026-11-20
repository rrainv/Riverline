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

interface MoodFaceSpec {
  readonly beamPath: string;
  readonly beamTone: 'normal' | 'bright' | 'dim' | 'stern';
  readonly coolGlow?: boolean;
  readonly browPath: string;
  readonly eyeKind: 'rect' | 'arc';
  readonly eyeMotion?: 'blink' | 'look';
  readonly leftEye?: { readonly x: number; readonly y: number; readonly height: number };
  readonly rightEye?: { readonly x: number; readonly y: number; readonly height: number };
}

const MOOD_FACE: Record<LampMood, MoodFaceSpec> = {
  idle: {
    beamPath: 'M28 118L60 72L92 118Z',
    beamTone: 'normal',
    browPath: 'M-13 -10h9M4 -10h9',
    eyeKind: 'rect',
    eyeMotion: 'blink',
    leftEye: { x: -13, y: -2, height: 3 },
    rightEye: { x: 4, y: -2, height: 3 },
  },
  thinking: {
    beamPath: 'M38 118L60 72L82 118Z',
    beamTone: 'stern',
    coolGlow: true,
    browPath: 'M-13 -13l9 2M4 -10h9',
    eyeKind: 'rect',
    eyeMotion: 'look',
    leftEye: { x: -13, y: -3.5, height: 3 },
    rightEye: { x: 4, y: -3.5, height: 3 },
  },
  curious: {
    beamPath: 'M30 118L60 72L90 118Z',
    beamTone: 'normal',
    browPath: 'M-13 -9h9M4 -14l9 2',
    eyeKind: 'rect',
    eyeMotion: 'blink',
    leftEye: { x: -10, y: -2, height: 3 },
    rightEye: { x: 7, y: -2, height: 3 },
  },
  speaking: {
    beamPath: 'M30 118L60 72L90 118Z',
    beamTone: 'normal',
    browPath: 'M-13 -10h9M4 -10h9',
    eyeKind: 'rect',
    eyeMotion: 'blink',
    leftEye: { x: -13, y: -2, height: 3 },
    rightEye: { x: 4, y: -2, height: 3 },
  },
  approving: {
    beamPath: 'M10 118L60 72L110 118Z',
    beamTone: 'bright',
    browPath: 'M-13 -9q4.5 -5 9 0M4 -9q4.5 -5 9 0',
    eyeKind: 'arc',
  },
  celebrating: {
    beamPath: 'M12 118L60 72L108 118Z',
    beamTone: 'bright',
    browPath: 'M-13 -10q4.5 -6 9 0M4 -10q4.5 -6 9 0',
    eyeKind: 'arc',
  },
  stern: {
    beamPath: 'M48 118L60 72L72 118Z',
    beamTone: 'stern',
    coolGlow: true,
    browPath: 'M-13 -13l9 4.5M13 -13l-9 4.5',
    eyeKind: 'rect',
    leftEye: { x: -13, y: -1, height: 2.4 },
    rightEye: { x: 4, y: -1, height: 2.4 },
  },
  resting: {
    beamPath: 'M40 118L60 72L80 118Z',
    beamTone: 'dim',
    browPath: 'M-13 -7h9M4 -7h9',
    eyeKind: 'rect',
    leftEye: { x: -13, y: 0, height: 1.4 },
    rightEye: { x: 4, y: 0, height: 1.4 },
  },
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
  const brightBeamGradId = `${uid}-beam-bright`;
  const dimBeamGradId = `${uid}-beam-dim`;
  const sternBeamGradId = `${uid}-beam-stern`;
  const glowGradId = `${uid}-glow`;
  const sternGlowGradId = `${uid}-glow-stern`;

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
  const face = MOOD_FACE[effectiveMood];
  const moodName = t(`kit.lamp.mood.${effectiveMood}`);
  const accessibleLabel =
    label ??
    (effectiveMood === 'resting' && onWake
      ? t('kit.lamp.wakeLabel', { mood: moodName })
      : t('kit.lamp.defaultAria', { mood: moodName }));

  const beamFillId =
    face.beamTone === 'bright'
      ? brightBeamGradId
      : face.beamTone === 'dim'
        ? dimBeamGradId
        : face.beamTone === 'stern'
          ? sternBeamGradId
          : beamGradId;

  const glowFillId = face.coolGlow ? sternGlowGradId : glowGradId;
  const eyeMotionClass =
    face.eyeMotion === 'blink'
      ? styles.eyesBlink
      : face.eyeMotion === 'look'
        ? styles.eyesLook
        : undefined;

  const svg = (
    <svg
      viewBox="0 0 120 120"
      className={styles.svg}
      aria-hidden="true"
      focusable="false"
    >
      <defs>
        <linearGradient id={beamGradId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stop-color="var(--lamp-glow)" stop-opacity="0.30" />
          <stop offset="1" stop-color="var(--lamp-glow)" stop-opacity="0" />
        </linearGradient>
        <linearGradient id={brightBeamGradId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stop-color="var(--lamp-glow)" stop-opacity="0.41" />
          <stop offset="1" stop-color="var(--lamp-glow)" stop-opacity="0" />
        </linearGradient>
        <linearGradient id={dimBeamGradId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stop-color="var(--lamp-glow)" stop-opacity="0.14" />
          <stop offset="1" stop-color="var(--lamp-glow)" stop-opacity="0" />
        </linearGradient>
        <linearGradient id={sternBeamGradId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stop-color="var(--lamp-stern)" stop-opacity="0.30" />
          <stop offset="1" stop-color="var(--lamp-stern)" stop-opacity="0" />
        </linearGradient>
        <radialGradient id={glowGradId}>
          <stop offset="0" stop-color="var(--lamp-glow)" stop-opacity="0.90" />
          <stop offset="1" stop-color="var(--lamp-glow)" stop-opacity="0" />
        </radialGradient>
        <radialGradient id={sternGlowGradId}>
          <stop offset="0" stop-color="var(--lamp-stern)" stop-opacity="0.90" />
          <stop offset="1" stop-color="var(--lamp-stern)" stop-opacity="0" />
        </radialGradient>
      </defs>

      <path className={styles.beam} d={face.beamPath} fill={`url(#${beamFillId})`} />

      <circle
        className={styles.glow}
        cx="60"
        cy="52"
        r="46"
        fill={`url(#${glowFillId})`}
      />

      {effectiveMood === 'thinking' && (
        <g className={styles.orbitGroup}>
          <circle className={styles.orbit} cx="60" cy="52" r="32" />
          <circle className={styles.orbitDot} cx="92" cy="52" r="3.2" />
        </g>
      )}

      {effectiveMood === 'speaking' && (
        <g className={styles.waveGroup}>
          <circle className={cx(styles.wave, styles.waveOne)} cx="60" cy="52" r="30" />
          <circle className={cx(styles.wave, styles.waveTwo)} cx="60" cy="52" r="30" />
          <circle className={cx(styles.wave, styles.waveThree)} cx="60" cy="52" r="30" />
        </g>
      )}

      {effectiveMood === 'approving' && (
        <g className={styles.sparkGroup}>
          <path className={cx(styles.spark, styles.sparkOne)} d="M26 28l-7-7" />
          <path className={cx(styles.spark, styles.sparkTwo)} d="M94 28l7-7" />
          <path className={cx(styles.spark, styles.sparkThree)} d="M60 14V6" />
        </g>
      )}

      {effectiveMood === 'celebrating' && (
        <g className={styles.confGroup}>
          <circle className={cx(styles.conf, styles.conf1)} cx="60" cy="52" r="3" />
          <circle className={cx(styles.conf, styles.conf2)} cx="60" cy="52" r="3" />
          <circle className={cx(styles.conf, styles.conf3)} cx="60" cy="52" r="3" />
          <circle className={cx(styles.conf, styles.conf4)} cx="60" cy="52" r="3" />
          <circle className={cx(styles.conf, styles.conf5)} cx="60" cy="52" r="3" />
          <circle className={cx(styles.conf, styles.conf6)} cx="60" cy="52" r="3" />
          <circle className={cx(styles.conf, styles.conf7)} cx="60" cy="52" r="3" />
          <circle className={cx(styles.conf, styles.conf8)} cx="60" cy="52" r="3" />
        </g>
      )}

      <g className={styles.bulbGroup}>
        <circle className={styles.bulbCircle} cx="60" cy="52" r="24" />
        <g transform="translate(60, 52)">
          <path className={styles.brow} d={face.browPath} />
          <g className={cx(styles.eyes, eyeMotionClass)}>
            {face.eyeKind === 'arc' ? (
              <path className={styles.eyeArc} d="M-13 1q4.5 -6 9 0M4 1q4.5 -6 9 0" />
            ) : (
              <>
                <rect
                  x={face.leftEye?.x ?? -13}
                  y={face.leftEye?.y ?? -2}
                  width="9"
                  height={face.leftEye?.height ?? 3}
                  rx="1.4"
                />
                <rect
                  x={face.rightEye?.x ?? 4}
                  y={face.rightEye?.y ?? -2}
                  width="9"
                  height={face.rightEye?.height ?? 3}
                  rx="1.4"
                />
              </>
            )}
          </g>
        </g>
      </g>

      {effectiveMood === 'resting' && (
        <g className={styles.sleepGroup}>
          <text className={cx(styles.sleepZ, styles.sleepZ1)} x="84" y="36" font-size="10">
            z
          </text>
          <text className={cx(styles.sleepZ, styles.sleepZ2)} x="91" y="29" font-size="13">
            z
          </text>
          <text className={cx(styles.sleepZ, styles.sleepZ3)} x="98" y="22" font-size="16">
            z
          </text>
        </g>
      )}
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

interface TypedCalloutTextProps {
  text: string;
  effectiveSpeed: TeacherTypingSpeed;
  shouldCompleteImmediately: boolean;
  onTypingStateChange: (typing: boolean) => void;
  onTypingComplete?: () => void;
}

/** Isolated typewriter paragraph so per-character intervals never re-render the Lamp SVG. */
function TypedCalloutText({
  text,
  effectiveSpeed,
  shouldCompleteImmediately,
  onTypingStateChange,
  onTypingComplete,
}: TypedCalloutTextProps) {
  const [visibleChars, setVisibleChars] = useState<number>(() =>
    shouldCompleteImmediately ? text.length : 0,
  );
  const completedRef = useRef(shouldCompleteImmediately || text.length === 0);
  const onCompleteRef = useRef(onTypingComplete);
  onCompleteRef.current = onTypingComplete;

  useEffect(() => {
    if (shouldCompleteImmediately) {
      setVisibleChars(text.length);
      onTypingStateChange(false);
      if (!completedRef.current) {
        completedRef.current = true;
        onCompleteRef.current?.();
      }
      return;
    }

    setVisibleChars(0);
    completedRef.current = false;
    onTypingStateChange(text.length > 0);
    const cps = CHARS_PER_SECOND[effectiveSpeed];
    const stepMs = Math.max(8, Math.round(1000 / cps));

    const timer = setInterval(() => {
      setVisibleChars((prev) => {
        const next = Math.min(text.length, prev + 1);
        if (next >= text.length) {
          clearInterval(timer);
          onTypingStateChange(false);
          if (!completedRef.current) {
            completedRef.current = true;
            onCompleteRef.current?.();
          }
        }
        return next;
      });
    }, stepMs);

    return () => clearInterval(timer);
  }, [text, effectiveSpeed, shouldCompleteImmediately, onTypingStateChange]);

  const isTyping = visibleChars < text.length;
  const completeNow = () => {
    if (!isTyping) return;
    setVisibleChars(text.length);
    onTypingStateChange(false);
    if (!completedRef.current) {
      completedRef.current = true;
      onCompleteRef.current?.();
    }
  };

  return (
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
      {text.slice(0, visibleChars)}
    </p>
  );
}

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
  const shouldCompleteImmediately =
    instant || text.length === 0 || (motionIsInstant() && prefs.motion === 'reduced');

  const [isTyping, setIsTyping] = useState<boolean>(
    () => !shouldCompleteImmediately && text.length > 0,
  );

  const resolvedMood: LampMood =
    mood && FIXED_MOODS_HOLD.has(mood)
      ? mood
      : isTyping
        ? (mood ?? 'speaking')
        : mood === 'celebrating'
          ? 'celebrating'
          : settledMood;

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

        <TypedCalloutText
          text={text}
          effectiveSpeed={effectiveSpeed}
          shouldCompleteImmediately={shouldCompleteImmediately}
          onTypingStateChange={setIsTyping}
          onTypingComplete={onTypingComplete}
        />

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
