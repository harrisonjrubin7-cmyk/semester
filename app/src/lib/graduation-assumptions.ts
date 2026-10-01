import { numericAssumption, type AssumptionAdapter } from './assumptions';
import { project, termLabel, SEASONS, type Season, type Scenario, type Plan } from './graduation';
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
  const adapters: AssumptionAdapter[] = fields.map(([key, label, min, max]) => numericAssumption({
    id: key, label, value: plan[key], min, max, owner: 'student',
    source: 'Your graduation plan estimate; confirm requirements with your advisor',
    outcomes: value => graduationOutcomes({ ...plan, [key]: value }, done),
    apply: value => apply({ [key]: value }),
  }));
  adapters.push(numericAssumption({ id: 'year', label: 'Next term year', value: plan.next.year, min: 2000, max: 2100, step: 1, owner: 'student', source: 'Your graduation plan estimate', outcomes: year => graduationOutcomes({ ...plan, next: { ...plan.next, year: Math.round(year) } }, done), apply: year => apply({ next: { ...plan.next, year: Math.round(year) } }) }));
  adapters.push({ id: 'season', label: 'Next term season', value: plan.next.season, options: SEASONS, owner: 'student', source: 'Your graduation plan estimate', validate: value => SEASONS.includes(value as Season), outcomes: value => graduationOutcomes({ ...plan, next: { ...plan.next, season: value as Season } }, done), apply: value => apply({ next: { ...plan.next, season: value as Season } }) });
  return adapters;
}

export function scenarioAssumptions(plan: Plan, done: number, scenario: Scenario, apply: (patch: Partial<Scenario>) => boolean): AssumptionAdapter[] {
  const outcomes = (patch: Partial<Scenario>) => {
    const result = project(plan, done, { ...scenario, ...patch });
    return [`Estimated finish: ${result.remaining === 0 ? 'Credits complete' : result.finish ? termLabel(result.finish) : 'Unknown at this pace'}`, `Projected cost before aid: ${result.cost === null ? 'Unknown' : dollars(result.cost)}`, 'Official transfer, sequencing and aid: Unknown'];
  };
  const fields = [['extra', 'Scenario extra credits', -200, 200], ['perTerm', 'Scenario fall and spring credits', 0, 30], ['summer', 'Scenario summer credits', 0, 20]] as const;
  const adapters: AssumptionAdapter[] = fields.map(([key, label, min, max]) => numericAssumption({ id: key, label, value: scenario[key], min, max, owner: 'student', source: `Your scenario: ${scenario.name}`, outcomes: value => outcomes({ [key]: value }), apply: value => apply({ [key]: value }) }));
  if (scenario.abroad) {
    const abroad = scenario.abroad;
    adapters.push({ id: 'costPerTerm', label: 'Term abroad cost', value: abroad.costPerTerm === null ? '' : String(abroad.costPerTerm), type: 'number', min: 0, max: 1000000, owner: 'student', source: `Your scenario: ${scenario.name}; blank uses your normal term cost`, validate: value => !value.trim() || (Number.isFinite(Number(value)) && Number(value) >= 0 && Number(value) <= 1000000), outcomes: value => outcomes({ abroad: { ...abroad, costPerTerm: value.trim() ? Number(value) : null } }), apply: value => apply({ abroad: { ...abroad, costPerTerm: value.trim() ? Number(value) : null } }) });
    for (const [key, label, min, max] of [['terms', 'Terms abroad', 1, 4], ['credits', 'Expected transfer credits', 0, 30]] as const) {
      if (abroad[key] === null) continue;
      adapters.push(numericAssumption({ id: key, label, value: abroad[key]!, min, max, step: key === 'terms' ? 1 : undefined, owner: 'student', source: `Your scenario: ${scenario.name}`, outcomes: value => outcomes({ abroad: { ...abroad, [key]: key === 'terms' ? Math.round(value) : value } }), apply: value => apply({ abroad: { ...abroad, [key]: key === 'terms' ? Math.round(value) : value } }) }));
    }
  }
  return adapters;
}
