import { appearanceSignal } from '../appearance';

export type TableSoundCue = 'chip' | 'card' | 'confirm';

const CUE_CONFIG: Readonly<Record<TableSoundCue, { freq: number; duration: number; type: OscillatorType }>> = {
  chip: { freq: 520, duration: 0.045, type: 'triangle' },
  card: { freq: 340, duration: 0.04, type: 'sine' },
  confirm: { freq: 640, duration: 0.06, type: 'sine' },
};

export function playTableSound(cue: TableSoundCue, force = false): boolean {
  if (!force && !appearanceSignal.value.soundEffects) return false;
  if (typeof window === 'undefined') return false;
  const AudioCtx =
    window.AudioContext ??
    (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (typeof AudioCtx !== 'function') return false;

  try {
    const ctx = new AudioCtx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    const spec = CUE_CONFIG[cue];
    osc.type = spec.type;
    osc.frequency.setValueAtTime(spec.freq, ctx.currentTime);
    gain.gain.setValueAtTime(0.04, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + spec.duration);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + spec.duration);
    return true;
  } catch {
    return false;
  }
}
