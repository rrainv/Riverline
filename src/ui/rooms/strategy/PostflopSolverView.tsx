import { useState } from 'preact/hooks';
import { classifyBoardTexture } from '../../../domain/equity/boardTexture';
import {
  getSharedSolverStore,
  type SolverBetMenuPresetId,
  type SolverMatrixFilterId,
} from '../../../domain/solver';
import {
  getPostflopRule,
  POSTFLOP_RULE_LINES,
  POSTFLOP_RULE_TEXTURES,
  postflopPlaybookSignal,
  resetPostflopPlaybook,
  updatePostflopRule,
  type PostflopRuleTextureId,
  type PostflopSizePreset,
  type StrategyStore,
} from '../../../domain/strategy';
import { lookupPreflopEqrSpot, PUSHFOLD_REFERENCE_TABLE, SOLVED_PILOT_SPOTS } from '../../../engine-api';
import { formatNumber, t } from '../../../i18n';
import { PokerNotation } from '../../../i18n/PokerNotation';
import { Button } from '../../kit/button/Button';
import { Chip } from '../../kit/chip/Chip';
import { ChipButton, SegmentedControl } from '../../kit/choice/Choice';
import { FactTile, FactTileRow } from '../../kit/fact-tile/FactTile';
import { HeatGrid, type HeatGridRow, type HeatTone } from '../../kit/heat-grid/HeatGrid';
import { TextField } from '../../kit/input/TextField';
import { Panel, PanelSection } from '../../kit/panel/Panel';
import { CardPicker } from '../../kit/playing-card/CardPicker';
import { PlayingCard } from '../../kit/playing-card/PlayingCard';
import { Stepper } from '../../kit/stepper/Stepper';
import { formatCardGlyph } from '../equity/equityFormatters';
import styles from './StrategyRoom.module.css';

export interface PostflopSolverViewProps {
  readonly store: StrategyStore;
  readonly onDrillTexture?: (texture: PostflopRuleTextureId) => void;
}

const SIZE_PRESETS: readonly PostflopSizePreset[] = ['33%', '50%', '75%', '125%'];
const RANKS_DESC = ['A', 'K', 'Q', 'J', 'T', '9', '8', '7', '6', '5', '4', '3', '2'] as const;

export function PostflopSolverView({ store, onDrillTexture }: PostflopSolverViewProps) {
  void store;
  const solver = getSharedSolverStore();
  const [subTab, setSubTab] = useState<'workbench' | 'playbook'>('workbench');
  const [selectedTexture, setSelectedTexture] = useState<PostflopRuleTextureId>('dry');
  const [selectedSpotId, setSelectedSpotId] = useState<string>(SOLVED_PILOT_SPOTS[0]?.spotId ?? '');
  const [boardPickerSlot, setBoardPickerSlot] = useState<number | null>(null);
  const [deadPickerOpen, setDeadPickerOpen] = useState(false);

  void postflopPlaybookSignal.value;

  const street = solver.streetSignal.value;
  const board = solver.boardSignal.value;
  const deadCards = solver.deadCardsSignal.value;
  const pendingConf = solver.pendingConfirmationSignal.value;
  const status = solver.statusSignal.value;
  const progress = solver.progressSignal.value;
  const evSummary = solver.evSummarySignal.value;
  const inspection = solver.activeInspectionSignal.value;
  const nodePath = solver.nodePathSignal.value;
  const selectedHandClass = solver.selectedHandClassSignal.value;
  const matrixFilter = solver.matrixFilterSignal.value;

  const activePilotSpot =
    SOLVED_PILOT_SPOTS.find((s) => s.spotId === selectedSpotId) ?? SOLVED_PILOT_SPOTS[0];

  // Build 13x13 HeatGrid rows from active SolvedNodeInspection
  const cellMap = new Map((inspection?.matrix169 ?? []).map((c) => [c.handClass, c]));
  const gridRows: HeatGridRow[] = inspection
    ? RANKS_DESC.map((r1, rIdx) => ({
        id: r1,
        label: r1,
        cells: RANKS_DESC.map((r2, cIdx) => {
          const hc =
            rIdx === cIdx ? `${r1}${r2}` : rIdx < cIdx ? `${r1}${r2}s` : `${r2}${r1}o`;
          const cell = cellMap.get(hc);
          if (!cell) {
            return {
              id: hc,
              label: hc,
              tone: 'neutral' as HeatTone,
              ariaLabel: `${hc}: not in range`,
            };
          }
          const betFreq = Object.entries(cell.actionFrequencies)
            .filter(([lbl]) => lbl.startsWith('Bet') || lbl.startsWith('Raise') || lbl.startsWith('All-in'))
            .reduce((s, [, f]) => s + f, 0);
          const checkCallFreq = Object.entries(cell.actionFrequencies)
            .filter(([lbl]) => lbl === 'Check' || lbl === 'Call')
            .reduce((s, [, f]) => s + f, 0);
          const foldFreq = cell.actionFrequencies['Fold'] ?? 0;

          const passesFilter =
            matrixFilter === 'all' ||
            (matrixFilter === 'bet_raise' && betFreq >= 0.25) ||
            (matrixFilter === 'check_call' && checkCallFreq >= 0.25) ||
            (matrixFilter === 'fold' && foldFreq >= 0.25) ||
            (matrixFilter === 'close_calls' && cell.isCloseCall);

          const tone: HeatTone = !passesFilter
            ? 'neutral'
            : cell.isCloseCall
              ? 'okLow'
              : betFreq >= 0.55
                ? 'overHigh'
                : checkCallFreq >= 0.55
                  ? 'okHigh'
                  : 'underLow';

          return {
            id: hc,
            label: hc,
            subLabel: `${Math.round((betFreq > 0 ? betFreq : checkCallFreq) * 100)}%${cell.isCloseCall ? ' ~' : ''}`,
            tone,
            ariaLabel: `${hc}: ${cell.dominantActionLabel}, EV ${cell.evBb} bb${cell.isCloseCall ? ' (close call)' : ''}`,
          };
        }),
      }))
    : [];

  const selectedCellCombos =
    inspection && selectedHandClass ? (inspection.combosByHandClass[selectedHandClass] ?? []) : [];
  const selectedCellSummary =
    inspection && selectedHandClass ? (cellMap.get(selectedHandClass) ?? null) : null;

  return (
    <div className={styles.colStack}>
      <div className={styles.rulesBar}>
        <SegmentedControl<'workbench' | 'playbook'>
          ariaLabel={t('strategy.side.postflopLab')}
          value={subTab}
          onChange={(v) => setSubTab(v)}
          options={[
            { value: 'workbench', label: t('strategy.solver.workbenchTab') },
            { value: 'playbook', label: t('strategy.solver.playbookTab') },
          ]}
        />
      </div>

      {subTab === 'workbench' ? (
        <div className={styles.splitGrid}>
          <div className={styles.colStack}>
            {pendingConf && (
              <Panel
                title={t('strategy.solver.confirmHeading', { room: pendingConf.sourceRoomLabel })}
                tier={{ tier: 'estimated', detail: t('strategy.solver.confirmTier') }}
              >
                <p className={styles.eyebrow}>{pendingConf.summaryLine}</p>
                <div className={styles.rulesControls}>
                  <Button variant="primary" onClick={() => void solver.confirmAndSolve()}>
                    {t('strategy.solver.confirmSolveBtn')}
                  </Button>
                  <Button variant="secondary" onClick={() => solver.dismissConfirmation()}>
                    {t('strategy.solver.editFirstBtn')}
                  </Button>
                </div>
              </Panel>
            )}

            <Panel
              title={t('strategy.solver.workbenchHeading')}
              tier={{
                tier: 'estimated',
                detail:
                  evSummary?.exploitabilityPctPot !== null && evSummary?.exploitabilityPctPot !== undefined
                    ? t('strategy.solver.tierDetail', {
                        pct: formatNumber(evSummary.exploitabilityPctPot, { maximumFractionDigits: 2 }),
                      })
                    : t('strategy.solver.idleTier'),
              }}
            >
              <p className={styles.eyebrow}>{t('strategy.solver.beginnerGuide')}</p>
              <PanelSection label={t('strategy.solver.templatesLabel')}>
                <div className={styles.chipGroup}>
                  <ChipButton
                    selected={false}
                    onToggle={() => {
                      solver.streetSignal.value = 'river';
                      solver.boardSignal.value = ['Ks', 'Qd', '7c', '2h', '4s'];
                      solver.oopRangeTextSignal.value = 'QQ, JJ, TT, AQo, KJs';
                      solver.ipRangeTextSignal.value = 'KK, AA, AKs, QJs, 98s';
                      solver.potBbSignal.value = 18;
                      solver.effectiveStackBbSignal.value = 40;
                    }}
                  >
                    {t('strategy.solver.tplBtnCbet')}
                  </ChipButton>
                  <ChipButton
                    selected={false}
                    onToggle={() => {
                      solver.streetSignal.value = 'river';
                      solver.boardSignal.value = ['As', 'Kc', '8d', '3h', '6s'];
                      solver.oopRangeTextSignal.value = 'AA, KK, AKs, AQs, KQs, QJs';
                      solver.ipRangeTextSignal.value = 'QQ, JJ, TT, AQs, AJs, KJs, T9s';
                      solver.potBbSignal.value = 24;
                      solver.effectiveStackBbSignal.value = 76;
                    }}
                  >
                    {t('strategy.solver.tpl3betIp')}
                  </ChipButton>
                  <ChipButton
                    selected={false}
                    onToggle={() => {
                      solver.streetSignal.value = 'turn';
                      solver.boardSignal.value = ['Js', '9s', '5d', '2c'];
                      solver.oopRangeTextSignal.value = 'QQ, JJ, 99, AJs, KJs, QTs, AsKs, 87s';
                      solver.ipRangeTextSignal.value = 'AA, KK, TT, AJs, KQs, AsQs, Ts9s';
                      solver.potBbSignal.value = 16;
                      solver.effectiveStackBbSignal.value = 42;
                    }}
                  >
                    {t('strategy.solver.tplTurnBarrel')}
                  </ChipButton>
                  <ChipButton
                    selected={false}
                    onToggle={() => {
                      solver.streetSignal.value = 'river';
                      solver.boardSignal.value = ['Qc', '8h', '4d', '4s', '2c'];
                      solver.oopRangeTextSignal.value = 'AQo, KQo, JJ, TT, 99';
                      solver.ipRangeTextSignal.value = 'QQ, 88, AQs, KQs, JTs, 76s, 65s';
                      solver.potBbSignal.value = 20;
                      solver.effectiveStackBbSignal.value = 30;
                    }}
                  >
                    {t('strategy.solver.tplBluffCatch')}
                  </ChipButton>
                </div>
              </PanelSection>
              <div className={styles.rulesControls}>
                <SegmentedControl<'river' | 'turn'>
                  ariaLabel={t('strategy.solver.streetAria')}
                  value={street}
                  onChange={(s) => {
                    solver.streetSignal.value = s;
                    if (s === 'turn' && board.length > 4) {
                      solver.boardSignal.value = board.slice(0, 4);
                    }
                  }}
                  options={[
                    { value: 'river', label: t('recorder.street.river') },
                    { value: 'turn', label: t('recorder.street.turn') },
                  ]}
                />
                <SegmentedControl<SolverBetMenuPresetId>
                  ariaLabel={t('strategy.solver.menuAria')}
                  value={solver.betMenuPresetSignal.value}
                  onChange={(m) => {
                    solver.betMenuPresetSignal.value = m;
                  }}
                  options={[
                    { value: 'lean', label: t('strategy.solver.menu.lean') },
                    { value: 'standard', label: t('strategy.solver.menu.standard') },
                    { value: 'rich', label: t('strategy.solver.menu.rich') },
                  ]}
                />
                {street === 'turn' && (
                  <SegmentedControl<'fast' | 'exact'>
                    ariaLabel={t('strategy.solver.turnAccuracyAria')}
                    value={solver.turnAccuracySignal.value}
                    onChange={(acc) => {
                      solver.turnAccuracySignal.value = acc;
                    }}
                    options={[
                      { value: 'fast', label: t('strategy.solver.turnAccuracyFast') },
                      { value: 'exact', label: t('strategy.solver.turnAccuracyExact') },
                    ]}
                  />
                )}
                <Chip>
                  {t(
                    solver.poolStyleSignal.value === 'loose_calling'
                      ? 'settings.game.pool.looseCalling'
                      : solver.poolStyleSignal.value === 'tight_passive'
                        ? 'settings.game.pool.tightPassive'
                        : 'settings.game.pool.standard',
                  )}
                </Chip>
              </div>

              <PanelSection label={t('strategy.solver.boardAndDeadHeading')}>
                <div className={styles.solverBoardRow}>
                  <div className={styles.solverFeltStrip}>
                    {Array.from({ length: street === 'turn' ? 4 : 5 }).map((_, idx) => {
                      const card = board[idx];
                      return (
                        <button
                          key={`board-slot-${idx}`}
                          type="button"
                          className={styles.solverCardSlotBtn}
                          aria-label={t('equity.board.slotTitle', { slot: idx + 1 })}
                          onClick={() => setBoardPickerSlot(idx)}
                        >
                          {card ? (
                            <PlayingCard card={card} size="small" />
                          ) : (
                            <span className={styles.solverEmptySlot}>+</span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                  <div className={styles.solverDeadRow}>
                    {deadCards.map((dc) => (
                      <button
                        key={`dead-${dc}`}
                        type="button"
                        className={styles.solverDeadCardBtn}
                        aria-label={`Remove ${dc}`}
                        onClick={() => solver.removeDeadCard(dc)}
                      >
                        <PlayingCard card={dc} size="mini" />
                      </button>
                    ))}
                    <Button variant="secondary" onClick={() => setDeadPickerOpen(true)}>
                      {t('strategy.solver.addDeadCardBtn')}
                    </Button>
                  </div>
                </div>
              </PanelSection>

              <div className={styles.colStack}>
                <TextField
                  ariaLabel={t('strategy.solver.oopRangeLabel')}
                  value={solver.oopRangeTextSignal.value}
                  placeholder="QQ, JJ, TT, AQo, KJs"
                  ltrInput
                  onValueChange={(v) => {
                    solver.oopRangeTextSignal.value = v;
                  }}
                />
                <TextField
                  ariaLabel={t('strategy.solver.ipRangeLabel')}
                  value={solver.ipRangeTextSignal.value}
                  placeholder="KK, AA, AKs, QJs, 98s"
                  ltrInput
                  onValueChange={(v) => {
                    solver.ipRangeTextSignal.value = v;
                  }}
                />
                {(() => {
                  const hit = solver.getRangeHitComparison();
                  if (!hit) return null;
                  return (
                    <div className={styles.chipGroup}>
                      <Chip>
                        <PokerNotation>
                          {`OOP: 2P+ ${hit.oop.twoPairPlusPct}% · 1P ${hit.oop.onePairPct}%`}
                        </PokerNotation>
                      </Chip>
                      <Chip>
                        <PokerNotation>
                          {`IP: 2P+ ${hit.ip.twoPairPlusPct}% · 1P ${hit.ip.onePairPct}%`}
                        </PokerNotation>
                      </Chip>
                    </div>
                  );
                })()}
              </div>

              <div className={styles.rulesControls}>
                <Stepper
                  label={t('strategy.solver.potLabel')}
                  ariaLabel={t('strategy.solver.potLabel')}
                  value={solver.potBbSignal.value}
                  onChange={(v) => {
                    solver.potBbSignal.value = v;
                  }}
                  min={1}
                  max={500}
                  step={0.5}
                  unit="bb"
                />
                <Stepper
                  label={t('strategy.solver.stackLabel')}
                  ariaLabel={t('strategy.solver.stackLabel')}
                  value={solver.effectiveStackBbSignal.value}
                  onChange={(v) => {
                    solver.effectiveStackBbSignal.value = v;
                  }}
                  min={1}
                  max={500}
                  step={0.5}
                  unit="bb"
                />
                <Stepper
                  label={t('strategy.solver.rakePctLabel')}
                  ariaLabel={t('strategy.solver.rakePctLabel')}
                  value={solver.rakePctSignal.value}
                  onChange={(v) => {
                    solver.rakePctSignal.value = v;
                  }}
                  min={0}
                  max={15}
                  step={0.5}
                  unit="%"
                />
                <Stepper
                  label={t('strategy.solver.rakeCapLabel')}
                  ariaLabel={t('strategy.solver.rakeCapLabel')}
                  value={solver.rakeCapBbSignal.value}
                  onChange={(v) => {
                    solver.rakeCapBbSignal.value = v;
                  }}
                  min={0}
                  max={20}
                  step={0.5}
                  unit="bb"
                />
                <Button variant="secondary" onClick={() => solver.syncFromGameSettings()}>
                  {t('strategy.solver.syncGameSettingsBtn')}
                </Button>
                {status === 'running' ? (
                  <Button variant="secondary" onClick={() => solver.cancelSolve()}>
                    {t('strategy.solver.cancelBtn')}
                  </Button>
                ) : (
                  <Button variant="primary" onClick={() => void solver.confirmAndSolve()}>
                    {t('strategy.solver.solveBtn')}
                  </Button>
                )}
                {onDrillTexture && board.length >= 3 && (
                  <Button
                    variant="secondary"
                    onClick={() => {
                      const tags = classifyBoardTexture(board.slice(0, 3));
                      const tex = tags.includes('monotone')
                        ? 'monotone'
                        : tags.includes('paired')
                          ? 'paired'
                          : tags.includes('connected')
                            ? 'wet'
                            : 'dry';
                      onDrillTexture(tex);
                    }}
                  >
                    {t('training.drill.drill10Btn')}
                  </Button>
                )}
              </div>

              {progress && (
                <p className={styles.eyebrow}>
                  <PokerNotation>
                    {`${status === 'running' ? 'Running' : status} · iter ${progress.iteration}/${progress.maxIterations} · ${progress.elapsedMs}ms${
                      progress.exploitabilityPctPot !== null
                        ? ` · ${formatNumber(progress.exploitabilityPctPot, { maximumFractionDigits: 2 })}% pot`
                        : ''
                    }`}
                  </PokerNotation>
                </p>
              )}

              {solver.errorMessageSignal.value && (
                <p className={styles.eyebrow}>{solver.errorMessageSignal.value}</p>
              )}

              {evSummary && (
                <FactTileRow>
                  <FactTile label={t('strategy.solver.oopEvLabel')} value={evSummary.oopEvBb} decimals={2} unit="bb" instant />
                  <FactTile label={t('strategy.solver.ipEvLabel')} value={evSummary.ipEvBb} decimals={2} unit="bb" instant />
                  {evSummary.riverCardsEvaluated ? (
                    <FactTile label={t('strategy.solver.riversEvaluatedLabel')} value={evSummary.riverCardsEvaluated} instant />
                  ) : null}
                </FactTileRow>
              )}
            </Panel>
          </div>

          <div className={styles.colStack}>
            {inspection ? (
              <Panel
                title={t('strategy.solver.explorerHeading')}
                tier={{
                  tier: 'estimated',
                  detail: evSummary?.abstractionLabel ?? 'River · DCFR',
                }}
              >
                <div className={styles.chipGroup}>
                  {nodePath.map((step, idx) => (
                    <ChipButton
                      key={`path-${step.nodeId}-${idx}`}
                      selected={idx === nodePath.length - 1}
                      onToggle={() => void solver.navigateToBreadcrumb(idx)}
                    >
                      <PokerNotation>{step.label}</PokerNotation>
                    </ChipButton>
                  ))}
                </div>

                <PanelSection label={t('strategy.solver.actionsHeading')}>
                  <div className={styles.chipGroup}>
                    {inspection.actions.map((act) => (
                      <Button
                        key={`act-${act.actionIndex}`}
                        variant="secondary"
                        disabled={act.isTerminal}
                        onClick={() => void solver.navigateToChild(act.actionIndex)}
                      >
                        <PokerNotation>
                          {`${act.label}: ${formatNumber(Math.round(act.frequency * 100))}%`}
                        </PokerNotation>
                      </Button>
                    ))}
                  </div>
                </PanelSection>

                <PanelSection label={t('strategy.solver.matrixHeading')}>
                  <div className={styles.chipGroup}>
                    {(
                      [
                        ['all', 'strategy.solver.filter.all'],
                        ['bet_raise', 'strategy.solver.filter.betRaise'],
                        ['check_call', 'strategy.solver.filter.checkCall'],
                        ['fold', 'strategy.solver.filter.fold'],
                        ['close_calls', 'strategy.solver.filter.closeCalls'],
                      ] as const
                    ).map(([fid, key]) => (
                      <ChipButton
                        key={fid}
                        selected={matrixFilter === fid}
                        onToggle={() => {
                          solver.matrixFilterSignal.value = fid as SolverMatrixFilterId;
                        }}
                      >
                        {t(key)}
                      </ChipButton>
                    ))}
                  </div>

                  <div dir="ltr">
                    <HeatGrid
                      variant="matrix13"
                      ariaLabel={t('strategy.solver.matrixHeading')}
                      rows={gridRows}
                      activeId={selectedHandClass}
                      onActivateCell={(cell) => {
                        solver.selectedHandClassSignal.value = cell.id;
                      }}
                    />
                  </div>
                </PanelSection>

                {selectedCellSummary && (
                  <PanelSection label={t('strategy.solver.comboInspectorHeading', { hand: selectedCellSummary.handClass })}>
                    <div className={styles.chipGroup}>
                      <Chip>
                        <PokerNotation>{`EV ${selectedCellSummary.evBb} bb`}</PokerNotation>
                      </Chip>
                      {selectedCellSummary.isCloseCall && (
                        <Chip>{t('strategy.solver.closeCallBadge')}</Chip>
                      )}
                    </div>
                    <div className={styles.colStack}>
                      {selectedCellCombos.map((c) => (
                        <div key={c.comboId} className={styles.rulesBar}>
                          <PokerNotation>
                            {`${c.cards.map(formatCardGlyph).join('')} · EV ${c.evBb}bb${c.isCloseCall ? ' (~)' : ''}`}
                          </PokerNotation>
                          <PokerNotation>
                            {Object.entries(c.actionFrequencies)
                              .filter(([, f]) => f > 0.01)
                              .map(([lbl, f]) => `${lbl} ${Math.round(f * 100)}%`)
                              .join(' · ')}
                          </PokerNotation>
                        </div>
                      ))}
                    </div>
                  </PanelSection>
                )}

                {evSummary?.riverRunouts && evSummary.riverRunouts.length > 0 && (
                  <PanelSection label={t('strategy.solver.runoutImpactHeading')}>
                    <div className={styles.colStack}>
                      {evSummary.riverRunouts.slice(0, 6).map((r) => (
                        <div key={`runout-${r.riverCard}`} className={styles.rulesBar}>
                          <PokerNotation>
                            {`${formatCardGlyph(r.riverCard)} · OOP ${r.oopEvBb} bb (${r.oopDeltaBb >= 0 ? '+' : ''}${r.oopDeltaBb} bb)`}
                          </PokerNotation>
                          <Button
                            variant="secondary"
                            onClick={() => solver.openRiverRunout(r.riverCard)}
                          >
                            {t('strategy.solver.openRiverBtn')}
                          </Button>
                        </div>
                      ))}
                    </div>
                  </PanelSection>
                )}
              </Panel>
            ) : evSummary?.turnRootActions ? (
              <Panel
                title={t('strategy.solver.explorerHeading')}
                tier={{ tier: 'estimated', detail: evSummary.abstractionLabel }}
              >
                <PanelSection label={t('strategy.solver.oopRootHeading')}>
                  <div className={styles.chipGroup}>
                    {evSummary.turnRootActions.map((act) => (
                      <Chip key={`turn-${act.actionLabel}`}>
                        <PokerNotation>
                          {`${act.actionLabel}: ${formatNumber(Math.round(act.frequency * 100))}%`}
                        </PokerNotation>
                      </Chip>
                    ))}
                  </div>
                </PanelSection>
              </Panel>
            ) : (
              activePilotSpot && (
                <Panel
                  title={t('strategy.solver.heading')}
                  tier={{
                    tier: 'estimated',
                    detail: t('strategy.solver.tierDetail', {
                      pct: formatNumber(activePilotSpot.exploitabilityPctPot, { maximumFractionDigits: 2 }),
                    }),
                  }}
                >
                  <div className={styles.chipGroup}>
                    {SOLVED_PILOT_SPOTS.map((spot) => (
                      <ChipButton
                        key={spot.spotId}
                        selected={spot.spotId === activePilotSpot.spotId}
                        onToggle={() => setSelectedSpotId(spot.spotId)}
                      >
                        <PokerNotation>{spot.board.map(formatCardGlyph).join(' ')}</PokerNotation>
                      </ChipButton>
                    ))}
                  </div>
                  <p className={styles.eyebrow}>{activePilotSpot.abstractionLabel}</p>
                  <FactTileRow>
                    <FactTile label={t('strategy.solver.potLabel')} value={activePilotSpot.potBb} unit="bb" instant />
                    <FactTile label={t('strategy.solver.oopEvLabel')} value={activePilotSpot.oopEvBb} decimals={2} unit="bb" instant />
                    <FactTile label={t('strategy.solver.ipEvLabel')} value={activePilotSpot.ipEvBb} decimals={2} unit="bb" instant />
                  </FactTileRow>
                  {(() => {
                    const eqr = lookupPreflopEqrSpot(solver.rakePctSignal.value);
                    return (
                      <PanelSection label={t('strategy.solver.eqrHeading')}>
                        <p className={styles.eyebrow}>{eqr.label}</p>
                        <div className={styles.chipGroup}>
                          <Chip>
                            <PokerNotation>
                              {`BTN Open ${eqr.ipOpenPct}% · BB Call ${eqr.oopCallPct}% · BB 3B ${eqr.oopThreeBetPct}%`}
                            </PokerNotation>
                          </Chip>
                        </div>
                      </PanelSection>
                    );
                  })()}
                </Panel>
              )
            )}
          </div>
        </div>
      ) : (
        <div className={styles.splitGrid}>
          <div className={styles.colStack}>
            <Panel
              title={t('strategy.postflop.heading')}
              tier={{ tier: 'estimated', detail: t('strategy.postflop.tierDetail') }}
            >
              <div className={styles.rulesControls}>
                <SegmentedControl<PostflopRuleTextureId>
                  ariaLabel={t('strategy.postflop.textureAria')}
                  value={selectedTexture}
                  onChange={(val) => setSelectedTexture(val)}
                  options={POSTFLOP_RULE_TEXTURES.map((tex) => ({
                    value: tex,
                    label: t(`training.drill.texture.${tex}` as 'training.drill.texture.dry'),
                  }))}
                />
                {onDrillTexture && (
                  <Button variant="secondary" onClick={() => onDrillTexture(selectedTexture)}>
                    {t('strategy.postflop.drillTextureBtn')}
                  </Button>
                )}
                <Button variant="secondary" onClick={() => resetPostflopPlaybook()}>
                  {t('strategy.postflop.resetBtn')}
                </Button>
              </div>

              <div className={styles.colStack}>
                {POSTFLOP_RULE_LINES.map((lineId) => {
                  const rule = getPostflopRule(selectedTexture, lineId);
                  return (
                    <PanelSection
                      key={`${selectedTexture}-${lineId}`}
                      label={t(`strategy.postflop.line.${lineId}` as 'strategy.postflop.line.flop_cbet_ip')}
                    >
                      <div className={styles.rulesControls}>
                        <Stepper
                          label={t('strategy.postflop.targetFreqLabel')}
                          ariaLabel={t('strategy.postflop.targetFreqLabel')}
                          value={rule.targetFreqPct}
                          onChange={(pct) => updatePostflopRule(selectedTexture, lineId, { targetFreqPct: pct })}
                          min={0}
                          max={100}
                          step={5}
                          unit="%"
                        />
                        <div className={styles.chipGroup}>
                          {SIZE_PRESETS.map((sz) => (
                            <ChipButton
                              key={sz}
                              selected={rule.sizeLabel === sz}
                              onToggle={() => updatePostflopRule(selectedTexture, lineId, { sizeLabel: sz })}
                            >
                              <PokerNotation>{sz}</PokerNotation>
                            </ChipButton>
                          ))}
                        </div>
                      </div>
                      <TextField
                        ariaLabel={t('strategy.postflop.noteLabel')}
                        value={rule.note}
                        placeholder={t('strategy.postflop.notePlaceholder')}
                        onValueChange={(nextNote: string) =>
                          updatePostflopRule(selectedTexture, lineId, { note: nextNote })
                        }
                      />
                    </PanelSection>
                  );
                })}
              </div>
            </Panel>
          </div>

          <div className={styles.colStack}>
            <Panel
              title={t('strategy.pushfold.heading')}
              tier={{ tier: 'estimated', detail: t('strategy.pushfold.tierDetail') }}
            >
              <div className={styles.chipGroup}>
                {PUSHFOLD_REFERENCE_TABLE.map((row) => (
                  <Chip key={`pf-${row.stackBb}`}>
                    <PokerNotation>
                      {`${row.stackBb}bb · SB ${row.sbJamPct}% / BB ${row.bbCallPct}%`}
                    </PokerNotation>
                  </Chip>
                ))}
              </div>
            </Panel>
          </div>
        </div>
      )}

      <CardPicker
        open={boardPickerSlot !== null}
        onClose={() => setBoardPickerSlot(null)}
        title={t('equity.board.slotTitle', { slot: (boardPickerSlot ?? 0) + 1 })}
        deadCards={new Set([...board, ...deadCards])}
        selectedCard={boardPickerSlot !== null ? (board[boardPickerSlot] ?? null) : null}
        clearLabel={t('equity.board.clearCard')}
        closeLabel={t('equity.board.closePicker')}
        onSelectCard={(card: string | null) => {
          if (boardPickerSlot !== null) {
            solver.setBoardCard(boardPickerSlot, card);
          }
          setBoardPickerSlot(null);
        }}
      />

      <CardPicker
        open={deadPickerOpen}
        onClose={() => setDeadPickerOpen(false)}
        title={t('strategy.solver.addDeadCardBtn')}
        deadCards={new Set([...board, ...deadCards])}
        selectedCard={null}
        clearLabel={t('equity.board.clearCard')}
        closeLabel={t('equity.board.closePicker')}
        onSelectCard={(card: string | null) => {
          if (card) solver.addDeadCard(card);
          setDeadPickerOpen(false);
        }}
      />
    </div>
  );
}
