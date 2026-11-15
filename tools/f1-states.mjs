export const THEMES = [
  'midnight',
  'felt',
  'slate',
  'dusk',
  'contrast',
  'daylight',
  'paper',
];

export const LIGHT_THEMES = new Set(['daylight', 'paper']);

export const LOCALES = ['en', 'ru', 'he'];

export const VIEWPORTS = [
  { width: 1920, height: 1080 },
  { width: 1366, height: 768 },
];

export const F1_STATES = [
  { label: 'home', patch: { room: 'home', railCollapsed: false, focusMode: false, paletteOpen: false } },
  { label: 'training', patch: { room: 'training', railCollapsed: false, focusMode: false, paletteOpen: false } },
  { label: 'strategy', patch: { room: 'strategy', railCollapsed: false, focusMode: false, paletteOpen: false } },
  { label: 'hand', patch: { room: 'hand', recorderPreset: 'raise', railCollapsed: false, focusMode: false, paletteOpen: false } },
  { label: 'hand_flop_grid', patch: { room: 'hand', recorderPreset: 'flop_grid', railCollapsed: false, focusMode: false, paletteOpen: false } },
  { label: 'hand_typed_error', patch: { room: 'hand', recorderPreset: 'typed_error', railCollapsed: false, focusMode: false, paletteOpen: false } },
  { label: 'hand_done', patch: { room: 'hand', recorderPreset: 'done', railCollapsed: false, focusMode: false, paletteOpen: false } },
  { label: 'equity', patch: { room: 'equity', equityPreset: 'flop', railCollapsed: false, focusMode: false, paletteOpen: false } },
  { label: 'equity_turn_chosen', patch: { room: 'equity', equityPreset: 'turn_chosen', railCollapsed: false, focusMode: false, paletteOpen: false } },
  { label: 'equity_players_3', patch: { room: 'equity', equityPreset: 'players_3', railCollapsed: false, focusMode: false, paletteOpen: false } },
  { label: 'equity_players_4', patch: { room: 'equity', equityPreset: 'players_4', railCollapsed: false, focusMode: false, paletteOpen: false } },
  { label: 'equity_players_10', patch: { room: 'equity', equityPreset: 'players_10', railCollapsed: false, focusMode: false, paletteOpen: false } },
  { label: 'equity_range_row', patch: { room: 'equity', equityPreset: 'range_row', railCollapsed: false, focusMode: false, paletteOpen: false } },
  { label: 'equity_error', patch: { room: 'equity', equityPreset: 'error', railCollapsed: false, focusMode: false, paletteOpen: false } },
  { label: 'review', patch: { room: 'review', reviewPreset: 'hand', railCollapsed: false, focusMode: false, paletteOpen: false } },
  { label: 'review_counterfactual', patch: { room: 'review', reviewPreset: 'counterfactual', railCollapsed: false, focusMode: false, paletteOpen: false } },
  { label: 'saved_library', patch: { room: 'review', reviewPreset: 'saved', railCollapsed: false, focusMode: false, paletteOpen: false } },
  { label: 'nights', patch: { room: 'nights', railCollapsed: false, focusMode: false, paletteOpen: false } },
  { label: 'learn', patch: { room: 'learn', railCollapsed: false, focusMode: false, paletteOpen: false } },
  { label: 'settings_appearance', patch: { room: 'settings', railCollapsed: false, focusMode: false, paletteOpen: false } },
  { label: 'kit_panel', patch: { room: 'kit', kitSection: 'panel', railCollapsed: false, focusMode: false, paletteOpen: false } },
  { label: 'kit_button', patch: { room: 'kit', kitSection: 'button', railCollapsed: false, focusMode: false, paletteOpen: false } },
  { label: 'kit_chip', patch: { room: 'kit', kitSection: 'chip', railCollapsed: false, focusMode: false, paletteOpen: false } },
  { label: 'kit_choice', patch: { room: 'kit', kitSection: 'choice', railCollapsed: false, focusMode: false, paletteOpen: false } },
  { label: 'kit_input', patch: { room: 'kit', kitSection: 'input', railCollapsed: false, focusMode: false, paletteOpen: false } },
  { label: 'kit_factTile', patch: { room: 'kit', kitSection: 'factTile', railCollapsed: false, focusMode: false, paletteOpen: false } },
  { label: 'kit_overlay', patch: { room: 'kit', kitSection: 'overlay', railCollapsed: false, focusMode: false, paletteOpen: false } },
  { label: 'kit_stepper', patch: { room: 'kit', kitSection: 'stepper', railCollapsed: false, focusMode: false, paletteOpen: false } },
  { label: 'kit_playingCard', patch: { room: 'kit', kitSection: 'playingCard', railCollapsed: false, focusMode: false, paletteOpen: false } },
  { label: 'kit_feltTable', patch: { room: 'kit', kitSection: 'feltTable', railCollapsed: false, focusMode: false, paletteOpen: false } },
  { label: 'kit_optionTickets', patch: { room: 'kit', kitSection: 'optionTickets', railCollapsed: false, focusMode: false, paletteOpen: false } },
  { label: 'kit_mixBar', patch: { room: 'kit', kitSection: 'mixBar', railCollapsed: false, focusMode: false, paletteOpen: false } },
  { label: 'kit_equityRow', patch: { room: 'kit', kitSection: 'equityRow', railCollapsed: false, focusMode: false, paletteOpen: false } },
  { label: 'kit_historyRail', patch: { room: 'kit', kitSection: 'historyRail', railCollapsed: false, focusMode: false, paletteOpen: false } },
  { label: 'kit_lamp', patch: { room: 'kit', kitSection: 'lamp', railCollapsed: false, focusMode: false, paletteOpen: false } },
  { label: 'kit_heatGrid', patch: { room: 'kit', kitSection: 'heatGrid', railCollapsed: false, focusMode: false, paletteOpen: false } },
  { label: 'kit_familyStrip', patch: { room: 'kit', kitSection: 'familyStrip', railCollapsed: false, focusMode: false, paletteOpen: false } },
  { label: 'collapsed_rail', patch: { room: 'review', railCollapsed: true, focusMode: false, paletteOpen: false } },
  { label: 'focus_mode', patch: { room: 'home', railCollapsed: false, focusMode: true, paletteOpen: false } },
  { label: 'search_palette', patch: { room: 'home', railCollapsed: false, focusMode: false, paletteOpen: true } },
];

export async function waitForSettled(page) {
  await page.evaluate(async () => {
    if (document.fonts && document.fonts.ready) {
      await document.fonts.ready;
    }
    const raf = () => new Promise((r) => requestAnimationFrame(() => r()));
    await raf();
    await raf();
    const startWait = performance.now();
    while (document.querySelector('section[aria-busy="true"]') && performance.now() - startWait < 30000) {
      await new Promise((r) => setTimeout(r, 25));
    }
    await raf();
    await raf();
    const finite = document
      .getAnimations()
      .filter((a) => a.effect && a.effect.getComputedTiming().iterations !== Infinity);
    await Promise.race([
      Promise.allSettled(finite.map((a) => a.finished)),
      new Promise((r) => setTimeout(r, 600)),
    ]);
    await raf();
  });
}
