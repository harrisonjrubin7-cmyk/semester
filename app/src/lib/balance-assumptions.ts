import { numericAssumption, type AssumptionAdapter } from './assumptions';
import { summarizeWeek, workloadPressure, type Input, type Settings } from './life-balance';

export function balanceAssumptions(input: Input, start: Date, apply: (settings: Settings) => boolean): AssumptionAdapter[] {
  const commute = input.settings.commute;
  if (!commute) return [];
  const outcomes = (next: Settings): string[] => {
    const updated = { ...input, settings: next };
    const result = summarizeWeek(updated, start);
    return [`Commute this week: ${result.hours.commute} hours`, `Open time this week: ${result.hours.open} hours`, ...workloadPressure(updated, start).filter(p => p.known + p.unknown > 0).map(p => `${p.iso}: ${p.openMinutes} open minutes; work estimate ${p.known ? `${p.estimatedMinutes} minutes from timed work` : 'Unknown'}; ${p.unknown} deadlines without a time estimate`)];
  };
  return [
    numericAssumption({ id:'commute', label:'Commute minutes each way', value:commute.minutesEachWay, min:0, max:240, owner:'student', source:'Your recorded commute', outcomes: minutesEachWay => outcomes({ commute:{ ...commute, minutesEachWay } }), apply: minutesEachWay => apply({ commute:{ ...commute, minutesEachWay } }) }),
    { id:'days', label:'Commute weekdays', value:commute.days.join(', '), owner:'student', source:'Your chosen weekdays (0 Sunday through 6 Saturday)', validate: value => !value.trim() || value.split(',').every(part => /^[0-6]$/.test(part.trim())), outcomes: value => outcomes({ commute: { ...commute, days: value.trim() ? [...new Set(value.split(',').map(Number))] : [] } }), apply: value => apply({ commute: { ...commute, days: value.trim() ? [...new Set(value.split(',').map(Number))] : [] } }) },
  ];
}
