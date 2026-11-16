import type { LearnGlossaryEntry } from './types';

export const LEARN_GLOSSARY_ENTRIES: readonly LearnGlossaryEntry[] = [
  // Actions
  { id: 'fold', category: 'actions', en: 'Fold', ru: 'пас', he: 'פולד' },
  { id: 'check', category: 'actions', en: 'Check', ru: 'чек', he: "צ'ק" },
  { id: 'call', category: 'actions', en: 'Call', ru: 'колл', he: 'קול' },
  { id: 'bet', category: 'actions', en: 'Bet', ru: 'бет', he: 'בט' },
  { id: 'raise', category: 'actions', en: 'Raise', ru: 'рейз', he: 'רייז' },
  { id: 'three_bet', category: 'actions', en: '3-bet / 4-bet', ru: '3-бет / 4-бет', he: '3-בט / 4-בט' },
  { id: 'all_in', category: 'actions', en: 'All-in', ru: 'олл-ин', he: 'אול-אין' },
  { id: 'limp', category: 'actions', en: 'Limp', ru: 'лимп', he: 'לימפ' },
  { id: 'open_raise', category: 'actions', en: 'Open-raise', ru: 'опен-рейз', he: 'אופן-רייז' },
  { id: 'check_raise', category: 'actions', en: 'Check-raise', ru: 'чек-рейз', he: "צ'ק-רייז" },
  { id: 'squeeze', category: 'actions', en: 'Squeeze', ru: 'сквиз', he: 'סקוויז' },
  { id: 'donk_bet', category: 'actions', en: 'Donk bet', ru: 'донк', he: 'דונק' },
  { id: 'overbet', category: 'actions', en: 'Overbet', ru: 'овербет', he: 'אוברבט' },
  { id: 'c_bet', category: 'actions', en: 'C-bet', ru: 'си-бет', he: 'סי-בט' },

  // Table & streets
  { id: 'streets', category: 'table', en: 'Preflop / Flop / Turn / River', ru: 'префлоп / флоп / терн / ривер', he: 'פרה-פלופ / פלופ / טרן / ריבר' },
  { id: 'button_blinds', category: 'table', en: 'Button / blinds / ante', ru: 'баттон / блайнды / анте', he: 'באטן / בליינדים / אנטה' },
  { id: 'effective_stack', category: 'table', en: 'Effective stack', ru: 'эффективный стек', he: 'סטאק אפקטיבי' },
  { id: 'pot', category: 'table', en: 'Pot', ru: 'банк', he: 'קופה' },
  { id: 'range', category: 'table', en: 'Range', ru: 'диапазон', he: "ריינג'" },
  { id: 'showdown', category: 'table', en: 'Showdown', ru: 'шоудаун', he: 'שואודאון' },
  { id: 'board', category: 'table', en: 'Board', ru: 'борд', he: 'בורד' },
  { id: 'equity', category: 'table', en: 'Equity', ru: 'эквити', he: 'אקוויטי' },
  { id: 'ev', category: 'table', en: 'EV', ru: 'EV', he: 'EV', isLatinAbbr: true },
  { id: 'spr', category: 'table', en: 'SPR', ru: 'SPR', he: 'SPR', isLatinAbbr: true },
  { id: 'multiway', category: 'table', en: 'Multiway pot', ru: 'мультивей', he: 'קופה עם כמה יריבים' },

  // Strategy & math
  { id: 'pot_odds', category: 'strategy', en: 'Pot odds', ru: 'шансы банка', he: 'סיכויי קופה' },
  { id: 'required_equity', category: 'strategy', en: 'Required equity', ru: 'необходимое эквити', he: 'אקוויטי נדרש' },
  { id: 'mdf', category: 'strategy', en: 'MDF', ru: 'MDF', he: 'MDF', isLatinAbbr: true },
  { id: 'combos', category: 'strategy', en: 'Combos', ru: 'комбинации', he: 'קומבינציות' },
  { id: 'value', category: 'strategy', en: 'Value', ru: 'валью', he: 'ואליו' },
  { id: 'bluff', category: 'strategy', en: 'Bluff', ru: 'блеф', he: 'בלוף' },
  { id: 'semi_bluff', category: 'strategy', en: 'Semi-bluff', ru: 'полублеф', he: 'סמי-בלוף' },
  { id: 'outs', category: 'strategy', en: 'Outs', ru: 'ауты', he: 'אאוטים' },
  { id: 'blockers', category: 'strategy', en: 'Blockers', ru: 'блокеры', he: 'בלוקרים' },
  { id: 'nuts', category: 'strategy', en: 'Nuts', ru: 'натс', he: 'נאטס' },

  // Riverline product terms
  { id: 'hand_ws', category: 'product', en: 'Hand', ru: 'Раздача', he: 'יד' },
  { id: 'spot', category: 'product', en: 'Spot', ru: 'Спот', he: 'ספוט' },
  { id: 'personal_strategy', category: 'product', en: 'Personal Strategy', ru: 'Личная стратегия', he: 'אסטרטגיה אישית' },
  { id: 'game_container', category: 'product', en: 'Game', ru: 'Игра', he: 'משחק' },
  { id: 'approach', category: 'product', en: 'Approach', ru: 'Подход', he: 'גישה' },
  { id: 'table_rules', category: 'product', en: 'Table rules', ru: 'Правила стола', he: 'חוקי שולחן' },
  { id: 'baseline', category: 'product', en: 'Baseline', ru: 'Базовая стратегия', he: 'אסטרטגיית בסיס' },
  { id: 'game_night', category: 'product', en: 'Game night', ru: 'Покерный вечер', he: 'ערב פוקר' },
  { id: 'orbit', category: 'product', en: 'Orbit', ru: 'Круг', he: 'סבב' },
  { id: 'coverage', category: 'product', en: 'Coverage', ru: 'Охват', he: 'כיסוי' },
];
