// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { beforeAll, beforeEach, afterEach, expect, it, vi } from 'vitest';
import { GraduationSimulator } from './GraduationSimulator';
import { WorkloadAssumptions } from './WorkloadAssumptions';
import { Degree } from '../screens/Degree';
import { WorkWindows } from './WorkWindows';
import { Capacity } from './Capacity';
import { DayBudget } from './Clashes';
import { DegreeAssumptions } from './DegreeAssumptions';
import { LifeBalance } from './LifeBalance';
import { LIFE_BALANCE_KEY } from '../lib/life-balance';
import { StudyAbroad } from './StudyAbroad';
import { EMPTY_ABROAD, newProgram } from '../lib/abroad';
import { CostPlanner } from './CostPlanner';
import { ProductivityWorkspace } from './ProductivityWorkspace';
import { Bill } from '../screens/Bill';
import { Career } from '../screens/Career';
import { StoreProvider, useStore } from '../state/store';
import { DEFAULT_PERSISTED, STORAGE_KEY } from '../state/shape';
import { EMPTY_GRADUATION, GRADUATION_KEY } from '../lib/graduation';
import { EMPTY_CAREER, newOpportunity } from '../lib/career';
import { EMPTY_PRODUCTIVITY, newDecision, newOption } from '../lib/productivity';
import { loadSeed } from '../data/seed';
import type { CostLine } from '../lib/cost-plan';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
let root: Root;
let host: HTMLDivElement;
beforeAll(async () => { await loadSeed(); });
beforeEach(() => { localStorage.clear(); host = document.createElement('div'); document.body.append(host); root = createRoot(host); });
afterEach(async () => { await act(async () => root.unmount()); host.remove(); localStorage.clear(); });
const button = (label: string) => [...host.querySelectorAll('button')].find(b => b.textContent?.trim() === label)!;
async function click(label: string) { expect(button(label), label).toBeTruthy(); await act(async () => button(label).click()); }
async function input(label: string, value: string, last = false) {
  const element = (last ? [...host.querySelectorAll<HTMLInputElement>(`[aria-label="${label}"]`)].at(-1) : host.querySelector<HTMLInputElement>(`[aria-label="${label}"]`))!;
  expect(element, label).toBeTruthy();
  await act(async () => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(element, value);
    element.dispatchEvent(new Event('input', { bubbles: true }));
  });
}
async function propose(label: string, value: string) { await click(`Edit ${label}`); await input(`Proposed ${label}`, value); await click(`Preview ${label}`); }
function Probe() { const { state, dispatch } = useStore(); return <><output aria-label="Canonical state">{JSON.stringify({ windows: state.windows, floor: state.floor, rest: state.rest, dayBudget: state.dayBudget, contract: state.contract, requirements: state.requirements, plans: state.plans, term: state.term })}</output><button onClick={() => dispatch({ type: 'setTerm', term: '2027SP' })}>Change owner context term</button><button onClick={() => dispatch({ type: 'openCourse', id: state.courseId === 'core' ? 'psci' : 'core' })}>Change course context</button></>; }
const state = () => JSON.parse(host.querySelector('[aria-label="Canonical state"]')!.textContent!);

it('previews actual graduation date and cost, cancels without writes, then applies to the plan', async () => {
  const initial = { ...EMPTY_GRADUATION, plan: { ...EMPTY_GRADUATION.plan, needed: 120, perTerm: 15, costPerTerm: 10000, next: { season: 'Spring', year: 2027 } } };
  localStorage.setItem(GRADUATION_KEY, JSON.stringify(initial));
  await act(async () => root.render(<GraduationSimulator done={60} />));
  const before = localStorage.getItem(GRADUATION_KEY);
  await propose('Fall and spring credits', '30');
  expect(host.querySelector('[aria-label="Preview Fall and spring credits"]')!.textContent).toContain('Fall 2027');
  expect(host.querySelector('[aria-label="Preview Fall and spring credits"]')!.textContent).toContain('$20,000');
  expect(localStorage.getItem(GRADUATION_KEY)).toBe(before);
  await click('Cancel Fall and spring credits');
  expect(localStorage.getItem(GRADUATION_KEY)).toBe(before);
  await propose('Fall and spring credits', '30');
  await click('Apply Fall and spring credits');
  expect(JSON.parse(localStorage.getItem(GRADUATION_KEY)!).plan.perTerm).toBe(30);
  expect(host.querySelector('#grad-plan')!.closest('section')!.textContent).toContain('Fall 2027');
});

it('keeps legacy graduation private to device and resets same-valued previews across accounts', async () => {
  for (const key of [GRADUATION_KEY, `${GRADUATION_KEY}:a`, `${GRADUATION_KEY}:b`]) localStorage.setItem(key, JSON.stringify(EMPTY_GRADUATION));
  await act(async () => root.render(<GraduationSimulator accountId="a" done={60} />));
  await propose('Fall and spring credits', '30');
  await act(async () => root.render(<GraduationSimulator accountId="b" done={60} />));
  expect(button('Apply Fall and spring credits')).toBeUndefined();
  expect(host.querySelector('[aria-label="Proposed Fall and spring credits"]')).toBeNull();
  expect(JSON.parse(localStorage.getItem(`${GRADUATION_KEY}:a`)!).plan.perTerm).toBe(15);
  await propose('Fall and spring credits', '20'); await click('Apply Fall and spring credits');
  expect(JSON.parse(localStorage.getItem(`${GRADUATION_KEY}:b`)!).plan.perTerm).toBe(20);
  expect(JSON.parse(localStorage.getItem(GRADUATION_KEY)!).plan.perTerm).toBe(15);
  await act(async () => root.render(<GraduationSimulator accountId="new" done={60} />));
  expect(localStorage.getItem(`${GRADUATION_KEY}:new`)).toBeNull();
});

it('previews course time from real store inputs and changes canonical week capacity only on apply', async () => {
  localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...DEFAULT_PERSISTED, windows: [{ id: 'evening', label: 'Evening', days: [1,2,3,4,5], from: 1080, to: 1200 }] }));
  await act(async () => root.render(<StoreProvider><WorkloadAssumptions /><Probe /></StoreProvider>));
  const label = 'Evening to (minutes after midnight)';
  await propose(label, '1320');
  expect(host.querySelector(`[aria-label="Preview ${label}"]`)!.textContent).toContain('Week capacity after protected time: 20 hours');
  expect(state().windows[0].to).toBe(1200);
  await click(`Cancel ${label}`); expect(state().windows[0].to).toBe(1200);
  await propose(label, '1320'); await click(`Apply ${label}`);
  expect(state().windows[0].to).toBe(1320);
  await propose('Weekly school hours', '11'); await click('Change owner context term');
  expect(button('Apply Weekly school hours')).toBeUndefined();
  expect(state().contract.hours).toBe(0);
  const locked = [...host.querySelectorAll('fieldset')].find(f => f.textContent?.includes('Institution — locked'));
  expect(locked).toBeDefined(); expect(locked!.querySelector('button')!.disabled).toBe(true);
});

it('recalculates actual degree progress from edited personal requirement counts', async () => {
  localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...DEFAULT_PERSISTED, requirements: [{ id:'r', programme:'Major', name:'Electives', need:'hours', count:6, accepts:[], note:'Personal audit copy' }], taken: [{ id:'t', code:'TEST 1', name:'Test', hours:3, term:'2025FA', grade:'A', status:'done' }] }));
  await act(async () => root.render(<StoreProvider><DegreeAssumptions /><Probe /></StoreProvider>));
  await propose('Electives required hours', '9');
  expect(state().requirements[0].count).toBe(6);
  const preview = host.querySelector('[aria-label="Preview Electives required hours"]')!.textContent;
  expect(preview).toContain('6');
  await click('Apply Electives required hours'); expect(state().requirements[0].count).toBe(9);
});

it('previews real career target ordering, cancels, then persists only that owner-term preference', async () => {
  const key = 'semester.career.v1:device:2026FA';
  localStorage.setItem(key, JSON.stringify({ ...EMPTY_CAREER, opportunities: [{ ...newOpportunity(), id:'a', title:'Engineering intern' }, { ...newOpportunity(), id:'b', title:'History researcher' }] }));
  await act(async () => root.render(<StoreProvider><Career /><Probe /></StoreProvider>));
  await propose('Target roles', 'history');
  expect(host.querySelector('[aria-label="Preview Target roles"]')!.textContent).toContain('1. History researcher: 1 matching target terms');
  expect(JSON.parse(localStorage.getItem(key)!).targetRoles).toBe('');
  await click('Cancel Target roles'); expect(JSON.parse(localStorage.getItem(key)!).targetRoles).toBe('');
  await propose('Target roles', 'history'); await click('Apply Target roles');
  expect(JSON.parse(localStorage.getItem(key)!).targetRoles).toBe('history');
  await propose('Target roles', 'engineering'); await click('Change owner context term');
  expect(button('Apply Target roles')).toBeUndefined();
  expect(JSON.parse(localStorage.getItem(key)!).targetRoles).toBe('history');
});

it('retains cost source details and previews actual totals without applying a cancelled edit', async () => {
  let lines: CostLine[] = [{ id:'rent', label:'Housing', amount:1000, per:'term', source:'imported', from:'Personal copy of housing page', on:'2026-09-01' }];
  const original = structuredClone(lines);
  await act(async () => root.render(<CostPlanner lines={lines} onChange={next => { lines = next; }} />));
  await propose('Housing estimate', '1200');
  expect(host.querySelector('[aria-label="Preview Housing estimate"]')!.textContent).toContain('$1,200'); expect(lines).toEqual(original);
  await click('Cancel Housing estimate'); expect(lines).toEqual(original);
  await propose('Housing estimate', '1200'); await click('Apply Housing estimate');
  expect(lines[0]).toEqual({ ...original[0], amount:1200, source:'student_entered' });
});

it('keeps institutional decision assumptions locked and invalidates supported fit on a personal change', async () => {
  const decision = newDecision('Choose a career');
  decision.assumptions = [{ id:'personal', label:'Travel limit', value:'Local', owner:'student', source:'My preference', impacts:'Career choices', review:false }, { id:'school', label:'School rule', value:'Confirmed only by registrar', owner:'institution', source:'Recorded school rule source', impacts:'Eligibility', review:false }];
  const option = newOption('Local role');
  decision.options = [option];
  const criterion = decision.criteria[0];
  option.fits[criterion.id] = { fit:'strong', explanation:'My source', source:'Saved listing', checked:new Date().toISOString().slice(0,10) };
  localStorage.setItem('semester.productivity.v1:device', JSON.stringify({ ...EMPTY_PRODUCTIVITY, decisions:[decision] }));
  await act(async () => root.render(<StoreProvider><ProductivityWorkspace /></StoreProvider>));
  const select = host.querySelector<HTMLSelectElement>('[aria-label="Saved decisions"]')!;
  await act(async () => { select.value=decision.id; select.dispatchEvent(new Event('change', { bubbles:true })); });
  expect(button('Edit School rule').disabled).toBe(true);
  await propose('Travel limit', 'Anywhere');
  expect(host.querySelector('[aria-label="Preview Travel limit"]')!.textContent).toContain('source checks Need review');
  await click('Apply Travel limit');
  const saved = JSON.parse(localStorage.getItem('semester.productivity.v1:device')!).decisions[0];
  expect(saved.assumptions.find((a: { id: string }) => a.id === 'personal').source).toBe('My preference');
  expect(saved.assumptions.find((a: { id: string }) => a.id === 'school')).toEqual(decision.assumptions[1]);
  expect(saved.options[0].fits[criterion.id].checked).toBe('');
});


it('previews the canonical bill schedule and cancellation never records a payment', async () => {
  localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...DEFAULT_PERSISTED, charges: [{ id:'c', what:'Tuition copy', kind:'tuition', cents:120000, term:'2026FA', at:1 }], plans: { '2026FA': { parts:1, first:'2026-11-01', everyMonths:1 } } }));
  await act(async () => root.render(<StoreProvider><Bill schoolAccount={false} /><Probe /></StoreProvider>));
  await propose('Planned instalments', '3');
  expect(host.querySelector('[aria-label="Preview Planned instalments"]')!.textContent).toContain('2026-12-01: $400.00');
  expect(state().plans['2026FA'].parts).toBe(1);
  await click('Cancel Planned instalments'); expect(state().plans['2026FA'].parts).toBe(1);
  await propose('Planned instalments', '3'); await click('Apply Planned instalments');
  expect(state().plans['2026FA'].parts).toBe(3);
  expect(JSON.parse(localStorage.getItem(STORAGE_KEY)!).payments).toEqual([]);
});

it('blocks invalid drafts and preserves the graduation plan when storage rejects apply', async () => {
  localStorage.setItem(GRADUATION_KEY, JSON.stringify(EMPTY_GRADUATION));
  await act(async () => root.render(<GraduationSimulator done={60} />));
  await click('Edit Fall and spring credits'); await input('Proposed Fall and spring credits', '100');
  expect(button('Preview Fall and spring credits').disabled).toBe(true);
  await input('Proposed Fall and spring credits', '30'); await click('Preview Fall and spring credits');
  const original = localStorage.getItem(GRADUATION_KEY);
  const write = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('Quota exceeded'); });
  try {
    await click('Apply Fall and spring credits');
    expect(host.textContent).toContain('Could not apply this change. Your original value is preserved.');
    expect(localStorage.getItem(GRADUATION_KEY)).toBe(original);
  } finally { write.mockRestore(); }
});

it('keeps zero-cost graduation estimates unknown and discards pending cloud confirmation on owner change', async () => {
  await act(async () => root.render(<GraduationSimulator done={60} accountId="a" simulator />));
  await propose('Fall and spring credits', '30');
  expect(host.querySelector('[aria-label="Preview Fall and spring credits"]')!.textContent).toContain('Projected cost before aid: Unknown');
  await click('Cancel Fall and spring credits');
  const select = [...host.querySelectorAll('select')].find(s => s.closest('label')?.textContent?.includes('Add a scenario'))!;
  await act(async () => { select.value='minor'; select.dispatchEvent(new Event('change', { bubbles:true })); });
  await click('Save draft to your account'); expect(host.querySelector('[role="dialog"]')).not.toBeNull();
  await act(async () => root.render(<GraduationSimulator done={60} accountId="b" simulator />));
  expect(host.querySelector('[role="dialog"]')).toBeNull();
  expect(button('Save draft to your account')).toBeUndefined();
});


it('recalculates unmatched abroad credits and discards same-valued drafts when selecting another program', async () => {
  const key = 'semester.abroad.v1:device';
  const first = { ...newProgram(), id:'first', name:'First program', credits:15 };
  const second = { ...newProgram(), id:'second', name:'Second program', credits:15 };
  localStorage.setItem(key, JSON.stringify({ ...EMPTY_ABROAD, programs:[first, second] }));
  await act(async () => root.render(<StudyAbroad storageKey={key} />));
  await propose('Planned study abroad credits', '18');
  expect(host.querySelector('[aria-label="Preview Planned study abroad credits"]')!.textContent).toContain('18 with no course matched yet');
  await click('Second program');
  expect(button('Apply Planned study abroad credits')).toBeUndefined();
  expect(JSON.parse(localStorage.getItem(key)!).programs.map((p: { credits: number }) => p.credits)).toEqual([15,15]);
  await propose('Planned study abroad credits', '21'); await click('Apply Planned study abroad credits');
  expect(JSON.parse(localStorage.getItem(key)!).programs.map((p: { credits: number }) => p.credits)).toEqual([15,21]);
});


it('previews actual commute and open hours while leaving settings untouched on cancel', async () => {
  localStorage.setItem(LIFE_BALANCE_KEY, JSON.stringify({ commute:{ days:[1,2,3,4,5], minutesEachWay:30 } }));
  await act(async () => root.render(<StoreProvider><LifeBalance start="2026-09-28" /></StoreProvider>));
  await propose('Commute minutes each way', '60');
  expect(host.querySelector('[aria-label="Preview Commute minutes each way"]')!.textContent).toContain('Commute this week: 10 hours');
  expect(JSON.parse(localStorage.getItem(LIFE_BALANCE_KEY)!).commute.minutesEachWay).toBe(30);
  await click('Cancel Commute minutes each way');
  expect(JSON.parse(localStorage.getItem(LIFE_BALANCE_KEY)!).commute.minutesEachWay).toBe(30);
  await propose('Commute minutes each way', '60'); await click('Apply Commute minutes each way');
  expect(JSON.parse(localStorage.getItem(LIFE_BALANCE_KEY)!).commute.minutesEachWay).toBe(60);
});


async function nativeInput(label: string, value: string) {
  const control = [...host.querySelectorAll<HTMLInputElement>('input')].find(i => i.getAttribute('aria-label') === label || i.closest('label')?.textContent?.trim().startsWith(label))!;
  expect(control, label).toBeTruthy();
  await act(async () => {
    control.focus();
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(control, value);
    control.dispatchEvent(new Event('input', { bubbles:true }));
  });
}
async function nativeSelect(label: string, value: string) {
  const control = [...host.querySelectorAll<HTMLSelectElement>('select')].find(i => i.getAttribute('aria-label') === label || i.closest('label')?.textContent?.trim().startsWith(label))!;
  expect(control, label).toBeTruthy();
  await act(async () => { control.value = value; control.dispatchEvent(new Event('change', { bubbles:true })); });
}
const pendingText = () => host.querySelector('[aria-label="Pending assumption change"]')?.textContent || '';

it('routes original graduation load and term controls into the shared preview without early persistence', async () => {
  localStorage.setItem(GRADUATION_KEY, JSON.stringify({ ...EMPTY_GRADUATION, plan: { ...EMPTY_GRADUATION.plan, next:{ season:'Spring', year:2027 }, costPerTerm:10000 } }));
  await act(async () => root.render(<GraduationSimulator done={60} />));
  const before = localStorage.getItem(GRADUATION_KEY);
  await nativeInput('Hours per fall or spring', '30');
  expect(pendingText()).toContain('Fall 2027');
  expect(document.activeElement?.getAttribute('aria-label')).toBe('Proposed Fall and spring credits');
  expect(localStorage.getItem(GRADUATION_KEY)).toBe(before);
  await click('Cancel Fall and spring credits'); expect(localStorage.getItem(GRADUATION_KEY)).toBe(before);
  expect(document.activeElement?.closest('label')?.textContent).toContain('Hours per fall or spring');
  await nativeInput('Hours per fall or spring', '30'); await click('Apply Fall and spring credits');
  expect(JSON.parse(localStorage.getItem(GRADUATION_KEY)!).plan.perTerm).toBe(30);
  await nativeSelect('Next term', 'Fall'); expect(JSON.parse(localStorage.getItem(GRADUATION_KEY)!).plan.next.season).toBe('Spring');
  await click('Apply Next term season'); expect(JSON.parse(localStorage.getItem(GRADUATION_KEY)!).plan.next.season).toBe('Fall');
});

it('stages original cost amount controls and retains the imported source when cancelled', async () => {
  const lines: CostLine[] = [{ id:'line', label:'Housing', amount:1000, per:'term', source:'imported', from:'Original source', on:'2026-09-01' }];
  const changed = vi.fn();
  await act(async () => root.render(<CostPlanner lines={lines} onChange={changed} />));
  await nativeInput('Amount ($)', '1200'); expect(pendingText()).toContain('$1,200'); expect(changed).not.toHaveBeenCalled();
  await click('Cancel Housing estimate'); expect(changed).not.toHaveBeenCalled();
  await nativeInput('Amount ($)', '1200'); await click('Apply Housing estimate');
  expect(changed).toHaveBeenCalledWith([{ ...lines[0], amount:1200, source:'student_entered' }]);
});

it('stages original workload time, weekday, floor, contract and day-threshold controls', async () => {
  localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...DEFAULT_PERSISTED, windows:[{ id:'w', label:'Evening', days:[1,2,3,4,5], from:1080, to:1200 }], rest:[{ id:'r', label:'Dinner', days:[1], from:1200, to:1260 }] }));
  await act(async () => root.render(<StoreProvider><WorkWindows /><Capacity /><DayBudget /><Probe /></StoreProvider>));
  await nativeInput('To', '22:00'); expect(pendingText()).toContain('Week capacity after protected time: 19 hours');
  expect(state().windows[0].to).toBe(1200); await click('Cancel Evening to (minutes after midnight)'); expect(state().windows[0].to).toBe(1200);
  await nativeInput('To', '22:00'); await click('Apply Evening to (minutes after midnight)'); expect(state().windows[0].to).toBe(1320);
  const sunday = host.querySelector<HTMLButtonElement>('button[aria-label="Sunday"]')!;
  await act(async () => sunday.click()); expect(state().windows[0].days).not.toContain(0);
  await click('Apply Evening weekdays'); expect(state().windows[0].days).toContain(0);
  await nativeInput('Hours a week school gets', '12'); expect(state().contract.hours).toBe(0); await click('Apply Weekly school hours'); expect(state().contract.hours).toBe(12);
  await click('Off'); expect(state().floor.on).toBe(false); await click('Cancel Sleep floor enabled'); expect(state().floor.on).toBe(false);
  const more = host.querySelector<HTMLButtonElement>('button[aria-label="More hours before a day counts as heavy"]')!;
  const before = state().dayBudget;
  await act(async () => more.click()); expect(state().dayBudget).toBe(before); await click('Apply Heavy day threshold (hours)'); expect(state().dayBudget).toBe(before + 0.5);
  const restTo = [...host.querySelectorAll<HTMLInputElement>('input[aria-label="To"]')].at(-1)!;
  await act(async () => { Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(restTo, '22:00'); restTo.dispatchEvent(new Event('input', { bubbles:true })); });
  expect(state().rest[0].to).toBe(1260); await click('Apply Dinner to (minutes after midnight)'); expect(state().rest[0].to).toBe(1320);
  await nativeInput('Hours a week school gets', '15'); await click('Change course context');
  expect(host.querySelector('[aria-label="Pending assumption change"]')).toBeNull(); expect(state().contract.hours).toBe(12);
  await nativeInput('Hours a week school gets', '15'); await click('Change owner context term');
  expect(host.querySelector('[aria-label="Pending assumption change"]')).toBeNull(); expect(state().contract.hours).toBe(12);
});

it('stages original career preference inputs and drops a draft on a term switch', async () => {
  const key = 'semester.career.v1:device:2026FA';
  localStorage.setItem(key, JSON.stringify({ ...EMPTY_CAREER, opportunities:[{ ...newOpportunity(), id:'o', title:'History researcher' }] }));
  await act(async () => root.render(<StoreProvider><Career /><Probe /></StoreProvider>));
  await click('Résumé'); await nativeInput('Roles you want, separated by commas', 'history');
  expect(pendingText()).toContain('History researcher: 1 matching target terms'); expect(JSON.parse(localStorage.getItem(key)!).targetRoles).toBe('');
  await click('Cancel Target roles'); expect(JSON.parse(localStorage.getItem(key)!).targetRoles).toBe('');
  await nativeInput('Roles you want, separated by commas', 'history'); await click('Apply Target roles'); expect(JSON.parse(localStorage.getItem(key)!).targetRoles).toBe('history');
  await nativeInput('Places, separated by commas', 'London'); await click('Change owner context term');
  expect(button('Apply Target locations')).toBeUndefined(); expect(JSON.parse(localStorage.getItem(key)!).targetLocations).toBe('');
});

it('stages original bill controls and shows the actual installment schedule before apply', async () => {
  localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...DEFAULT_PERSISTED, charges:[{ id:'c', what:'Tuition copy', kind:'tuition', cents:120000, term:'2026FA', at:1 }], plans:{ '2026FA':{ parts:1, first:'2026-11-01', everyMonths:1 } } }));
  await act(async () => root.render(<StoreProvider><Bill schoolAccount={false} /><Probe /></StoreProvider>));
  await nativeSelect('How many instalments', '3'); expect(pendingText()).toContain('2026-12-01: $400.00'); expect(state().plans['2026FA'].parts).toBe(1);
  await click('Cancel Planned instalments'); expect(state().plans['2026FA'].parts).toBe(1);
  await nativeSelect('How many instalments', '3'); await click('Apply Planned instalments'); expect(state().plans['2026FA'].parts).toBe(3);
  await nativeInput('When the first instalment is due', '2026-12-01'); expect(state().plans['2026FA'].first).toBe('2026-11-01');
  await click('Apply Planned first due date'); expect(state().plans['2026FA'].first).toBe('2026-12-01');
});

it('previews canonical outcomes inside the original degree requirement draft before Save and Cancel', async () => {
  localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...DEFAULT_PERSISTED, requirements:[{ id:'r', programme:'Major', name:'Electives', need:'hours', count:6, accepts:[], note:'' }], taken:[{ id:'t', code:'TEST 1', name:'Test', hours:3, term:'2025FA', grade:'A', status:'done' }] }));
  await act(async () => root.render(<StoreProvider><Degree advisorMeeting={false} /><Probe /></StoreProvider>));
  await click('Requirements');
  const edit = host.querySelector<HTMLButtonElement>('[aria-label="Edit Electives"]')!;
  await act(async () => edit.click()); await input('How many', '9', true);
  expect(host.querySelector('[aria-label="Preview requirement changes"]')!.textContent).toContain('6'); expect(state().requirements[0].count).toBe(6);
  await click('Cancel'); expect(state().requirements[0].count).toBe(6);
  await act(async () => host.querySelector<HTMLButtonElement>('[aria-label="Edit Electives"]')!.click()); await input('How many', '9', true); await click('Save'); expect(state().requirements[0].count).toBe(9);
});

it('shows actual commute effects in the original draft form before Save and supports cancel', async () => {
  localStorage.setItem(LIFE_BALANCE_KEY, JSON.stringify({ commute:{ days:[1,2,3,4,5], minutesEachWay:30 } }));
  await act(async () => root.render(<StoreProvider><LifeBalance start="2026-09-28" /></StoreProvider>));
  await nativeInput('Minutes each way', '60'); expect(host.querySelector('[aria-label="Preview commute changes"]')!.textContent).toContain('Commute this week: 10 hours');
  expect(JSON.parse(localStorage.getItem(LIFE_BALANCE_KEY)!).commute.minutesEachWay).toBe(30); await click('Cancel commute changes'); expect(JSON.parse(localStorage.getItem(LIFE_BALANCE_KEY)!).commute.minutesEachWay).toBe(30);
  await nativeInput('Minutes each way', '60'); await click('Save commute'); expect(JSON.parse(localStorage.getItem(LIFE_BALANCE_KEY)!).commute.minutesEachWay).toBe(60);
});


it('stages original abroad program credits and cost and cancels them without changing approval records', async () => {
  const key = 'semester.abroad.v1:device';
  const program = { ...newProgram(), id:'p', name:'Program', credits:15, cost:1000 };
  localStorage.setItem(key, JSON.stringify({ ...EMPTY_ABROAD, programs:[program] }));
  await act(async () => root.render(<StudyAbroad storageKey={key} />));
  await nativeInput('Credits you hope to bring home', '18');
  expect(pendingText()).toContain('18 with no course matched yet'); expect(JSON.parse(localStorage.getItem(key)!).programs[0].credits).toBe(15);
  await click('Cancel Planned study abroad credits'); expect(JSON.parse(localStorage.getItem(key)!).programs[0].credits).toBe(15);
  await nativeInput('Credits you hope to bring home', '18'); await click('Apply Planned study abroad credits'); expect(JSON.parse(localStorage.getItem(key)!).programs[0].credits).toBe(18);
  await nativeInput('Total cost, your own figure', '2000'); expect(pendingText()).toContain('No dependent total-cost or aid calculator'); expect(JSON.parse(localStorage.getItem(key)!).programs[0].cost).toBe(1000);
  await click('Cancel Study abroad cost (USD)'); expect(JSON.parse(localStorage.getItem(key)!).programs[0].cost).toBe(1000);
  expect(JSON.parse(localStorage.getItem(key)!).courses).toEqual([]);
});

it('previews and cancels reset-to-preferences before applying canonical source-check invalidation', async () => {
  const key = 'semester.productivity.v1:device';
  const decision = newDecision('Career decision');
  decision.assumptions = [{ id:'a', label:'Travel', value:'Local', owner:'student', source:'Original preference', impacts:'Choices', review:false }, { id:'school', label:'School', value:'School requirement', owner:'institution', source:'Recorded source', impacts:'Eligibility', review:false }];
  const option = newOption('Role'); decision.options = [option];
  option.fits[decision.criteria[0].id] = { fit:'strong', explanation:'Evidence', source:'Source', checked:new Date().toISOString().slice(0,10) };
  localStorage.setItem(key, JSON.stringify({ ...EMPTY_PRODUCTIVITY, decisions:[decision], preferences:[{ ...decision.assumptions[0], id:'pref', value:'Anywhere' }] }));
  await act(async () => root.render(<StoreProvider><ProductivityWorkspace /></StoreProvider>));
  await nativeSelect('Saved decisions', decision.id);
  const before = localStorage.getItem(key);
  await click('Reset to saved preferences'); expect(host.querySelector('[aria-label="Preview saved preferences"]')!.textContent).toContain('source checks Need review'); expect(localStorage.getItem(key)).toBe(before);
  await click('Cancel saved preferences'); expect(localStorage.getItem(key)).toBe(before);
  await click('Reset to saved preferences'); await click('Apply saved preferences');
  const saved = JSON.parse(localStorage.getItem(key)!).decisions[0];
  expect(saved.assumptions.find((a: { label: string }) => a.label === 'Travel').value).toBe('Anywhere');
  expect(saved.assumptions.find((a: { id: string }) => a.id === 'school')).toEqual(decision.assumptions[1]);
  expect(saved.options[0].fits[decision.criteria[0].id].checked).toBe('');
  await click('Reset to saved preferences');
  const concurrent = JSON.parse(localStorage.getItem(key)!);
  concurrent.decisions[0].goal = 'Changed in another view';
  localStorage.setItem(key, JSON.stringify(concurrent));
  await click('Apply saved preferences');
  expect(JSON.parse(localStorage.getItem(key)!).decisions[0].goal).toBe('Changed in another view');
  expect(host.textContent).toContain('Decision changed. Review saved preferences again.');
});
