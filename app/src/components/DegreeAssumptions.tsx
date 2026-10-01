import { useStore } from '../state/store';
import { numericAssumption, type AssumptionAdapter } from '../lib/assumptions';
import { progress, progressLine, readAccepts, type Requirement } from '../lib/degree';
import { AssumptionEditor } from './AssumptionEditor';

export function DegreeAssumptions() {
  const { state, account, dispatch } = useStore();
  const assumptions = state.requirements.flatMap(r => {
    const source = `Your recorded audit requirement: ${r.programme}${r.note ? `; ${r.note}` : ''}`;
    const outcomes = (next: Requirement) => [progressLine(progress(next, state.taken)), 'Official eligibility: Unknown — confirm with the registrar'];
    const apply = (patch: Partial<Requirement>) => dispatch({ type: 'patchRequirement', id: r.id, patch });
    return [numericAssumption({ id: `${r.id}:count`, label: `${r.name} required ${r.need}`, value: r.count, min: 0, max: 400, owner: 'student', source, outcomes: count => outcomes({ ...r, count }), apply: count => apply({ count }) }), {
      id: `${r.id}:accepts`, label: `${r.name} accepted course codes`, value: r.accepts.join(', '), owner: 'student', source,
      maxLength: 4000, validate: value => value.length <= 4000, outcomes: value => outcomes({ ...r, accepts: readAccepts(value) }), apply: value => apply({ accepts: readAccepts(value) }),
    } satisfies AssumptionAdapter];
  });
  return <AssumptionEditor key={`${account?.id || 'device'}:${state.term}`} title="Review degree assumptions" assumptions={assumptions} />;
}
