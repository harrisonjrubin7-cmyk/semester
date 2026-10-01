import { numericAssumption, type AssumptionAdapter } from './assumptions';
import { project, termLabel, type Plan } from './graduation';
import { dollars } from './cost';

export function graduationOutcomes(plan: Plan, done: number): string[] {
  const result = project(plan, done);
  return [
    `Estimated finish: ${result.remaining === 0 ? 'Credits complete' : result.finish ? termLabel(result.finish) : 'Unknown at this pace'}`,
    `Remaining credits: ${result.remaining}`,
    `Projected cost before aid: ${result.cost === null ? 'Unknown' : dollars(result.cost)}`,
    'Course sequencing, aid and official eligibility: Unknown',
  ];
}

export function graduationAssumptions(plan: Plan, done: number, apply: (patch: Partial<Plan>) => boolean): AssumptionAdapter[] {
  const fields = [
    ['needed', 'Degree credits needed', 1, 400], ['perTerm', 'Fall and spring credits', 0, 30],
    ['summer', 'Summer credits', 0, 20],
    ...(!plan.costLines?.length ? [['costPerTerm', 'Cost per fall or spring', 0, 1000000], ['summerCost', 'Cost per summer', 0, 1000000]] as const : []),
  ] as const;
  return fields.map(([key, label, min, max]) => numericAssumption({
    id: key, label, value: plan[key], min, max, owner: 'student',
    source: 'Your graduation plan estimate; confirm requirements with your advisor',
    outcomes: value => graduationOutcomes({ ...plan, [key]: value }, done),
    apply: value => apply({ [key]: value }),
  }));
}
