# Riverline terminology sheet (EN / RU / HE)

Status: decided with the owner on 2026-10-07 (manager chat). A guide for i18n work; the owner's judgement is final and terms can be revised. The owner is fluent in Russian and Hebrew and judges naturalness of UI language.

## Rules

1. **General UI terms** (Replay, Back, Analyze, Settings, Save, Cancel, Search, Filter…) use **proper standard translations**, the conventions people already know from other apps. Not loanwords, not literal calques.
2. **Poker terms follow real player usage.**
   - **Russian:** transliterated loanwords, except **fold = пас**.
   - **Hebrew:** loanwords throughout.
3. **Abbreviations and position codes stay in Latin script** in every language: UTG, HJ, CO, BTN, SB, BB, 3-bet notation in numbers, SPR, EV, GTO, MDF, bb.
4. **Hebrew RTL**: poker data (cards, ranges, amounts, abbreviations) renders as LTR islands; the 13×13 matrix is never mirrored.
5. Native words may appear as **glosses** in the glossary and tooltips (e.g. «пас: сбросить карты»), never replacing the chosen term in UI.
6. No em/en dashes in user-facing product sentences.

## Actions

| English | Russian | Hebrew |
|---|---|---|
| Fold | **пас** | פולד |
| Check | чек | צ'ק |
| Call | колл | קול |
| Bet | бет | בט |
| Raise | рейз | רייז |
| 3-bet / 4-bet | 3-бет / 4-бет | 3-בט / 4-בט |
| All-in | олл-ин | אול-אין |
| Limp | лимп | לימפ |
| Open / open-raise | опен / опен-рейз | אופן / אופן-רייז |
| Check-raise | чек-рейз | צ'ק-רייז |
| Squeeze | сквиз | סקוויז |
| Donk bet | донк | דונק |
| Overbet | овербет | אוברבט |
| C-bet | **си-бет** | סי-בט |

Examples: button «Колл 2.5 bb» / «קול 2.5 bb»; history «BTN: рейз до 7.5 bb» / «BTN: רייז ל-7.5 bb».

## Table, streets, core concepts

| English | Russian | Hebrew |
|---|---|---|
| Preflop / Flop / Turn / River | префлоп / флоп / терн / ривер | פרה-פלופ / פלופ / טרן / ריבר |
| Button / blinds / straddle / ante | баттон / блайнды / страдл / анте | באטן / בליינדים / סטראדל / אנטה |
| Stack / effective stack | стек / эффективный стек | סטאק / סטאק אפקטיבי |
| **Pot** | **банк** | **קופה** |
| **Range** | **диапазон** | **ריינג'** |
| Showdown | шоудаун | שואודאון |
| Board | борд | בורד |
| Hero | Hero | הירו |
| Equity / EV / SPR / GTO | эквити / EV / SPR / GTO | אקוויטי / EV / SPR / GTO |

## Strategy and maths

| English | Russian | Hebrew |
|---|---|---|
| Pot odds | шансы банка | סיכויי קופה |
| Required equity | необходимое эквити | אקוויטי נדרש |
| MDF | MDF | MDF |
| Combos | комбинации | קומבינציות |
| Value | **валью** | ואליו |
| Bluff / semi-bluff | блеф / полублеф | בלוף / סמי-בלוף |
| Outs / draw / nuts | ауты / дро / натс | אאוטים / דרו / נאטס |
| Blockers | блокеры | בלוקרים |
| Hand classes | топ-пара, сет, трипс, флеш-дро, стрит | טופ פייר, סט, טריפס, פלאש דרו, סטרייט |

## Riverline product terms

| English | Russian | Hebrew |
|---|---|---|
| Hand (workspace) | Раздача | יד |
| Spot | Спот | ספוט |
| Personal Strategy | Личная стратегия | אסטרטגיה אישית |
| **Game** (Personal Strategy container holding Approaches) | **Игра** | **משחק** |
| Approach | Подход | גישה |
| **Table rules** (blinds, rake, stacks, table size; versioned) | **Правила стола** | **חוקי שולחן** |
| Baseline | Базовая стратегия | אסטרטגיית בסיס |
| Exact / Verified / Estimated / Unavailable | Точно / Подтверждено / Оценочно / Недоступно | מדויק / מאומת / משוער / לא זמין |
| Always / Sometimes / Never | Всегда / Иногда / Никогда | תמיד / לפעמים / אף פעם |
| Unsure / Review later / Mistake | Не уверен / Разобрать позже / Ошибка | לא בטוח / לבדיקה בהמשך / טעות |
| Same spot / Similar spot | Тот же спот / Похожий спот | אותו ספוט / ספוט דומה |
| Training / Drill / Orbit | Тренировка / Упражнение / Круг | אימון / תרגיל / סבב |
| Session report / Key moment | Отчёт о сессии / Ключевой момент | דוח סשן / רגע מפתח |
| Saved / Learn / Coverage | Сохранённое / Обучение / Охват | שמורים / למידה / כיסוי |
| Game night (Home Game workspace, user-facing) | Покерный вечер | ערב פוקר |
| Private table (no rake) (Table rules preset) | Частный стол (без рейка) | שולחן פרטי (בלי רייק) |

Notes: «раздача» is a played hand, «рука» means hole cards. «Круг» / «סבב» is how players describe going once around the table; «орбита» is rare in Russian.

## Conventions (decided)
- **Hebrew gendered labels:** masculine default (e.g. «לא בטוח»), the common app convention.
- **Button style follows each language's own convention** (Riverline should never stand out linguistically):
  - **Russian:** infinitive for actions («Сохранить», «Открыть»); conventional nouns for fixed labels («Отмена», «Настройки»).
  - **Hebrew:** masculine singular imperative for actions («שמור», «פתח», «נתח»), which localization guides describe as the Hebrew UI standard; conventional nouns where those are the norm («ביטול», «הגדרות», «חיפוש»).
- **Length budget:** short labels can grow 200–300% in translation; design buttons for the longest locale.
