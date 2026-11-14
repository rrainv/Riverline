# Gemini: start a slice

**Start a fresh session for each slice (do not stack slices in one long chat). Fill the two blanks and paste.**

---

Next slice: **(name)**. After it I want to be able to: **(one sentence)**.

1. Read `AGENTS.md`, `docs/STATE.md`, and `docs/DECISIONS.md`. Read **only** the parts of `docs/handoff/06_PRODUCT_MAP.md` and `docs/handoff/04_DESIGN_SPEC.md` that this slice touches (do not re-read the rest of `docs/handoff/` or `docs/reference/`), and inspect the matching states in `docs/design/prototypes/riverline-app.html`. If the old app had this feature, read the smallest region of the old repository that shows its edge cases (read-only) and list the cases you will keep.
2. Write the plan from `docs/SLICE_TEMPLATE.md`, at most one page. Include: the kit components you will reuse; any you need to add or change (and why an existing one cannot be extended); the engine calls; what you will merge or delete along the way; the motion moments that apply; your questions with a recommendation each; and anything in my request you think is a mistake.
3. Stop and wait for my yes.
4. Build. Tokens only, CSS Modules (`*.module.css`) in kit components only, engine API for every number, three languages (`en`, `ru`, `he`).
5. Run all five gates (`typecheck`, `test` + `golden`, `check:raw`, `audit:layout`, `audit:theme`). Fix until each is at zero.
6. Report in five lines: what I can do now; each gate with its command and output; what is not done; bugs logged; the one thing you need from me. Add the built or missing list of motion moments.
7. Update `docs/STATE.md`, append any decision to `docs/DECISIONS.md` and any idea to `docs/IDEA_BANK.md`. Stop.

If the budget in the plan runs out, stop and show me what exists. If the same defect survives two corrections, stop and tell me the concept is wrong and what you would do instead.
