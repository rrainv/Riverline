# Bug inbox

One line per bug. Fixed in batches, not as they appear. A bug that blocks the current slice is fixed in the slice and noted here as fixed.

| # | Found | Where | What happens / what should happen | Severity (data, money, numbers = P1) | Status |
|---|---|---|---|---|---|
| 1 | 2026-11-14 (F1b) | `src/ui/kit/CommandPalette.module.css` (`.input`) | Search input rendered at `25px` height (`< 28px` desktop target minimum); set `min-height: var(--h-input)` (`38px`). | P2 | Fixed in F1b |
| 2 | 2026-11-14 (F1b) | `src/ui/kit/CommandPalette.module.css` (`.resultHint`, `.countChip`, `.kbd`) | Route hint `/` used `--text3` inside `.dialog`, measuring `3.54`–`3.70 < 4.5` contrast on selected row (`--hover` over `--overlay-bg`) in Daylight and Paper; switched to `--overlay-ink2` and `--overlay-line`. | P2 | Fixed in F1b |
| 3 | 2026-11-14 (F2a) | `tokens/tokens.css` (`[data-motion="reduced"]`) | `[data-motion="reduced"]` sets `--dur-1..4: 1ms` while keeping `--pace` unchanged; added dedicated `--beat-action` and `--beat-think` tokens not zeroed under reduced motion so action pauses obey `04_DESIGN_SPEC.md` §6.2.10. | P3 | Fixed (hand-recorder) |
