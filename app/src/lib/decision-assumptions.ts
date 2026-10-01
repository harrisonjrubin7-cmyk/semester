import type { AssumptionAdapter } from './assumptions';
import { supportedFit, withAssumption, type Decision } from './productivity';

export function decisionOutcomes(decision: Decision): string[] {
  return decision.options.length ? decision.options.map(option => {
    const result = supportedFit(option, decision.criteria);
    return `${option.title}: supported fit ${result.fit === null ? 'Unknown — needs source review' : `${Math.round(result.fit * 100)}%`}; evidence coverage ${Math.round(result.coverage * 100)}%`;
  }) : ['Supported fit: Unknown — no options recorded'];
}
export function decisionAssumptions(decision: Decision, apply: (next: Decision) => boolean | void): AssumptionAdapter[] {
  return decision.assumptions.map(assumption => ({
    id: assumption.id, label: assumption.label || 'Unnamed assumption', value: assumption.value,
    owner: assumption.owner === 'institution' ? 'institution' : 'student',
    source: `${assumption.source || 'Source not recorded'} · Recorded owner: ${assumption.owner}`,
    maxLength: 2000, validate: value => value.length <= 2000,
    outcomes: value => decisionOutcomes(value === assumption.value || assumption.owner === 'institution' ? decision : withAssumption(decision, { ...assumption, value })),
    apply: value => assumption.owner === 'institution' ? false : apply(withAssumption(decision, { ...assumption, value })),
  }));
}
