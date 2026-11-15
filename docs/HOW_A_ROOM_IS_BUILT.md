# How a Room Is Built in Riverline

This guide uses the first live study room (`src/ui/rooms/equity/`) as the worked pattern for every room that follows (`hand`, `review`, `strategy`, `training`, `nights`, `learn`).

---

## 1. Where everything lives

Dependencies strictly point one way (`rooms -> domain -> engine-api -> engine` and `rooms -> kit -> tokens`):

| Layer | Directory | Responsibility |
|---|---|---|
| **Engine** | `engine/*.ts` | Pure TypeScript poker rules, evaluator, equity, weighted ranges, runout explorer. `lib: ["ES2022"]`, zero `DOM`, `window`, storage, or network access. |
| **Worker API** | `src/engine-api/` | Typed async Web Worker client + inline mode for tests (`client.ts`, `types.ts`, `engine.worker.ts`), request-ID & `AbortSignal` cancellation (`createChannel`), and exported non-math constants (`CARD_RANKS`, `CARD_SUITS`, `CATEGORY_BY_RANK`). |
| **Domain store & storage** | `src/domain/<room>/`, `src/domain/shorthand/`, `src/domain/storage/` | `@preact/signals` state container (`createEquityStore`), single shared shorthand parser (`parsePlayerHandInput`), and IndexedDB append-only event log (`riverline-study-v1` + schema-validated JSON Export/Import). |
| **Shared Kit** | `src/ui/kit/` | All visual primitives, CSS Modules (`*.module.css`), and shared controls (`Panel`, `EquityRow`, `HeatGrid`, `CardPicker`, `TextField`, `Button`, `TierBadge`, `SegmentedControl`, `Dialog`). Zero poker calculations inside kit components beyond display. |
| **Room UI** | `src/ui/rooms/<room>/` | Thin view components (`EquityRoom.tsx`, `RunoutExplorerPanel.tsx`, `SavedMatchupsView.tsx`, `equityFormatters.tsx`, `EquityRoom.module.css`) built exclusively from `src/ui/kit/`, `src/domain/`, and `src/i18n/`. |
| **Messages & LTR** | `src/i18n/` | Typed message keys (`types.ts`), catalogues (`locales/{en,ru,he}.ts` using `t` / `tNodes` templates, never concatenation, no em/en dashes), `Intl` formatters, and `<PokerNotation>` (`<bdi dir="ltr">`). |
| **Design tokens** | `tokens/tokens.css`, `tokens/tokens.json` | Single source of all colours, durations (`--dur-1..4`), easing curves, spacing, and typography across all 7 themes. |

---

## 2. How a room talks to the engine

1. **No poker math in UI.** Never compute equity, hand ranks, runout effects, or combo exclusions inside `src/ui/`. Ask `engine/` via `src/engine-api/` inside the room store (`src/domain/<room>/`).
2. **Channel cancellation (`createChannel`).** Rapid inputs (typing, clicking board slots, toggling streets) must cancel stale in-flight requests so an earlier slow response never overwrites newer state:
   ```ts
   const equityChannel = engine.createChannel('equity-main');
   const res = await equityChannel.run((opts) => engine.async.calculateEquity(req, opts));
   ```
3. **Never compute for collapsed panels.** `EquityStore.recompute()` checks `runoutsExpandedSignal.value` before invoking `exploreRunouts`; when collapsed, it cancels `runoutsChannel` and keeps the snapshot `idle`.
4. **Honesty tiers live at the engine boundary.** `EngineResponse<T>` returns `{ tier, qualifier, method, data }`. The room header renders one `<TierBadge>` (`Exact · all N runouts` or `Estimated ± x · N samples`) and states `"Equity is not EV."` whenever equity alone is shown.
5. **Re-render efficiency.** Changing `theme`, `lang`, `pace`, or `motion` never recomputes facts. Only store mutations that change inputs trigger `engine-api`.

---

## 3. Shared shorthand & local storage patterns

- **Single grammar:** Keep all hand/range/token parsing in `src/domain/shorthand/` (`parsePlayerHandInput`). Future rooms (`hand`, `review`, `training`) extend the same parser rather than adding a second validator.
- **Event-sourced persistence:** Record immutable domain events in `src/domain/storage/eventLog.ts` (`riverline-study-v1` IndexedDB store with memory backend fallback for Node/Vitest) and derive room views (`SavedMatchupRecord`) from the log. Keep UI appearance (`riverline.appearance.v1`) separate, while supporting schema-validated one-file JSON export and import (`schemaVersion: 1`).

---

## 4. How i18n and layout rules stay clean

1. Add every key to `src/i18n/types.ts` and translate in `en.ts`, `ru.ts`, and `he.ts` together. TypeScript enforces key completeness; `src/i18n/i18n.test.tsx` enforces zero em/en dashes (`—`/`–`) across all locales.
2. Wrap every card, range, signed delta, combo count, and equity percent in `<PokerNotation>` so RTL Hebrew keeps notation left-to-right.
3. Use CSS logical properties (`margin-inline`, `padding-inline`, `inset-inline-start`, `text-align: start`) and CSS variables (`var(--...)`) only. Avoid `min-height < 28px` on clickable desktop buttons (`audit:layout` target floor), avoid raw colour/ms/bezier literals (`npm run check:raw`), and never nest `<Panel>` inside `<Panel>` (use `<PanelSection>` inside one `<Panel>`).

---

## 5. How tests, golden checks, and Playwright audits are extended

1. **Domain & parser tests (`src/domain/<room>/*.test.ts`):** Test input parsing, store state transitions (dense/compact thresholds, collapsed-panel skip, channel supersession), and storage roundtrips using `createEngineClient({ mode: 'inline' })` + `createMemoryStudyBackend()`.
2. **UI integration tests (`src/ui/rooms/<room>/*.test.tsx`):** Render with `@preact/signals` in `jsdom` to verify kit wiring, live previews, errors, and actions.
3. **Golden verification (`src/test/*.golden.test.ts` + `tools/verify-golden.mjs`):** Generate reference expectations with `python tools/eqexact.py` and verify the live store/engine matches exact integers (wins, ties, trials) and percentages.
4. **Layout & theme audits across all 7 themes × 3 locales × 2 viewports:**
   - Set `aria-busy={isCalculating}` on the room's root `<section>` while async worker requests are in-flight so `waitForSettled` waits for settled DOM + painted pixels before capturing audit frames.
   - Add named presets for key room states (edge counts, errors, dense/compact modes) to `applyPreset` in the room store.
   - Expose the preset parameter cleanly in `src/domain/testHook.ts` (`RiverlineTestStateInput`, `applyQueryOverrides`, `setTestState`, `reset`).
   - Add entries to `F1_STATES` in `tools/f1-states.mjs`.
   - Run all six repository gates before reporting:
     `npm run typecheck`, `npm test`, `npm run golden`, `npm run check:raw`, `npm run audit:layout`, `npm run audit:theme`.
