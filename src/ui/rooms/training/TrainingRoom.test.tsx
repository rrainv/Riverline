import { render } from 'preact';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { initAppearance } from '../../../domain/appearance';
import { createMemoryStudyBackend, createStudyRepository } from '../../../domain/storage';
import { createTrainingStore } from '../../../domain/training';
import { TrainingRoom } from './TrainingRoom';

describe('TrainingRoom UI integration', () => {
  let host: HTMLDivElement;

  beforeEach(() => {
    initAppearance();
    host = document.createElement('div');
    document.body.appendChild(host);
  });

  afterEach(() => {
    render(null, host);
    host.remove();
  });

  it('renders 3-seat Hub (no Full hand dead button), runs Quick drill reveal flow, and renders Duel presets honestly', async () => {
    const repo = createStudyRepository(createMemoryStudyBackend());
    const store = createTrainingStore({ repository: repo, instantTimers: true });
    await store.hydrate();

    const onOpenReview = vi.fn();
    render(<TrainingRoom store={store} onOpenReview={onOpenReview} />, host);

    // Hub: 3 menu seats + no Full hand button
    const text = host.textContent ?? '';
    expect(text).toContain('Quick drill');
    expect(text).toContain('Heads-up duel');
    expect(text).toContain('Leak lab');
    expect(text).not.toContain('Full hand');
    expect(text).toContain('This week');

    // Switch to drill question preset
    await store.applyPreset('drill_question');
    render(<TrainingRoom store={store} onOpenReview={onOpenReview} />, host);
    expect(host.textContent).toContain('Your Personal Strategy plan is hidden until you answer');
    expect(host.textContent).toContain('Required equity');

    // Opening Inline Equity before answering locks equity while keeping exact call price visible
    const drillEqBtn = Array.from(host.querySelectorAll('button')).find((b) =>
      b.textContent?.includes('Equity'),
    )!;
    drillEqBtn.click();
    await new Promise((r) => setTimeout(r, 20));
    render(<TrainingRoom store={store} onOpenReview={onOpenReview} />, host);
    const lockedOv = host.querySelector('[data-equity-overlay="true"]')!;
    expect(lockedOv.textContent).toContain('Confirm your answer first to unlock equity');
    expect(lockedOv.querySelector('[data-equity-row]')).toBeNull();

    // Confirm answer -> reveals MixBar + TeacherCallout without fake authority and unlocks Inline Equity
    store.selectDrillTicket('raise');
    store.selectDrillSize('s0');
    await store.confirmDrillAnswer();
    render(<TrainingRoom store={store} onOpenReview={onOpenReview} />, host);

    expect(host.textContent).toContain('you');
    expect(host.textContent?.toLowerCase()).not.toContain('heuristic');
    expect(host.textContent?.toLowerCase()).not.toContain('mistake');

    await new Promise((r) => setTimeout(r, 40));
    const unlockedOv = host.querySelector('[data-equity-overlay="true"]')!;
    expect(unlockedOv.textContent).not.toContain('Confirm your answer first to unlock equity');
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));

    // Heads-up duel flop ladder preset
    await store.applyPreset('duel_flop_ladder');
    render(<TrainingRoom store={store} onOpenReview={onOpenReview} />, host);
    expect(host.textContent).toContain('Astra');
    expect(host.textContent).toContain('50%');
    expect(host.textContent).toContain('All-in');
    expect(host.textContent).toContain('Selected size:');
    expect(host.textContent).toContain('Observed Astra stats');

    // End-of-duel result preset -> save hands + open Review callback
    await store.applyPreset('duel_result');
    render(<TrainingRoom store={store} onOpenReview={onOpenReview} />, host);
    expect(host.textContent).toContain('10-hand match complete');

    const saveBtn = Array.from(host.querySelectorAll('button')).find((b) =>
      b.textContent?.includes('Save hands to Review'),
    )!;
    saveBtn.click();
    await new Promise((r) => setTimeout(r, 20));
    expect((await repo.listSavedHands()).length).toBe(10);

    const openBtn = Array.from(host.querySelectorAll('button')).find((b) =>
      b.textContent?.includes('Open in Review'),
    )!;
    openBtn.click();
    expect(onOpenReview).toHaveBeenCalledTimes(1);

    store.dispose();
  });
});
