# ENGINE-MAP-001: classify the old repository (read-only)

**For any capable coding agent with read access to the old repository.** It changes nothing. Its output is one file.

---

You are inspecting the old Riverline repository at `C:\Users\sjzns\Projects\poker-gto-app` (branch `codex/stabilization`). **Do not edit, stage, commit, clean, stash, reset or run any command that writes into it.** You may read files and run read-only commands (`git status`, `git log`, `git branch -a`, `git ls-files`, `git worktree list`, `wc`, `grep`). Do not run its test suite unless asked.

## Goal
A map that tells the new repository's owner exactly what can be copied as engine code, what must be rewritten, what unmerged work exists in worktrees, and what is left behind.

## Produce `ENGINE_MAP.md` with
1. **Facts:** current branch and commit; whether the working tree is clean; the complete list of worktrees (`.claude/worktrees/*` or `git worktree list`) and branches that hold uncommitted or unmerged work not on `codex/stabilization` (one line each: branch/path, what it touches, how far ahead/behind, and whether any engine or service files differ from `codex/stabilization`).
2. **Inventory:** every source file under `app/src/`, `shared/` and any other source folder, with line count, grouped by folder.
3. **Classification of each file** as one of:
   - **engine**: pure logic, no DOM, `window`, `document`, storage, network or timers. Copy with tests.
   - **service**: application logic with no DOM but with dependencies on storage or identity. Copy only if the dependency can be passed in.
   - **bridge**: wires engine or services to the page. Rewrite thin.
   - **ui**: rendering and events. Leave behind.
   - **mixed**: contains pure logic worth extracting. Name the functions and the lines.
   State the evidence for each classification in a few words (for example "imports only shared/poker-domain", "calls document.querySelector on line 212").
4. **Dependency direction:** for every engine and service file, what it imports. Flag any engine file that imports from a ui or bridge file.
5. **Contracts:** every versioned data contract (hand state, table rules, replay, saved objects, training memory, personal strategy evidence), its version, where it is defined and where it is validated.
6. **Tests:** for every engine and service file, the tests that cover its behaviour. Separately, a count of tests that read source files or CSS as text (these are not copied).
7. **Data and assets:** strategy and reference data files with whatever provenance or licence note exists beside them; icons, card backs, sounds.
8. **Locale:** the message catalogues, their format, and the number-format and number-input modules.
9. **Storage (for safe owner data backup):** exact browser storage mechanisms (IndexedDB database/store names, `localStorage` keys, and object shapes) used by the old app, so a standalone read-only export/backup script can extract the owner's real study data safely before any migration.
10. **Surprises:** anything that contradicts `03_LEGACY_REPO.md` in the handoff package.

## Rules
- Report only what you read. Where you did not open a file, say "not opened".
- Do not summarise from file names alone when the classification matters; open the file.
- Do not print secrets or local configuration values (such as `.codex/config.toml` or Supabase keys).
- Keep the map to what is useful; no commentary on code quality beyond the classification.
