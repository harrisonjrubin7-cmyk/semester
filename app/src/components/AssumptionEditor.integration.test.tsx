// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { beforeAll, beforeEach, afterEach, expect, it, vi } from 'vitest';
import { GraduationSimulator } from './GraduationSimulator';
import { WorkloadAssumptions } from './WorkloadAssumptions';
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
async function input(label: string, value: string) {
  const element = host.querySelector<HTMLInputElement>(`[aria-label="${label}"]`)!;
  expect(element, label).toBeTruthy();
  await act(async () => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(element, value);
    element.dispatchEvent(new Event('input', { bubbles: true }));
  });
}
async function propose(label: string, value: string) { await click(`Edit ${label}`); await input(`Proposed ${label}`, value); await click(`Preview ${label}`); }
function Probe() { const { state, dispatch } = useStore(); return <><output aria-label="Canonical state">{JSON.stringify({ windows: state.windows, contract: state.contract, requirements: state.requirements, plans: state.plans, term: state.term })}</output><button onClick={() => dispatch({ type: 'setTerm', term: '2027SP' })}>Change owner context term</button></>; }
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
