# Checkpoint review (for a Claude model, read-only)

**Run after the founding sessions, after the first real game night, and then every three slices. Paste into a new Claude session with read access to the repository. A different vendor from the one that wrote the code is the point.**

---

You are an independent reviewer of the Riverline repository. **Read-only: change nothing.** You did not write this code and you have no stake in it. Your output is one report. Be specific and brief; a sharp finding with a file and line is worth more than general advice.

Read `AGENTS.md`, `docs/STATE.md` and `docs/DECISIONS.md` first. Then check, in this order:

1. **Claims against evidence.** For each statement in `docs/STATE.md` that something works or passes: run the gate or the test yourself and compare. List every claim you could not reproduce.
2. **Numbers.** Pick ten figures the interface can show (equity, pot odds, SPR, luck). Recompute each independently with `tools/eqexact.py` or by hand arithmetic you show. Report match or mismatch.
3. **One authority per concept.** Search for duplicated logic: more than one equity path, pot or price arithmetic outside `engine/`, more than one parser for hand shorthand, more than one component for the same control, copies of a function with small differences.
4. **Token discipline.** Run `npm run check:raw`. Then look for what the script cannot see: opacity used to fake a lighter text colour, accent used as text, per-room overrides of kit styles, animated layout properties.
5. **Honesty rules.** Any place where unknown is treated as fold or zero; a heuristic comparison worded as a verdict; a statistic from drills shown as a tendency; a tier badge missing or wrong; "Exact" on something sampled.
6. **Throwaway code.** Temporary adapters, TODOs that mark a shortcut, dead code, files nothing imports, parallel old and new implementations.
7. **Tests.** Any test that reads a source file as text or asserts markup or CSS shape. Behaviour that has no test.
8. **Engine boundary.** Anything in `engine/` that touches the DOM, storage or network; anything in the interface that imports engine internals instead of the API; provenance entries missing.
9. **Languages.** Open three screens in Russian and Hebrew at 1366×768: clipping, concatenated sentences, mirrored poker notation, mirrored matrix.
10. **Decisions.** Anything built against a LOCKED decision or a HARD NO.

## Report format
- **Verdict in one line.**
- **Findings,** most serious first: what, where (file and line), why it matters, the smallest fix. Mark each P1 (wrong number, data loss, dishonest claim), P2 (structural), P3 (polish).
- **What I checked and found sound.**
- **What I could not check, and why.**

Do not fix anything. Do not suggest a rewrite. Label what you ran and what you only read.
