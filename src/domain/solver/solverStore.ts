import { signal } from '@preact/signals';
import {
  getSharedEngineClient,
  getSharedSolverClient,
  HOLDEM_COMBOS,
  HOLDEM_DECK,
  type PreflopPoolStyle,
  type RiverBetMenu,
  type SolvedNodeInspection,
  type SolvedRootActionSummary,
  type SolverClient,
} from '../../engine-api';
import { parsePlayerHandInput } from '../shorthand';

export type SolverBetMenuPresetId = 'lean' | 'standard' | 'rich';
export type SolverMatrixFilterId = 'all' | 'bet_raise' | 'check_call' | 'fold' | 'close_calls';

export interface ExternalSolverSpotInput {
  readonly sourceRoomLabel: string;
  readonly board: readonly string[];
  readonly deadCards?: readonly string[];
  readonly oopRangeText: string;
  readonly ipRangeText: string;
  readonly potBb: number;
  readonly effectiveStackBb: number;
  readonly summaryLine: string;
}

export interface SolverPendingConfirmation {
  readonly sourceRoomLabel: string;
  readonly summaryLine: string;
}

export interface SolverProgressReadout {
  readonly iteration: number;
  readonly maxIterations: number;
  readonly elapsedMs: number;
  readonly exploitabilityPctPot: number | null;
}

export interface SolverEvSummary {
  readonly oopEvBb: number;
  readonly ipEvBb: number;
  readonly exploitabilityPctPot: number | null;
  readonly abstractionLabel: string;
  readonly riverCardsEvaluated?: number;
  readonly turnRootActions?: readonly SolvedRootActionSummary[];
}

export interface SolverNodePathStep {
  readonly nodeId: number;
  readonly label: string;
}

const BET_MENUS: Readonly<Record<SolverBetMenuPresetId, { readonly menu: RiverBetMenu; readonly label: string }>> = {
  lean: {
    menu: { betPcts: [0.5, 1.0], raisePcts: [0.75], raiseCap: 1, includeAllIn: true },
    label: '50% / 100% / All-in · Cap 1',
  },
  standard: {
    menu: { betPcts: [0.33, 0.75, 1.25], raisePcts: [0.75], raiseCap: 2, includeAllIn: true },
    label: '33% / 75% / 125% · Cap 2',
  },
  rich: {
    menu: { betPcts: [0.33, 0.5, 0.75, 1.0, 1.5], raisePcts: [0.5, 1.0], raiseCap: 2, includeAllIn: true },
    label: '33% / 50% / 75% / 100% / 150% · Cap 2',
  },
};

function parseRangeToComboWeights(rawInput: string, blockedCards: ReadonlySet<string>): Record<string, number> {
  const parsed = parsePlayerHandInput(rawInput, {
    engine: getSharedEngineClient(),
    deadCards: [...blockedCards],
  });
  if (!parsed.ok) return {};
  const out: Record<string, number> = {};
  if (parsed.kind === 'exact') {
    if (parsed.cards) {
      const sorted = [...parsed.cards].sort((a, b) => HOLDEM_DECK.indexOf(a) - HOLDEM_DECK.indexOf(b));
      out[`holdem-combo/v1:${sorted[0]}:${sorted[1]}`] = 1;
    }
    return out;
  }
  if (parsed.kind === 'any') {
    for (const c of HOLDEM_COMBOS) {
      if (blockedCards.has(c.cards[0]) || blockedCards.has(c.cards[1])) continue;
      out[c.id] = 1;
    }
    return out;
  }
  for (const entry of parsed.weightedRange.entries) {
    if ('weight' in entry && entry.weight > 0) out[entry.comboId] = entry.weight;
  }
  return out;
}

export function createSolverStore(client: SolverClient = getSharedSolverClient()) {
  const streetSignal = signal<'river' | 'turn'>('river');
  const boardSignal = signal<readonly string[]>(['Ks', 'Qd', '7c', '2h', '4s']);
  const deadCardsSignal = signal<readonly string[]>([]);
  const oopRangeTextSignal = signal<string>('QQ, JJ, TT, AQo, KJs');
  const ipRangeTextSignal = signal<string>('KK, AA, AKs, QJs, 98s');
  const potBbSignal = signal<number>(18);
  const effectiveStackBbSignal = signal<number>(40);
  const betMenuPresetSignal = signal<SolverBetMenuPresetId>('lean');
  const poolStyleSignal = signal<PreflopPoolStyle>('standard');

  const pendingConfirmationSignal = signal<SolverPendingConfirmation | null>(null);
  const statusSignal = signal<'idle' | 'running' | 'solved' | 'cancelled' | 'error'>('idle');
  const errorMessageSignal = signal<string | null>(null);
  const progressSignal = signal<SolverProgressReadout | null>(null);
  const evSummarySignal = signal<SolverEvSummary | null>(null);

  const nodePathSignal = signal<readonly SolverNodePathStep[]>([{ nodeId: 0, label: 'Root (OOP)' }]);
  const activeInspectionSignal = signal<SolvedNodeInspection | null>(null);
  const selectedHandClassSignal = signal<string | null>(null);
  const matrixFilterSignal = signal<SolverMatrixFilterId>('all');

  function setBoardCard(slotIndex: number, card: string | null) {
    const next = [...boardSignal.value];
    if (card === null) {
      next.splice(slotIndex, 1);
    } else {
      while (next.length <= slotIndex) next.push('2c');
      next[slotIndex] = card;
    }
    boardSignal.value = next.slice(0, streetSignal.value === 'turn' ? 4 : 5);
  }

  function addDeadCard(card: string) {
    if (boardSignal.value.includes(card) || deadCardsSignal.value.includes(card)) return;
    deadCardsSignal.value = [...deadCardsSignal.value, card];
  }

  function removeDeadCard(card: string) {
    deadCardsSignal.value = deadCardsSignal.value.filter((c) => c !== card);
  }

  function loadExternalSpot(input: ExternalSolverSpotInput) {
    const cleanBoard = input.board.slice(0, 5);
    streetSignal.value = cleanBoard.length === 4 ? 'turn' : 'river';
    boardSignal.value = cleanBoard;
    deadCardsSignal.value = (input.deadCards ?? []).filter((c) => !cleanBoard.includes(c));
    oopRangeTextSignal.value = input.oopRangeText;
    ipRangeTextSignal.value = input.ipRangeText;
    potBbSignal.value = Math.max(1, Math.round(input.potBb * 2) / 2);
    effectiveStackBbSignal.value = Math.max(1, Math.round(input.effectiveStackBb * 2) / 2);
    pendingConfirmationSignal.value = {
      sourceRoomLabel: input.sourceRoomLabel,
      summaryLine: input.summaryLine,
    };
    statusSignal.value = 'idle';
    errorMessageSignal.value = null;
  }

  function dismissConfirmation() {
    pendingConfirmationSignal.value = null;
  }

  async function confirmAndSolve() {
    pendingConfirmationSignal.value = null;
    const board = boardSignal.value;
    const dead = deadCardsSignal.value;
    const blocked = new Set([...board, ...dead]);
    const oopMap = parseRangeToComboWeights(oopRangeTextSignal.value, blocked);
    const ipMap = parseRangeToComboWeights(ipRangeTextSignal.value, blocked);

    if (Object.keys(oopMap).length === 0 || Object.keys(ipMap).length === 0) {
      statusSignal.value = 'error';
      errorMessageSignal.value = 'Enter valid non-empty OOP and IP ranges.';
      return;
    }

    const menuCfg = BET_MENUS[betMenuPresetSignal.value];
    statusSignal.value = 'running';
    errorMessageSignal.value = null;
    progressSignal.value = { iteration: 0, maxIterations: streetSignal.value === 'river' ? 280 : 60, elapsedMs: 0, exploitabilityPctPot: null };
    nodePathSignal.value = [{ nodeId: 0, label: 'Root (OOP)' }];
    selectedHandClassSignal.value = null;

    try {
      if (streetSignal.value === 'river') {
        if (board.length !== 5) {
          statusSignal.value = 'error';
          errorMessageSignal.value = 'River solve requires 5 board cards.';
          return;
        }
        const res = await client.startRiverSolve(
          {
            spotId: `custom-river-${Date.now()}`,
            board: [board[0]!, board[1]!, board[2]!, board[3]!, board[4]!],
            deadCards: dead,
            potBb: potBbSignal.value,
            effectiveStackBb: effectiveStackBbSignal.value,
            oopRangeByCombo: oopMap,
            ipRangeByCombo: ipMap,
            betMenu: menuCfg.menu,
          },
          {
            params: { iterations: 280 },
            targetExploitabilityPct: 0.3,
            onProgress(p) {
              progressSignal.value = {
                iteration: p.iteration,
                maxIterations: p.maxIterations,
                elapsedMs: p.elapsedMs,
                exploitabilityPctPot: p.exploitabilityPctPot,
              };
              if (p.rootInspection) activeInspectionSignal.value = p.rootInspection;
            },
          },
        );
        statusSignal.value = res.stopReason === 'cancelled' ? 'cancelled' : 'solved';
        progressSignal.value = {
          iteration: res.iteration,
          maxIterations: 280,
          elapsedMs: res.elapsedMs,
          exploitabilityPctPot: res.exploitabilityPctPot,
        };
        evSummarySignal.value = {
          oopEvBb: res.oopEvBb,
          ipEvBb: res.ipEvBb,
          exploitabilityPctPot: res.exploitabilityPctPot,
          abstractionLabel: `River · ${menuCfg.label}`,
        };
        if (res.rootInspection) {
          activeInspectionSignal.value = res.rootInspection;
          selectedHandClassSignal.value = res.rootInspection.matrix169[0]?.handClass ?? null;
        }
      } else {
        if (board.length !== 4) {
          statusSignal.value = 'error';
          errorMessageSignal.value = 'Turn solve requires 4 board cards.';
          return;
        }
        const res = await client.startTurnSolve(
          {
            spotId: `custom-turn-${Date.now()}`,
            turnBoard: [board[0]!, board[1]!, board[2]!, board[3]!],
            deadCards: dead,
            potBb: potBbSignal.value,
            effectiveStackBb: effectiveStackBbSignal.value,
            oopRangeByCombo: oopMap,
            ipRangeByCombo: ipMap,
            turnBetMenu: menuCfg.menu,
          },
          {
            params: { iterations: 60 },
            onProgress(p) {
              progressSignal.value = {
                iteration: p.iteration,
                maxIterations: p.maxIterations,
                elapsedMs: p.elapsedMs,
                exploitabilityPctPot: p.exploitabilityPctPot,
              };
            },
          },
        );
        statusSignal.value = res.stopReason === 'cancelled' ? 'cancelled' : 'solved';
        progressSignal.value = {
          iteration: res.iteration,
          maxIterations: 60,
          elapsedMs: res.elapsedMs,
          exploitabilityPctPot: null,
        };
        evSummarySignal.value = {
          oopEvBb: res.oopEvBb,
          ipEvBb: res.ipEvBb,
          exploitabilityPctPot: null,
          abstractionLabel: `Turn->River · ${menuCfg.label}`,
          riverCardsEvaluated: res.riverCardsEvaluated,
          turnRootActions: res.turnRootActions,
        };
        activeInspectionSignal.value = null;
      }
    } catch (err) {
      statusSignal.value = 'error';
      errorMessageSignal.value = err instanceof Error ? err.message : String(err);
    }
  }

  function cancelSolve() {
    client.cancel();
  }

  async function navigateToChild(actionIndex: number) {
    const cur = activeInspectionSignal.value;
    if (!cur) return;
    const act = cur.actions[actionIndex];
    if (!act || act.isTerminal) return;
    const next = await client.inspectNode(act.nextNodeId);
    if (!next) return;
    nodePathSignal.value = [...nodePathSignal.value, { nodeId: act.nextNodeId, label: act.label }];
    activeInspectionSignal.value = next;
    selectedHandClassSignal.value = next.matrix169[0]?.handClass ?? null;
  }

  async function navigateToBreadcrumb(pathIndex: number) {
    const target = nodePathSignal.value[pathIndex];
    if (!target) return;
    const next = await client.inspectNode(target.nodeId);
    if (!next) return;
    nodePathSignal.value = nodePathSignal.value.slice(0, pathIndex + 1);
    activeInspectionSignal.value = next;
    selectedHandClassSignal.value = next.matrix169[0]?.handClass ?? null;
  }

  return {
    streetSignal,
    boardSignal,
    deadCardsSignal,
    oopRangeTextSignal,
    ipRangeTextSignal,
    potBbSignal,
    effectiveStackBbSignal,
    betMenuPresetSignal,
    poolStyleSignal,
    pendingConfirmationSignal,
    statusSignal,
    errorMessageSignal,
    progressSignal,
    evSummarySignal,
    nodePathSignal,
    activeInspectionSignal,
    selectedHandClassSignal,
    matrixFilterSignal,
    setBoardCard,
    addDeadCard,
    removeDeadCard,
    loadExternalSpot,
    dismissConfirmation,
    confirmAndSolve,
    cancelSolve,
    navigateToChild,
    navigateToBreadcrumb,
  };
}

export type SolverStore = ReturnType<typeof createSolverStore>;

let sharedSolverStore: SolverStore | null = null;

export function getSharedSolverStore(): SolverStore {
  if (!sharedSolverStore) {
    sharedSolverStore = createSolverStore();
  }
  return sharedSolverStore;
}
