import { numericAssumption, type AssumptionAdapter } from './assumptions';
import { billFor, blankPlan, type Held, type Plan } from './bill';
import { isoDay } from './device-library';
import { money } from './cost';

export function billAssumptions(held: Held, term: string, now: Date, apply: (patch: Partial<Plan>) => void): AssumptionAdapter[] {
  const plan = held.plans[term] ?? blankPlan();
  const outcomes = (patch: Partial<Plan>) => {
    const result = billFor({ ...held, plans: { ...held.plans, [term]: { ...plan, ...patch } } }, term, now);
    return result.instalments.length ? result.instalments.map(inst => `${inst.due}: ${money(inst.cents)}`) : ['Instalment schedule: Unknown — enter a due date and a positive recorded balance'];
  };
  return [
    numericAssumption({ id: 'parts', label: 'Planned instalments', value: plan.parts, min: 1, max: 12, step: 1, owner: 'student', source: 'Your personal payment schedule; confirm available plans with the bursar', outcomes: parts => outcomes({ parts: Math.round(parts) }), apply: parts => apply({ parts: Math.round(parts) }) }),
    { id: 'first', label: 'Planned first due date', value: plan.first, type: 'date', owner: 'student', source: 'Your recorded date; confirm the deadline on the official statement', validate: value => isoDay(value), outcomes: first => outcomes({ first }), apply: first => apply({ first }) },
  ];
}
