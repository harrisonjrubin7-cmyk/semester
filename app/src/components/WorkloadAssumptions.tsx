import { useStore, useNow } from '../state/store';
import { useAthleticEvents } from '../lib/athletics.hook';
import { datedItems } from '../lib/select';
import { asItems } from '../lib/apply';
import { forecast } from '../lib/pace';
import { clashes } from '../lib/clash';
import { weekCapacity, verdict } from '../lib/rest';
import { week } from '../lib/ahead';
import { reducer } from '../state/reducer';
import type { Action, State } from '../state/shape';
import { numericAssumption, type AssumptionAdapter } from '../lib/assumptions';
import { AssumptionEditor, NativeAssumptionEditor, type NativeAssumptionRequest } from './AssumptionEditor';

export function WorkloadAssumptions({ request, onClose }: { request?: NativeAssumptionRequest; onClose?: () => void } = {}) {
  const { state, dispatch, catalog, courseCode, account } = useStore();
  const now = useNow();
  const athletics = useAthleticEvents();
  const items = datedItems(catalog, now).filter(i => !state.done[i.id]);
  const needed = forecast(state.spent, items.filter(i => i.daysAway >= 0 && i.daysAway <= 7).map(i => ({ c: i.c, kind: i.kind }))).hours;
  const outcomes = (next: State): string[] => {
    const capacity = weekCapacity(next.windows, next.floor, next.rest);
    const ahead = week({ catalog, from: now, done: next.done, commitments: next.commitments, appointments: next.appointments, windows: next.windows, athletics });
    return [`Week capacity after protected time: ${capacity.real} hours`, verdict(needed, capacity, next.contract), `Week ahead spare time: ${ahead.spare} hours`, ...clashes([...items, ...asItems(next.applications, now)], next.spent, next.commitments, courseCode, next.dayBudget, athletics).map(c => c.says)];
  };
  const field = (id: string, label: string, value: number, min: number, max: number, action: (v: number) => Action, step = 1) => numericAssumption({ id, label, value, min, max, step, owner: 'student', source: 'Your workload settings', outcomes: v => outcomes(reducer(state, action(v))), apply: v => dispatch(action(v)) });
  const daysField = (id: string, label: string, days: number[], action: (days: number[]) => Action): AssumptionAdapter => ({
    id, label, value: days.join(', '), owner: 'student', source: 'Your chosen weekdays (0 Sunday through 6 Saturday)',
    validate: value => !value.trim() || value.split(',').every(part => /^[0-6]$/.test(part.trim())),
    outcomes: value => outcomes(reducer(state, action(value.trim() ? [...new Set(value.split(',').map(Number))] : []))),
    apply: value => dispatch(action(value.trim() ? [...new Set(value.split(',').map(Number))] : [])),
  });
  const assumptions: AssumptionAdapter[] = [
    field('dayBudget', 'Heavy day threshold (hours)', state.dayBudget, 1, 16, hours => ({ type: 'setDayBudget', hours }), 0.5),
    field('contract', 'Weekly school hours', state.contract.hours, 0, 120, hours => ({ type: 'setContract', hours })),
    field('floorFrom', 'Sleep floor start (minutes after midnight)', state.floor.from, 0, 1439, from => ({ type: 'setFloor', patch: { from } })),
    field('floorTo', 'Sleep floor end (minutes after midnight)', state.floor.to, 0, 1439, to => ({ type: 'setFloor', patch: { to } })),
    { id: 'floorOn', label: 'Sleep floor enabled', value: state.floor.on ? 'yes' : 'no', owner: 'student', source: 'Your workload settings', options: ['yes', 'no'], validate: v => v === 'yes' || v === 'no', outcomes: v => outcomes(reducer(state, { type: 'setFloor', patch: { on: v === 'yes' } })), apply: v => dispatch({ type: 'setFloor', patch: { on: v === 'yes' } }) },
    ...state.windows.map(w => daysField(`window:${w.id}:days`, `${w.label || 'Work window'} weekdays`, w.days, days => ({ type: 'patchWindow', id: w.id, patch: { days } }))),
    ...state.rest.map(r => daysField(`rest:${r.id}:days`, `${r.label || 'Protected time'} weekdays`, r.days, days => ({ type: 'patchRest', id: r.id, patch: { days } }))),
    ...state.windows.flatMap(w => (['from', 'to'] as const).map(key => field(`window:${w.id}:${key}`, `${w.label || 'Work window'} ${key} (minutes after midnight)`, w[key], 0, 1440, v => ({ type: 'patchWindow', id: w.id, patch: { [key]: v } })))),
    ...state.rest.flatMap(r => (['from', 'to'] as const).map(key => field(`rest:${r.id}:${key}`, `${r.label || 'Protected time'} ${key} (minutes after midnight)`, r[key], 0, 1440, v => ({ type: 'patchRest', id: r.id, patch: { [key]: v } })))),
    ...catalog.courses.map(course => ({ id: `course:${course.id}:credits`, label: `${course.code} published credits`, value: course.credits, owner: 'institution' as const, source: course.source || 'Syllabus source not recorded', validate: () => false, outcomes: () => ['Official credit and sequencing decisions: Unknown — confirm with the course owner'], apply: () => false })),
  ];
  if (request) return <NativeAssumptionEditor assumptions={assumptions} request={request} onClose={onClose || (() => {})} />;
  return <AssumptionEditor key={`${account?.id || 'device'}:${state.term}:${state.courseId}:${state.guideId}`} title="Review course and time assumptions" assumptions={assumptions} />;
}
