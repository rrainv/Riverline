# Gemini: bug batch

**Paste on a schedule (for example once a week), not when a bug appears.**

---

Work through `docs/BUG_INBOX.md`.

1. Read the inbox. Group the open bugs by the component or module that owns them. Tell me the groups and which you propose to fix now (P1 first: data, money, numbers).
2. For each group, find the cause in the owning component or module. **Fix it there, once.** Do not patch the screen that showed it. If two bugs share a cause, say so and fix the cause.
3. For every fix that touches behaviour, add or extend a behaviour test that fails before and passes after.
4. Run all five gates.
5. Update the inbox: fixed (with the commit), not reproduced (with what you tried), needs the owner (with the question).
6. Report in five lines, with gate outputs. If a bug turns out to be a design question, do not decide it: put the question to me.

Budget: (size). Stop when it is spent.
