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
  { label: 'hand', patch: { room: 'hand', railCollapsed: false, focusMode: false, paletteOpen: false } },
  { label: 'equity', patch: { room: 'equity', railCollapsed: false, focusMode: false, paletteOpen: false } },
  { label: 'review', patch: { room: 'review', railCollapsed: false, focusMode: false, paletteOpen: false } },
  { label: 'nights', patch: { room: 'nights', railCollapsed: false, focusMode: false, paletteOpen: false } },
  { label: 'learn', patch: { room: 'learn', railCollapsed: false, focusMode: false, paletteOpen: false } },
  { label: 'settings_appearance', patch: { room: 'settings', railCollapsed: false, focusMode: false, paletteOpen: false } },
  { label: 'kit_placeholder', patch: { room: 'kit', railCollapsed: false, focusMode: false, paletteOpen: false } },
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
