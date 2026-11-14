# Research briefs for Gemini Deep Research

Six briefs, in order of value. For each run: paste the **Context** block, then one brief. Each run is independent and needs no repository. Save each report to `docs/research/` with its date.

A research report is a set of leads. Nothing in it becomes a product fact, a legal position or a copied table until a human has checked the sources.

---

## Context (paste first, every time)

You are researching for **Riverline**, a free, local-first study application for No-Limit Texas Hold'em, built by one person. It is desktop-first, runs in the browser, and supports English, Russian and Hebrew (right-to-left). Its positioning: "the honest poker coach for the hands you actually play". Users record real hands from live home games, review them (decisions separated from luck, compared with their own stated plan and with a baseline strategy), and practise the gaps. The target game is unusual for poker software: live home games with six to eight players, buy-ins of 30 to 60 big blinds, no rake, many limped multiway pots. It is not a solver and never gives advice during play. Every number it shows carries a tier: Exact, Verified (measured against a reference within a stated tolerance), Estimated, or Unavailable. It runs no language model and no solver at runtime and sends nothing off the device. The owner prefers free and permissively licensed sources and will not use anything whose licence is unclear.

Rules for your report:
- Every factual claim carries a source link and the date you accessed it. Prefer primary sources (the project's own repository, licence file, documentation, statute text) to blog posts.
- Mark each claim **[Sourced]**, **[Inferred]** or **[Opinion]**. Do not write "verified" unless you ran something, and then show what you ran.
- Say plainly what you could not find.
- No legal advice: for legal topics give a reading list and the questions a lawyer should be asked.
- End with: the five most useful findings; what you are least sure of; what to check next.
- Today is November 2026. Treat anything you remember without a source as unverified.

---

## Brief 1. Reference sources for a baseline at 30 to 60 big blinds

Question: what published or freely computable strategy references exist that could measure, honestly, how good a heuristic preflop baseline is for six to eight players at 30 to 60 big blinds without rake, including limped and multiway pots?

Cover: (a) published range sets and charts, with their exact terms of use and whether redistribution or derived data is allowed; (b) open-source solvers and trainers (preflop and postflop), each with licence, what game trees and stack depths they can handle, hardware needs, and whether their **output** may be shipped in another product; (c) push-or-fold and short-stack models that are exact or near exact; (d) academic work on multiway equilibria and why two-player methods do not transfer; (e) how other products phrase their accuracy claims. Then propose: what a "Verified" tier could truthfully cover first (which spots, which stack depths, which tolerance), how to measure the gap between a heuristic and a reference, and what must stay Estimated. One earlier research report on this exists and is unverified; do not rely on it.

## Brief 2. Russian and Hebrew poker terminology as players really use it

Question: for the term list below, what do Russian-speaking and Hebrew-speaking players actually say and write, today, in forums, streams, training sites and club chats?

Terms: fold, check, call, bet, raise, 3-bet, 4-bet, all-in, limp, open, check-raise, squeeze, donk bet, overbet, continuation bet, preflop, flop, turn, river, button, blinds, straddle, ante, stack, effective stack, pot, range, showdown, board, equity, pot odds, implied odds, blockers, outs, drawing dead, set, flush draw, gutshot, kicker, cooler, bluff, value bet, position names, buy-in, rebuy, cash out, settle up, home game.

Current choices to test: Russian uses transliterated loanwords except fold = «пас»; pot = «банк»; range = «диапазон»; continuation bet = «си-бет»; casual address («ты»). Hebrew uses loanwords throughout (פולד, קול, רייז); pot = «קופה»; range = «ריינג'»; masculine singular address. Position codes and abbreviations stay in Latin letters in both.

For each term give: the dominant form, common alternatives, where each is used (casual, written, formal), and a source showing real usage. Flag every current choice that real usage contradicts. Add: how numbers, currency and card notation are written inside Russian and Hebrew sentences, and conventions for interface buttons in each language.

## Brief 3. Right-to-left engineering for dense data interfaces

Question: what are the proven practices and the known traps when a data-dense web application (tables, charts, card and range notation, mixed numbers and text) must work in Hebrew alongside left-to-right languages?

Cover: CSS logical properties and their browser support, especially Firefox; bidirectional text isolation (`dir`, `<bdi>`, `unicode-bidi`); numbers, percentages, currency and signed values inside right-to-left text; which interface elements mirror and which must not (charts, progress bars, timelines, playing cards, a 13×13 hand matrix, keyboard arrow-key meaning); icon mirroring; text expansion and truncation; fonts that cover Latin, Cyrillic and Hebrew with matching weight and x-height (Rubik and Inter in particular, with licences); testing tools and automated checks for bidirectional bugs. Give concrete code patterns and a checklist of twenty items to test on every component.

## Brief 4. What skill-acquisition research says about a study tool like this

Question: what does research on learning and deliberate practice support, and warn against, for a tool that drills decisions and reviews a learner's own performance?

Cover: timing of feedback (immediate or delayed, per item or per session) for decision skills under uncertainty; outcome bias and how to teach separating decision quality from results; spaced repetition (fixed intervals compared with FSRS-style scheduling) for conceptual decision skills as opposed to fact recall, including whether it applies at all; interleaving and desirable difficulty; self-explanation ("what were you thinking?") before feedback; calibration training; learned helplessness and blunt feedback, including what makes direct criticism motivating or damaging; habit formation without streaks or loss aversion; how chess and language-learning tools apply these and what evidence exists that it works. For each: the finding, the strength of the evidence, and a specific implication for Riverline.

## Brief 5. Legal and platform reading list (not advice)

Question: what must a free poker study tool check before public release, in general and specifically for users in Israel and Russia?

Cover as a reading list with primary sources: (a) how study and training tools are distinguished from gambling services in law and in app-store and payment-provider policies; (b) a home-game ledger that records real money between friends: where such a feature creates legal or platform risk, and how comparable apps present it (chips or points, disclaimers); (c) online poker rooms' rules on real-time assistance and prohibited software, and how study tools state compliance; (d) privacy duties for a local-first app with no accounts and no analytics, and what changes if optional sync is added; (e) age notices and responsible-play notices; (f) trademark considerations for the name "Riverline" in the gaming class, given that a real-money poker room uses a similar name: what a trademark search should cover and where; (g) licences of fonts, sounds, card designs and data. End with the ten questions to put to a lawyer.

## Brief 6. Performance budget for browser-based poker computation and animation

Question: what performance can a browser application expect, and what are the pitfalls, when it runs hand evaluation, exact equity enumeration and Monte Carlo sampling in Web Workers and animates a card table on modest laptops?

Cover: hand-evaluator approaches in JavaScript and WebAssembly with published throughput; the cost of worker messages and structured cloning, transferable objects and SharedArrayBuffer (with the cross-origin isolation it requires); cancellation patterns; deterministic seeded random number generators; when WebAssembly pays for itself; worker pools and device core counts; animation cost of transforms, opacity, filters and backdrop blur on integrated graphics, especially in Firefox; measuring frame time in continuous integration; IndexedDB performance and durability, storage persistence and eviction rules per browser; installable web app limits on desktop and iOS. Give target budgets (for example two-player exact equity on a flop, a ten-player sampled preflop equity, a view transition) with sources, and a short list of measurements to automate.
