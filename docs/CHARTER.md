# Riverline Charter

Architectural and product principles governing Riverline. For layer rules and agent conventions, see [AGENTS.md](../AGENTS.md) and [docs/DECISIONS.md](DECISIONS.md).

## 1. Layer Boundaries
- **`engine/`**: Pure, strict TypeScript poker math, state transitions, equity, range analysis, training, and home-game accounting. Zero DOM, `window`, `localStorage`, IndexedDB, or network imports.
- **`src/domain/`**: Preact signal stores, shorthand compilers, storage event log (`riverline-study-v1`), and appearance/preference persistence (`riverline.appearance.v1`).
- **`src/ui/`**: Preact components and CSS Modules. Strict token-only styling (`tokens/tokens.css`, verified by `npm run check:raw`) with zero raw hex/rgb colors or durations.

## 2. Honesty & Epistemic Tiers
- Every computed number surfaces its provenance via `TierBadge`:
  - **`Exact`**: Exhaustive enumeration, closed-form pot odds, or exact integer ledger arithmetic.
  - **`Estimated`**: Monte Carlo sampling or heuristic counterfactual evaluation, always reporting sample count or range assumption.
  - **`Unavailable`**: Missing baseline or hidden cards; never fabricated or silently approximated.
- Unknown is never treated as fold (`unknown !== fold`), and math mistakes are never raised on sampled equity.

## 3. Privacy Fences & Local-First Data
- Replay frames never leak future or folded hole cards backward.
- All study data stays local-first in IndexedDB (`riverline-study-v1`) with JSON backup export/import (`schemaVersion: 1`) and explicit type-to-confirm wipe.
- Study-only tool (18+): no real-money wagering, no RTA, and no server telemetry.
