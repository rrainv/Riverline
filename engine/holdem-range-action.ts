import {
  createHoldemWeightedRangeFromEntries,
  HOLDEM_RANGE_ENTRY_STATES,
  HOLDEM_RANGE_PROVENANCE_KINDS,
  type HoldemWeightedRange,
  type ProvenanceSourceInput,
  type RawHoldemRangeEntryInput,
  validateHoldemWeightedRange,
} from './holdem-range';

/**
 * Quantitative operation only. Application adapters must prove exact context,
 * action/size and source compatibility before invoking it. Unknown * zero stays
 * unknown because a missing operand is not quantitative evidence.
 */
export function multiplyHoldemRangeByActionFrequencies(
  priorRange: HoldemWeightedRange,
  frequencyRange: HoldemWeightedRange,
): HoldemWeightedRange {
  validateHoldemWeightedRange(priorRange);
  validateHoldemWeightedRange(frequencyRange);
  const provenanceSources: ProvenanceSourceInput[] = [
    ...priorRange.provenance.sources.map((source) => ({ ...source, id: `prior:${source.id}` })),
    ...frequencyRange.provenance.sources.map((source) => ({ ...source, id: `policy:${source.id}` })),
    ...priorRange.entries.map((prior, index): ProvenanceSourceInput => ({
      id: `multiply:${prior.comboId}`,
      kind: HOLDEM_RANGE_PROVENANCE_KINDS.DERIVED_FILTER,
      sourceId: JSON.stringify({
        prior: prior.provenanceId === null ? null : `prior:${prior.provenanceId}`,
        policy:
          frequencyRange.entries[index]!.provenanceId === null
            ? null
            : `policy:${frequencyRange.entries[index]!.provenanceId}`,
      }),
      operation: 'prior_weight_times_exact_action_frequency/v1',
    })),
  ];

  const entries: RawHoldemRangeEntryInput[] = priorRange.entries.map((prior, index) => {
    const frequency = frequencyRange.entries[index]!;
    if (
      prior.state === HOLDEM_RANGE_ENTRY_STATES.KNOWN &&
      frequency.state === HOLDEM_RANGE_ENTRY_STATES.KNOWN
    ) {
      return {
        comboId: prior.comboId,
        state: 'known',
        weight: prior.weight * frequency.weight,
        provenanceId: `multiply:${prior.comboId}`,
      };
    }
    return {
      comboId: prior.comboId,
      state: 'unknown',
      provenanceId: `multiply:${prior.comboId}`,
    };
  });

  return createHoldemWeightedRangeFromEntries({
    provenanceSources,
    entries,
  });
}
