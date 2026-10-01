import { numericAssumption, type AssumptionAdapter } from './assumptions';
import { creditLine, creditPicture, type AbroadPlan, type AbroadProgram } from './abroad';

export function abroadAssumptions(plan: AbroadPlan, program: AbroadProgram, apply: (patch: Partial<AbroadProgram>) => boolean): AssumptionAdapter[] {
  const outcomes = (patch: Partial<AbroadProgram>) => [
    creditLine(creditPicture({ ...plan, programs: plan.programs.map(p => p.id === program.id ? { ...p, ...patch } : p) }, program.id)),
    'Aid, exchange rates, degree sequencing and official transfer decisions: Unknown',
  ];
  return [
    numericAssumption({ id: 'credits', label: 'Planned study abroad credits', value: program.credits, min: 0, max: 60, owner: 'student', source: program.url || 'Your study abroad plan', outcomes: credits => outcomes({ credits }), apply: credits => apply({ credits }) }),
    { id: 'cost', label: `Study abroad cost (${program.currency})`, value: program.cost === null ? '' : String(program.cost), type: 'number', min:0, max:10000000, owner:'student', source: program.url || 'Your own program cost estimate', validate: value => !value.trim() || (Number.isFinite(Number(value)) && Number(value) >= 0 && Number(value) <= 10000000), outcomes: () => ['This is a recorded program estimate. No dependent total-cost or aid calculator is available.'], apply: value => apply({ cost: value.trim() ? Number(value) : null }) },
  ];
}
