# Engine spec 1: Multi-spot preflop baselines and interpolation

Status: DRAFT for owner review. Read-only research; no code written. Date: 2026-11-17.
Scope: `engine/personal-strategy/` (pure strict TS), with the thin `src/engine-api/` surface it needs.
Governing rules: AGENTS.md §4 (honesty tiers), §6 (ask before new layer / engine-API change / schema change), DECISIONS B20 (licences), C1 (one badge, no numeric confidence), Section Q (LOCKED: 30/40/50/60/100 bb × 6-max/8-max).

## 0. What this spec decides, and what it needs from the owner

Needs the owner's yes before any code (AGENTS §6):

| # | Decision | Recommendation |
|---|---|---|
| D1 | Who authors the baseline numbers, and from what source | Owner-authored from sources the owner names; each table carries a provenance row. No model-drafted numbers enter as anything above Estimated. |
| D2 | Storage/schema change: per-hand frequencies instead of cutoff indices only | Yes, as a new baseline data type. The evidence schema is untouched. |
| D3 | Engine-API change: coverage query and a qualifier on the existing tier | Additive only; existing method signatures unchanged. |
| D4 | Extend `StrategyContext` key with spot-class suffixes (`limpers:n`, `callers:n`) | Yes, suffixes only, so every existing key stays valid. |
| D5 | 8-max: reuse 6-max seats where "same seat from the button" is close? | Allow only as a labelled `mapped` provenance, never as authored. |
| D6 | Push-fold: separate axis with an offline exact computation under `tools/` | Yes, and it is the only place a `Verified` baseline is plausible (see §8). |

## 1. Where things stand (verified against the repo)

- Baseline today: 6-max, 100 bb, RFI only, five seats (UTG/HJ/CO/BTN/SB), eight family cutoff indices per seat (`engine/personal-strategy/baseline.ts`). Everything else returns `unavailable`.
- `projectStrategyLeakMap` reports availability as `tableSize === 6 && stackDepthBb === 100`; `computeBaselineMix` in `engine/training/drill.ts` does the same. Facing-open and facing-3bet mixes there are hard-coded from `handStrengthScore`, not from a baseline table.
- Resulting open ranges, computed from the indices (script `check_baseline.py`, stdlib Python, exit 0): UTG 124 combos (9.4%), HJ 190 (14.3%), CO 286 (21.6%), BTN 434 (32.7%), SB 370 (27.9%). These are the model-drafted table's output, not a measurement of anything.
- **Defect found, not fixed (out of scope, reported):** three entries disagree with their own trailing comments. `baseline.ts` line 70 BTN `suited_queens_jacks: 9` says "down to Q3s" but index 9 is Q2s; line 79 SB `suited_kings: 8` says "down to K5s" but index 8 is K4s; line 80 SB `suited_queens_jacks: 6` says "down to Q6s" but index 6 is Q5s. I do not know whether the index or the comment is the intended value, so the owner should decide. The percentages above use the indices as written.
- Existing test `personal-strategy.test.ts` asserts the 6-max 100 bb UTG suited-kings cutoff is KTs and that 50 bb is `unavailable`. The second assertion changes deliberately once any 50 bb data exists.

## 2. Principle: the baseline is a table with a pedigree, not a function

Every number shown as "baseline" must trace to a row in a provenance ledger. The engine never invents a baseline at runtime (B7). Interpolation is the only runtime derivation, it is deterministic arithmetic on authored anchors, and it is labelled.

## 3. Spot taxonomy

A `BaselineSpot` is identified by a context key extending today's `strategyContextKey` (`6max|100bb|preflop_rfi|UTG[|vs:X][|rules:Y]`). New suffixes are appended only (D4), so existing keys remain valid.

| Class | Meaning | Extra key parts | Notes for the home game |
|---|---|---|---|
| `preflop_rfi` | First in, folded to you | none | Existing. Rake-free: ranges are authored for no rake and the ledger says so. |
| `facing_open` | One raiser ahead | `vs:<opener seat>`, `callers:n` (0,1,2+) | Seat pair matters; cold callers change 3-bet value. |
| `facing_3bet` | You opened, got 3-bet | `vs:<3bettor seat>`, `inpos:bool` | Position relation is in the key, not derived. |
| `limp_iso` | One or more limpers ahead | `limpers:n` (1,2,3+) | Many limped multiway pots in the owner's game (RESEARCH_BRIEFS, idea 26/54). Distinct from RFI; never reuse RFI rows. |
| `push_fold` | Shove-or-fold regime | uses effective stack, see §7 | Not on the 30–100 bb grid. |

Spot cells that cannot occur stay impossible via the existing `isSpotMapCellPossible` rule; new classes add their own possibility rules (for example `limpers:n` needs at least n seats to act before you).

## 4. Representation

Replace "one cutoff index per family" as the stored form with **per-hand-class action frequencies**, keeping the cutoff model as a derived projection.

```
BaselineRow {
  contextKey: string
  frequencies: Record<handClass /*169*/, { raise: number; call: number; fold: number }>  // sums to 1 per hand
  provenanceId: string        // ledger row
}
```

- Why: mixed strategies (3-bet bluffs, limp-raise) cannot be expressed as one monotone cutoff. Evidence entries already allow optional `frequencies`, so the personal side is ready.
- The monotone family cutoff view (`getEstimatedBaselineCutoff`) is computed from the frequencies: the cutoff is the last hand in the family order whose raise-or-continue frequency is at least 0.5. Where a family is not monotone the projection reports "mixed" and the comparison UI falls back to per-hand cells.
- Unknown is never fold or zero (AGENTS §4): a missing hand class is absent from the row, and the row is `incomplete`, which caps it at Unavailable for those hands.
- Fixed-size data: 169 hand classes × 3 numbers ≈ 507 numbers per spot. A grid of 5 stack depths × 2 table sizes × several seats × five classes stays small; exact counts are an authoring-plan question, not an engine one. Not computed here.

## 5. File layout (no new layer)

Stays inside `engine/personal-strategy/`, pure TS, no I/O:

```
baseline/
  types.ts            BaselineRow, ProvenanceRow, Coverage
  registry.ts         lookup by context key; frozen at module load
  interpolate.ts      stack-axis interpolation (pure)
  map-seats.ts        8-max -> 6-max mapping (D5), labelled
  tables/             authored data, one file per (tableSize, stack, class)
  provenance.ts       ledger rows
baseline.ts           kept as the facade; same exports today, new ones additive
```

`docs/ENGINE_PROVENANCE.md` gets a row per authored table; `docs/THIRD_PARTY.md` gets a row for any outside chart or dataset (B20). Copyleft sources are excluded; a chart whose licence is unknown is not used.

## 6. Honest tiers for the baseline

Tier vocabulary stays Exact / Verified / Estimated / Unavailable, one badge per panel (C1). Qualifiers are text, not numbers.

| Situation | Tier | Qualifier shown |
|---|---|---|
| Authored anchor, source recorded, not measured against a reference | Estimated | "Estimated · from <source label>" |
| Between two authored stack anchors | Estimated | "Estimated · interpolated 40↔60 bb" |
| Mapped from another table size (8-max from 6-max seat) | Estimated | "Estimated · mapped from 6-max" |
| Outside the bracket of authored anchors | Unavailable | "No baseline at this depth" |
| Spot class not authored | Unavailable | names the missing class |
| Exact computation reproducible with a tool in `tools/` and a stated tolerance | Verified | "Verified · push/fold, <tool>" (only §7) |

Rules:
- Interpolated or mapped data can never be badged higher than its weakest input.
- No "GTO says", "optimal" or numeric confidence anywhere (C1).
- The four tiers cover the existing `baselineTier: 'estimated' | 'unavailable'`; adding `verified` and the qualifier text is an engine-API change (D3).

## 7. Interpolation and extrapolation rules (proposal, unmeasured)

Anchors are the five presets: 30/40/50/60/100 bb. They are all authored points, so interpolation is needed for two things only: (a) non-preset depths such as 45 or 75 bb, and (b) filling a preset whose own table is not yet authored when both neighbours are.

1. **Interpolate in strength space, not frequency space.** For each family, interpolate the cutoff position (a real number over the family order), then re-derive frequencies by keeping each hand's authored mixing shape at the lower anchor. Averaging frequencies directly produces ranges that are not coherent hands-to-action orderings.
2. **Bracket only.** Interpolate only between two authored anchors; the maximum allowed bracket is 40 bb (60→100 qualifies). No extrapolation, ever: below 30 bb or above 100 bb is Unavailable (or the push-fold regime, below).
3. **Axis.** Use linear in stack depth between anchors. Whether log-depth fits better is an authoring question I cannot answer without data; the rule is chosen as the simplest one and written into the qualifier text.
4. **Monotonicity guard.** The interpolant must preserve the family order and must not make a range wider when the anchors say tighter; a property test enforces this (§9).
5. **Spot-class coupling.** A class is interpolated only from rows of the same class and the same seat relation. Facing-open rows never borrow from RFI.

Push-fold regime: below roughly the depth where shove-or-fold applies, the stack is a continuous input (effective stack in bb) rather than a preset. The natural way to get `Verified` here is an offline exact Nash computation written under `tools/` (stdlib Python, like `eqexact.py`), producing a golden JSON like `tools/golden/section8.golden.json`. Heads-up shove/call is a small game that can be computed exactly; multiway push-fold is a harder equilibrium and stays Estimated unless computed. This is D6.

## 8. 8-max handling

- `positionsForTableSize(8)` already lists UTG, UTG+1, LJ, HJ, CO, BTN, SB, BB; `playersBehindForPosition` gives the number of players left to act.
- Rule: the three early seats (UTG, UTG+1, LJ) have no 6-max counterpart. They need authored rows or are Unavailable. HJ/CO/BTN/SB may be mapped from the 6-max seat with the same name only under D5, labelled "mapped", Estimated.
- A mapped row is flagged in the provenance ledger so the UI badge and the Estimated qualifier cannot be mistaken for an authored 8-max table.

## 9. Backward compatibility and tests

- Existing exports in `baseline.ts` keep their names and behaviour for 6-max 100 bb RFI. Existing keys stay valid because new key parts are suffixes.
- `projectStrategyLeakMap`'s availability rule (`tableSize===6 && stackDepthBb===100`) becomes a call to the registry's coverage query, so availability is data-driven. This is a deliberate change to behaviour and to the 50 bb assertion in `personal-strategy.test.ts`.
- `engine/training/drill.ts` `computeBaselineMix` is rewired to registry lookups for `facing_open` and `facing_3bet`; the `handStrengthScore` fallback is kept only for spots with no row and then reports Unavailable. Needs a separate owner nod since it changes drill grading (`MATCHES_GAP=0.05`, `CLOSE_GAP=0.15`).

Planned tests (none written, none run):
- Coverage matrix snapshot: every (size × depth × class × seat) cell is exactly one of authored / interpolated / mapped / unavailable.
- Provenance completeness: every row has a ledger entry with a recorded licence where outside data is involved.
- Frequencies sum to 1 per hand; missing hands mark the row incomplete.
- Interpolation: identity at anchors; bounded by the two anchors; monotone in stack; deterministic.
- No upgrade: an interpolated or mapped row never reports a tier above its inputs.
- Facade: the existing UTG suited-kings KTs assertion still passes.

## 10. Verification and honesty about what was run

Run in this session: the cutoff cross-check above (`check_baseline.py`, output: 3 index/comment problems in 40 entries; open percentages listed in §1). Not run: any test in the repo, `npm` gates, any TS code. Per AGENTS §4 nothing here is reported as "verified" beyond that command.

## 11. Open authoring questions for the owner

1. Which source(s) for the 30/40/50/60 bb tables, given the owner's own game is rake-free with many limps? DECISIONS §G mentions "a measured Verified baseline for 30 to 60 big blinds" as the aspiration; nothing in the repo produces it yet.
2. Fix or keep the three index/comment mismatches before they are copied into a new table.
3. Order of authoring: recommendation is RFI at 40 and 60 bb (to make 50 interpolatable), then facing-open, then limp-iso, then facing-3bet.
