// Shared list of app states, driven through the stand-in runtime (window.__comp).
const L = (st, t) => ({ st, t });
const S = [
  ['home_coach', { view: 'home' }, p => { p.home = 'coach'; }],
  ['home_seats', { view: 'home' }, p => { p.home = 'seats'; }],
  ['training_hub', { view: 'train' }, p => { p.home = 'coach'; }],
  ['drill_question', { view: 'drill', train: null, done: false }],
  ['drill_answered', { view: 'drill', train: 'raise', rsz: 8, done: true }],
  ['strategy_leak_map', { view: 'strat' }],
  ['plan_spot_map', { view: 'plan', pm: 'first|CO', pconf: null }],
  ['plan_builder', { view: 'calib', cp: 'UTG', cf: 'sk', cuts: { 'UTG|sk': 5, 'CO|pp': 9 }, crev: { 'UTG|sk': true, 'CO|pp': true } }],
  ['equity_flop', { view: 'equity', turn: null, eqp: [] }],
  ['equity_flush_card', { view: 'equity', turn: 'Th', eqp: [] }],
  ['equity_multiway', { view: 'equity', turn: '3h', eqp: ['Th9h', '7d7s'] }],
  ['equity_turn_card', { view: 'equity', turn: 'Js', eqp: [] }],
  ['review_hand', { view: 'review' }],
  ['share_card_image', { view: 'card', cfmt: 'image' }],
  ['share_card_text', { view: 'card', cfmt: 'text' }],
  ['saved_library', { view: 'saved', svsel: 3 }],
  ['recorder_raise', { view: 'record', ra: [{ t: 'fold' }, { t: 'fold' }], rp: 'raise', rk: 2, rtext: '', rflop: [], rfin: false }],
  ['recorder_typed_error', { view: 'record', ra: [], rp: null, rtext: 'f f r12 x c', rflop: [], rfin: false }],
  ['recorder_flop_grid', { view: 'record', ra: [{ t: 'fold' }, { t: 'fold' }, { t: 'raise', v: 12 }, { t: 'fold' }, { t: 'call' }, { t: 'fold' }], rp: null, rtext: '', rflop: ['Qh', '7c'], rfin: false }],
  ['recorder_done', { view: 'record', rflop: ['Qh', '7c', '2h'], rfin: true, rwhy: 'I had position' }],
  ['scan_where', { view: 'scan', swhere: null, sc: 0, sans: [] }],
  ['scan_question', { view: 'scan', swhere: 'Home game', sc: 2, sans: ['Always', 'Always'] }],
  ['scan_first_read', { view: 'scan', swhere: 'Home game', sc: 6, sans: ['Always', 'Always', 'Sometimes', 'Never', 'Never', 'Always'] }],
  ['duel_preflop', { view: 'duel', dstage: 'pre', dp: 'raise', dr: 0, dflop: false, dbusy: false, dthink: false, dpotS: 1.5, dEffS: 99.5, dlog: [], dres: null }],
  ['duel_thinking', { view: 'duel', dstage: 'pre', dp: null, dbusy: true, dthink: true, dpotS: 3.5, dlog: [L('Preflop', 'You raise to 2.5')] }],
  ['duel_flop_ladder', { view: 'duel', dstage: 'flop', dflop: true, dbusy: false, dthink: false, dpre: 2.5, dpotS: 5, dEffS: 97.5, dp: 'bet', db: 2, dedit: true, deq: true, dlog: [L('Preflop', 'You raise to 2.5'), L('Preflop', 'Astra calls'), L('Flop', 'Astra checks')] }],
  ['duel_result', { view: 'duel', dstage: 'res', dp: null, dedit: false, dshow: true, dread: true, dres: { text: 'Astra folds. You win 2.5 bb.', net: 2.5 }, dlog: [L('Preflop', 'You raise to 2.5'), L('Preflop', 'Astra calls'), L('Flop', 'Astra checks'), L('Flop', 'You bet 3.8'), L('Flop', 'Astra folds')] }],
  ['session_report', { view: 'report', rsel: 8 }],
  ['full_hand_hero_turn', { view: 'full', fstage: 'hero', fcom: { SB: 0.5, BB: 1, HJ: 3 }, ffold: { UTG: true }, fbub: { UTG: 'folds', HJ: 'raises to 3' }, fpot: 4.5, fboard: false, fp: '3bet', fr: 1, fthink: null, fhero: false, fread: false, flog: [{ seat: 'SB', txt: 'posts 0.5' }, { seat: 'BB', txt: 'posts 1' }, { seat: 'UTG', txt: 'folds' }, { seat: 'HJ', txt: 'raises to 3' }] }],
  ['full_hand_watch', { view: 'full', fstage: 'watch', fhero: true, fp: null, fbub: { UTG: 'folds', HJ: 'raises to 3', CO: 'folds' }, fread: true }],
  ['full_hand_bot_thinking', { view: 'full', fstage: 'run', fthink: 'BTN', fboard: false }],
  ['weekly_letter', { view: 'letter' }],
  ['learn_trainer', { view: 'learn', lsel: 'pot', li: 0, lans: 0, lrec: [false] }],
  ['learn_concept', { view: 'learn', lsel: 'blk', lq: 'bl' }],
  ['settings_appearance', { view: 'settings', sec: 'look' }],
  ['settings_motion', { view: 'settings', sec: 'motion' }],
  ['settings_teacher', { view: 'settings', sec: 'teacher' }],
  ['settings_language', { view: 'settings', sec: 'language' }],
  ['settings_shortcuts', { view: 'settings', sec: 'keys', kbSel: 'fold', kbNote: 'C is already check or call on this screen. Pick another key, or change that one first.' }],
  ['settings_data', { view: 'settings', sec: 'data', kbSel: null, delText: 'DELETE' }],
  ['search_palette', { view: 'home', pal: true }],
  ['collapsed_rail', { view: 'review', pal: false, rail: false }],
  ['focus_mode', { view: 'drill', rail: true, focus: true, train: null, done: false }],
];
async function walk(page, theme, cb, only) {
  for (const [label, st, pf] of S) {
    if (only && !only.includes(label)) continue;
    await page.evaluate(({ st, theme, pf }) => { const c = window.__comp; if (pf) (new Function('p', 'return (' + pf + ')(p)'))(c.props); c.setState(Object.assign({ focus: false, pal: false, rail: true }, st, { th: theme, acc: null })); }, { st, theme, pf: pf ? pf.toString() : null });
    await page.waitForTimeout(1050);
    await cb(label);
  }
}
module.exports = { S, walk };
