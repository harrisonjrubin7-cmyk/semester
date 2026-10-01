import type { AssumptionAdapter } from './assumptions';
import { supportedFit, currentEvidence, withAssumption, type Assumption, type Decision } from './productivity';

export function decisionOutcomes(decision: Decision): string[] {
  return decision.options.length ? decision.options.map(option => {
    const result = supportedFit(option, decision.criteria);
    const checked = decision.criteria.filter(c => c.weight > 0).every(c => currentEvidence(option.fits[c.id]));
    return `${option.title}: source checks ${checked ? 'Current' : 'Need review'}; supported fit ${result.fit === null ? 'Unknown — needs source review' : `${Math.round(result.fit * 100)}%`}; evidence coverage ${Math.round(result.coverage * 100)}%`;
  }) : ['Supported fit: Unknown — no options recorded'];
}
export function decisionAssumptions(decision: Decision, apply: (assumption: Assumption) => boolean | void): AssumptionAdapter[] {
  return decision.assumptions.map(assumption => ({
    context: JSON.stringify(decision),
    id: assumption.id, label: assumption.label || 'Unnamed assumption', value: assumption.value,
    owner: assumption.owner === 'institution' ? 'institution' : 'student',
    source: `${assumption.source || 'Source not recorded'} · Recorded owner: ${assumption.owner}`,
    maxLength: 2000, validate: value => value.length <= 2000,
    outcomes: value => decisionOutcomes(assumption.owner === 'institution' ? decision : withAssumption(decision, { ...assumption, value })),
    apply: value => assumption.owner === 'institution' ? false : apply({ ...assumption, value }),
  }));
}
