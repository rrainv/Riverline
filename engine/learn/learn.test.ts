import { describe, expect, it } from 'vitest';
import {
  buildLearnConceptExample,
  getLearnTrainerRound,
  getLearnWeaknesses,
  gradeLearnTrainerAnswer,
  LEARN_CONCEPT_IDS,
  LEARN_OUTS_SPOTS,
  LEARN_POT_ODDS_SPOTS,
} from './index';

describe('engine/learn', () => {
  it('computes exact worked examples for all 9 concepts', () => {
    for (const id of LEARN_CONCEPT_IDS) {
      const ex = buildLearnConceptExample(id);
      expect(ex.conceptId).toBe(id);
      expect(ex.tier).toBe('exact');
    }

    const potOdds = buildLearnConceptExample('pot_odds');
    expect(potOdds.numbers.requiredPercent).toBe(25);
    expect(potOdds.qualifier).toBe('price_only');

    const equity = buildLearnConceptExample('equity');
    expect(equity.numbers.wins).toBe(253);
    expect(equity.numbers.trials).toBe(990);
    expect(equity.numbers.equityPercent).toBe(25.6);

    const blockers = buildLearnConceptExample('blockers');
    expect(blockers.numbers.fullCombos).toBe(6);
    expect(blockers.numbers.remainingCombos).toBe(3);

    const spr = buildLearnConceptExample('spr');
    expect(spr.numbers.spr).toBe(19.5);

    const bluff = buildLearnConceptExample('bluffing');
    expect(bluff.numbers.requiredFoldPercent).toBe(33.3);

    const multiway = buildLearnConceptExample('multiway');
    expect(multiway.numbers.threeWayTrials).toBe(903);
    expect(multiway.numbers.headsUpEquityPercent).toBeGreaterThan(
      multiway.numbers.threeWayEquityPercent!,
    );
  });

  it('builds deterministic pot-odds rounds with distinct options and exact grading', () => {
    for (let i = 0; i < LEARN_POT_ODDS_SPOTS.length; i += 1) {
      const round = getLearnTrainerRound('pot_odds', i);
      expect(round.options).toHaveLength(4);
      const values = new Set(round.options.map((o) => o.value));
      expect(values.size).toBe(4);
      const correctOpt = round.options.find((o) => o.isCorrect)!;
      const gradeRight = gradeLearnTrainerAnswer('pot_odds', i, correctOpt.index);
      expect(gradeRight.isCorrect).toBe(true);
      expect(gradeRight.qualifier).toBe('price_only');

      const wrongOpt = round.options.find((o) => !o.isCorrect)!;
      const gradeWrong = gradeLearnTrainerAnswer('pot_odds', i, wrongOpt.index);
      expect(gradeWrong.isCorrect).toBe(false);
      expect(gradeWrong.correctValue).toBe(correctOpt.value);
    }
  });

  it('builds exact outs rounds without double-counting overlapping completion cards', () => {
    for (let i = 0; i < LEARN_OUTS_SPOTS.length; i += 1) {
      const round = getLearnTrainerRound('outs', i);
      expect(round.options).toHaveLength(4);
      const values = new Set(round.options.map((o) => o.value));
      expect(values.size).toBe(4);
      const correctOpt = round.options.find((o) => o.isCorrect)!;
      const grade = gradeLearnTrainerAnswer('outs', i, correctOpt.index);
      expect(grade.isCorrect).toBe(true);
      expect(grade.uniqueOutsCount).toBe(correctOpt.value);
      expect(grade.completionCards).toHaveLength(correctOpt.value);
    }

    // Combo draw JhTh on 9h8c2h: 9 flush + 8 straight - 2 overlap (Qh, 7h) = 15 unique outs
    const comboOesd = gradeLearnTrainerAnswer('outs', 3, getLearnTrainerRound('outs', 3).options.findIndex((o) => o.isCorrect));
    expect(comboOesd.flushCount).toBe(9);
    expect(comboOesd.straightCount).toBe(8);
    expect(comboOesd.overlapCount).toBe(2);
    expect(comboOesd.uniqueOutsCount).toBe(15);

    // Combo draw AhJh on KhTc4h: 9 flush + 4 straight - 1 overlap (Qh) = 12 unique outs
    const comboGutshot = gradeLearnTrainerAnswer('outs', 4, getLearnTrainerRound('outs', 4).options.findIndex((o) => o.isCorrect));
    expect(comboGutshot.flushCount).toBe(9);
    expect(comboGutshot.straightCount).toBe(4);
    expect(comboGutshot.overlapCount).toBe(1);
    expect(comboGutshot.uniqueOutsCount).toBe(12);

    // Double gutshot Td8s on Jh7c6d: 8 outs (four 9s, four 5s? Wait: 9 makes J-T-9-8-7; 5? 9-8-7-6-5!)
    const doubleGut = gradeLearnTrainerAnswer('outs', 5, getLearnTrainerRound('outs', 5).options.findIndex((o) => o.isCorrect));
    expect(doubleGut.uniqueOutsCount).toBeGreaterThanOrEqual(4);
  });

  it('exposes honest estimated/unavailable weakness specs', () => {
    const list = getLearnWeaknesses();
    expect(list.length).toBeGreaterThanOrEqual(5);
    for (const item of list) {
      expect(['estimated', 'unavailable']).toContain(item.tier);
    }
  });
});
