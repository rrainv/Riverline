import { beforeEach, describe, expect, it } from 'vitest';
import {
  clearPostflopPlaybook,
  exportPostflopPlaybook,
  getPostflopRule,
  importPostflopPlaybook,
  updatePostflopRule,
} from './postflopPlaybook';

describe('Postflop Playbook (#3)', () => {
  beforeEach(() => {
    clearPostflopPlaybook();
  });

  it('persists, exports, imports, and clears texture playbook rules', () => {
    updatePostflopRule('dry', 'flop_cbet_ip', { targetFreqPct: 85, sizeLabel: '50%', note: 'Range bet dry' });
    expect(getPostflopRule('dry', 'flop_cbet_ip').targetFreqPct).toBe(85);

    const exported = exportPostflopPlaybook();
    clearPostflopPlaybook();
    expect(getPostflopRule('dry', 'flop_cbet_ip').targetFreqPct).toBe(70);

    importPostflopPlaybook(exported);
    expect(getPostflopRule('dry', 'flop_cbet_ip').targetFreqPct).toBe(85);
    expect(getPostflopRule('dry', 'flop_cbet_ip').sizeLabel).toBe('50%');
    expect(getPostflopRule('dry', 'flop_cbet_ip').note).toBe('Range bet dry');
  });
});
