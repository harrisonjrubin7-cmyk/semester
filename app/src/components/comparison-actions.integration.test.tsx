// @vitest-environment jsdom
import { act, type ReactNode } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeAll, beforeEach, expect, it, vi } from 'vitest';
import { loadSeed } from '../data/seed';
import { STORAGE_KEY } from '../state/shape';
import { StoreProvider, useStore } from '../state/store';
import { RegistrationPortal } from './RegistrationPortal';
import { GraduationSimulator } from './GraduationSimulator';
import { RhythmWorkspace } from './OperatingRhythmWorkspace';
import { StudyAbroad } from './StudyAbroad';
import { Pathway } from '../screens/Pathway';
import { EMPTY_PATHWAY, newProgram as newPathwayProgram } from '../lib/pathway';
import { EMPTY_ABROAD, newProgram as newAbroadProgram } from '../lib/abroad';
import { EMPTY_REGISTRATION_DAY, REGISTRATION_DAY_KEY } from '../lib/registration-day';
import { Career } from '../screens/Career';
import { ProductivityWorkspace } from './ProductivityWorkspace';
import { EMPTY_CAREER, newOpportunity } from '../lib/career';
import { graduationKey } from '../lib/graduation';
import { meetingKey, newMeeting, readMeetings, sharePayload } from '../lib/advisor-meeting';
import { EMPTY_PRODUCTIVITY, newDecision, newOption, readProductivity } from '../lib/productivity';
import { shareWithAdvisor } from '../lib/advisor-shares';
const identity = vi.hoisted(() => ({ owner: 'alice' as string | null }));
vi.mock('../state/store', async original => {
  const real = await original<typeof import('../state/store')>();
  return { ...real, useAccountId: () => identity.owner, useStore: () => ({ ...real.useStore(), account: identity.owner ? { id: identity.owner } : null }) };
});
vi.mock('../lib/advisor-shares', async original => {
  const real = await original<typeof import('../lib/advisor-shares')>();
  return { ...real, shareWithAdvisor: vi.fn(async () => 'share'), myShares: vi.fn(async () => ({ shares: [], events: [] })), sharedWithMe: vi.fn(async () => []) };
});
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
let root: Root;
let host: HTMLDivElement;
const workKey = (owner = identity.owner) => `semester.productivity.v1:${owner || 'device'}`;
const stored = () => readProductivity(JSON.parse(localStorage.getItem(workKey())!));
const button = (label: string, within: ParentNode = host) => {
  const found = [...within.querySelectorAll('button')].find(b => b.textContent?.trim() === label);
  expect(found, `button: ${label}`).toBeDefined(); return found!;
};
const click = async (label: string, within: ParentNode = host) => { await act(async () => button(label, within).click()); };
const input = async (el: HTMLInputElement | HTMLTextAreaElement, value: string) => {
  await act(async () => { Object.getOwnPropertyDescriptor(el instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype, 'value')!.set!.call(el, value); el.dispatchEvent(new Event('input', { bubbles: true })); });
};
const tick = async (label: string) => {
  const checkbox = [...host.querySelectorAll<HTMLInputElement>('input[type="checkbox"]')].find(el => el.closest('label')?.textContent?.trim() === label)!;
  expect(checkbox, label).toBeDefined(); await act(async () => checkbox.click());
};
const mount = async (child: ReactNode) => { await act(async () => root.render(<StoreProvider>{child}</StoreProvider>)); };
const reload = async (child: ReactNode) => { await act(async () => root.unmount()); root = createRoot(host); await mount(child); };
const course = (id: string, code: string, seats: number | null) => ({ id, code, section: '01', title: `${code} title`, term: 'Spring 2027', department: 'TEST', credits: 3, instructor: '', location: '', description: '', prerequisites: '', seats, meetings: [] });
const setupCourses = () => {
  localStorage.setItem('semester.registration.v1', JSON.stringify({ catalog: { institution: 'Example University', importedAt: '2026-09-01T00:00:00Z', courses: [course('a', 'TEST 101', null), course('b', 'TEST 102', 8), course('private', 'PRIVATE 999', 4)] }, cart: [], plans: [] }));
  localStorage.setItem('semester.course-shortlist.v1', JSON.stringify({ saved: ['a', 'b', 'private'], compare: ['a', 'b'] }));
};
beforeAll(async () => { await loadSeed(); await import('./ComparisonActionsPanel'); await import('./AdvisorMeeting'); await import('./RegistrationDay'); });
beforeEach(() => {
  identity.owner = 'alice'; localStorage.clear(); vi.clearAllMocks(); window.location.hash = '';
  window.matchMedia = (() => ({ matches: false, addEventListener() {}, removeEventListener() {} })) as unknown as typeof window.matchMedia;
  localStorage.setItem(STORAGE_KEY, JSON.stringify({ schemaVersion: 6, term: '2026FA', seenOnboarding: true, sample: false, courses: [] }));
  host = document.createElement('div'); document.body.append(host); root = createRoot(host);
});
afterEach(async () => { await act(async () => root.unmount()); host.remove(); localStorage.clear(); });

it('saves real course choices and distinct original unknown/source contexts across reload without changing the registration cart', async () => {
  setupCourses(); await mount(<RegistrationPortal courseDetail demandForecasting={false} />);
  await click('Choose TEST 101 · 01'); await click('Save both options');
  const snapshots = stored().comparisons!;
  expect(snapshots.map(s => s.chosen)).toEqual(['a', null]);
  expect(snapshots[1].options.map(o => o.id)).toEqual(['a', 'b']);
  expect(snapshots[1].options[0].context.join('\n')).toContain('Seats from file: Unknown');
  expect(snapshots[1].options[1].context.join('\n')).toContain('Seats from file: 8');
  expect(JSON.stringify(snapshots)).toContain('2026-09-01'); expect(JSON.stringify(snapshots)).not.toContain('PRIVATE 999');
  expect(JSON.parse(localStorage.getItem('semester.registration.v1')!).cart).toEqual([]);
  await reload(<RegistrationPortal courseDetail demandForecasting={false} />);
  expect(host.textContent).toContain('Personal choice: TEST 101 · 01'); expect(stored().comparisons).toEqual(snapshots);
  expect(shareWithAdvisor).not.toHaveBeenCalled();
});

it('cancels a course advisor preview without creating a meeting or sending; edited selected-only draft enters the real meeting', async () => {
  setupCourses(); const privateMeeting = newMeeting(Date.now()); privateMeeting.notes = 'PRIVATE MEETING NOTE';
  localStorage.setItem(meetingKey('alice'), JSON.stringify({ version: 1, meetings: [privateMeeting] }));
  await mount(<RegistrationPortal courseDetail demandForecasting={false} />);
  await click('Ask advisor'); expect((host.querySelector('[aria-label="Advisor draft"]') as HTMLTextAreaElement).value).toBe('');
  await tick('Include TEST 101 · 01');
  let draft = host.querySelector<HTMLTextAreaElement>('[aria-label="Advisor draft"]')!;
  expect(draft.value).toContain('TEST 101'); expect(draft.value).not.toMatch(/TEST 102|PRIVATE 999|PRIVATE MEETING NOTE|Requirement fit/);
  await click('Cancel advisor preview');
  expect(readMeetings(JSON.parse(localStorage.getItem(meetingKey('alice'))!)).meetings).toHaveLength(1);
  await click('Ask advisor'); await tick('Include TEST 101 · 01');
  draft = host.querySelector<HTMLTextAreaElement>('[aria-label="Advisor draft"]')!;
  await input(draft, draft.value + '\nMy edited question'); await click('Prepare editable meeting');
  const m = readMeetings(JSON.parse(localStorage.getItem(meetingKey('alice'))!)).meetings[0];
  expect(m.agenda.map(a => a.text).join('')).toContain('My edited question');
  expect(m.attach).toEqual({ courses: [], scenario: null, followUps: false });
  expect(JSON.stringify(sharePayload(m, { sharedAs: 'Student', scenario: null, courses: [] }))).not.toMatch(/TEST 102|PRIVATE 999|PRIVATE MEETING NOTE/);
  expect(host.textContent).toContain('Advisor meeting'); expect(shareWithAdvisor).not.toHaveBeenCalled();
  const field = (label: string) => [...host.querySelectorAll<HTMLInputElement>('input')].find(el => el.closest('label')?.textContent?.includes(label))!;
  await input(field('Advisor’s school email'), 'advisor@example.edu'); await input(field('Your name, as your advisor knows you'), 'Student');
  await click('Preview and share…'); expect(shareWithAdvisor).not.toHaveBeenCalled();
  await click('Cancel', host.querySelector('[role="dialog"]')!); expect(shareWithAdvisor).not.toHaveBeenCalled();
});

it('keeps graduation choices in the signed-in scope and snapshots applied assumptions, not an open draft or cloud IDs', async () => {
  const data = { plan: { needed: 120, perTerm: 15, summer: 0, costPerTerm: 12000, summerCost: 0, next: { season: 'Spring', year: 2027 } }, scenarios: [{ id: 'slow', name: 'Lower load', extra: 0, perTerm: 9, summer: 0 }] };
  localStorage.setItem(graduationKey('alice'), JSON.stringify(data)); await mount(<GraduationSimulator done={60} accountId="alice" simulator />);
  await click('Edit Fall and spring credits'); await input(host.querySelector<HTMLInputElement>('[aria-label="Proposed Fall and spring credits"]')!, '22');
  await click('Save both options'); await click('Choose Lower load');
  const snap = stored().comparisons![0]; expect(snap.options.map(o => o.id)).toEqual(['current', 'slow']);
  expect(snap.options[0].context.join('\n')).toContain('Fall and spring credits: 15');
  expect(snap.options[1].context.join('\n')).toContain('Scenario fall and spring credits: 9');
  expect(JSON.stringify(snap)).not.toMatch(/credits: 22|cloudIds|validate|apply/);
  expect(JSON.parse(localStorage.getItem(graduationKey('alice'))!)).toEqual(data);
  await reload(<GraduationSimulator done={60} accountId="alice" simulator />); expect(host.textContent).toContain('Personal choice: Lower load');
  identity.owner = 'bob'; await reload(<GraduationSimulator done={60} accountId="bob" simulator />);
  expect(host.textContent).not.toContain('Lower load'); expect(localStorage.getItem(workKey())).toBeNull();
});

it('career choices retain term-scoped listing context and keep private targets and other listings out of advisor drafts', async () => {
  const key = 'semester.career.v1:alice:2026FA';
  localStorage.setItem(key, JSON.stringify({ ...EMPTY_CAREER, targetRoles: 'PRIVATE TARGET', opportunities: [{ ...newOpportunity(), id: 'job-a', title: 'Research internship', organization: 'Example lab', skills: 'Writing', url: 'https://example.edu/job' }, { ...newOpportunity(), id: 'job-b', title: 'Other job', compensation: 'Unknown stipend' }] }));
  await mount(<Career careerSkillsGraph />); await click('Choose Research internship');
  expect(JSON.parse(localStorage.getItem(key)!).opportunities[0].saved).toBe(true);
  const snap = stored().comparisons![0]; expect(snap.scope).toBe(key); expect(snap.chosen).toBe('job-a'); expect(JSON.stringify(snap)).toContain('PRIVATE TARGET');
  await click('Ask advisor'); await tick('Include Research internship');
  const draft = () => host.querySelector<HTMLTextAreaElement>('[aria-label="Advisor draft"]')!.value;
  expect(draft()).toContain('https://example.edu/job'); expect(draft()).not.toMatch(/PRIVATE TARGET|Other job|Unknown stipend/);
  await tick('Include applied assumptions and personal planning context'); expect(draft()).toContain('PRIVATE TARGET');
  await tick('Include applied assumptions and personal planning context'); expect(draft()).not.toContain('PRIVATE TARGET');
  await click('Cancel advisor preview'); await reload(<Career careerSkillsGraph />);
  expect(host.textContent).toContain('Personal choice: Research internship'); expect(shareWithAdvisor).not.toHaveBeenCalled();
});

it('productivity choose records the actual option, excludes private reflection, and preserves original applied evidence on reload', async () => {
  const d = newDecision('Housing decision'); const a = newOption('North hall'); const b = newOption('South hall');
  d.id = 'housing'; d.options = [a, b]; d.reflection = 'PRIVATE REFLECTION';
  a.fits[d.criteria[0].id] = { fit: 'strong', explanation: 'Verified by my notes', source: 'My source', checked: '2026-09-20' };
  localStorage.setItem(workKey(), JSON.stringify({ ...EMPTY_PRODUCTIVITY, decisions: [d] }));
  await mount(<ProductivityWorkspace />);
  await act(async () => { const select = host.querySelector<HTMLSelectElement>('[aria-label="Saved decisions"]')!; select.value = d.id; select.dispatchEvent(new Event('change', { bubbles: true })); }); await click('Choose North hall');
  expect(stored().decisions[0]).toMatchObject({ decided: true, chosen: a.id });
  expect(JSON.stringify(stored().comparisons)).not.toContain('PRIVATE REFLECTION'); expect(JSON.stringify(stored().comparisons)).toContain('My source');
  await click('Ask advisor'); await tick('Include North hall');
  expect(host.querySelector<HTMLTextAreaElement>('[aria-label="Advisor draft"]')!.value).not.toMatch(/South hall|PRIVATE REFLECTION/);
  await click('Cancel advisor preview'); await reload(<ProductivityWorkspace />); expect(host.textContent).toContain('Personal choice: North hall');
});

it('retains original potential schedules and registration backup order as personal snapshots', async () => {
  setupCourses(); const key = 'semester.registration.v1'; const data = JSON.parse(localStorage.getItem(key)!);
  data.plans = [{ id: 'schedule-a', name: 'Morning plan', courses: [data.catalog.courses[0]] }, { id: 'schedule-b', name: 'Later plan', courses: [data.catalog.courses[1]] }]; data.cart = ['a'];
  localStorage.setItem(key, JSON.stringify(data));
  localStorage.setItem(REGISTRATION_DAY_KEY, JSON.stringify({ ...EMPTY_REGISTRATION_DAY, backups: { a: ['b'] } }));
  await mount(<RegistrationPortal courseDetail demandForecasting={false} />); await click('Potential schedules (2)'); await click('Save both options');
  expect(stored().comparisons![0].options.map(o => o.id)).toEqual(['schedule-a', 'schedule-b']);
  await click('Choose Later plan'); expect(JSON.parse(localStorage.getItem(key)!).cart).toEqual(['a']);
  await click('Registration day'); await click('Save both options');
  const backup = stored().comparisons!.at(-1)!; expect(backup.surface).toBe('backups');
  expect(backup.options[0].context).toContain('Current primary section'); expect(backup.options[1].context).toContain('Backup priority: 1');
});

it('program and study-abroad comparisons preserve currency, provenance, unknowns and distinct actual programs', async () => {
  const first = { ...newPathwayProgram(), id: 'p-a', school: 'School A', program: 'Art', tuition: 1000, currency: 'USD', period: 'Year', notes: 'PRIVATE PROGRAM NOTE' };
  const second = { ...newPathwayProgram(), id: 'p-b', school: 'School B', program: 'Design', tuition: 800, currency: 'EUR', period: 'Term' };
  localStorage.setItem('semester.pathway.v1:alice', JSON.stringify({ ...EMPTY_PATHWAY, programs: [first, second] }));
  await mount(<Pathway />); await click('Programs'); await click('Save both options');
  const snap = stored().comparisons![0]; expect(snap.options[0].context.join('\n')).toContain('currency: USD'); expect(snap.options[1].context.join('\n')).toContain('currency: EUR');
  expect(JSON.stringify(snap)).not.toContain('PRIVATE PROGRAM NOTE');
  const a = { ...newAbroadProgram(), id: 'abroad-a', name: 'Exchange A', cost: null, notes: 'PRIVATE ABROAD NOTE' };
  const b = { ...newAbroadProgram(), id: 'abroad-b', name: 'Exchange B', cost: 6000, currency: 'EUR' };
  localStorage.setItem('semester.abroad.v1:alice', JSON.stringify({ ...EMPTY_ABROAD, programs: [a, b] }));
  await reload(<StudyAbroad storageKey="semester.abroad.v1:alice" />); await click('Save both options');
  const abroad = stored().comparisons!.at(-1)!; expect(abroad.options[0].context.join('\n')).toContain('Cost: Unknown'); expect(abroad.options[1].context.join('\n')).toContain('Cost: 6000 EUR');
  expect(JSON.stringify(abroad)).not.toContain('PRIVATE ABROAD NOTE');
});

it('chooses a real work-order simulation through the canonical dated plan and snapshots both orders', async () => {
  const scope = 'semester.operating-rhythm.v1:alice:2026FA';
  await mount(<RhythmWorkspace scope={scope} today="2026-10-01" />);
  const view = [...host.querySelectorAll<HTMLSelectElement>('select')].find(el => [...el.options].some(o => o.value === 'Plan'))!;
  await act(async () => { view.value = 'Plan'; view.dispatchEvent(new Event('change', { bubbles: true })); });
  const titles = [...host.querySelectorAll<HTMLInputElement>('fieldset input')].filter(el => el.closest('label')?.textContent?.trim() === 'Title');
  for (const [i, title] of ['Essay', 'Email', 'Outline'].entries()) await input(titles[i], title);
  await click('Save both options'); await click('Choose Grouped context');
  const snapshots = stored().comparisons!; expect(snapshots[0].options.map(o => o.id)).toEqual(['current', 'grouped']);
  expect(snapshots[0].options[0].context.join('\n')).toContain('context changes: 2');
  expect(snapshots[0].options[1].context.join('\n')).toContain('context changes: 1');
  const plan = JSON.parse(localStorage.getItem(`${scope}:daily`)!).plans[0];
  expect(plan.values.milestones).toBe('Email: 10 minutes (Admin)\nEssay: 25 minutes (Writing)\nOutline: 25 minutes (Writing)');
  expect(plan.values.assumptions).toContain('switch buffer: 5 minutes');
  expect(shareWithAdvisor).not.toHaveBeenCalled();
});

it('refuses corrupted snapshot storage before changing an owner-scoped career shortlist', async () => {
  const key = 'semester.career.v1:alice:2026FA';
  localStorage.setItem(key, JSON.stringify({ ...EMPTY_CAREER, opportunities: [{ ...newOpportunity(), id: 'a', title: 'Actual opening' }] }));
  await mount(<Career />);
  localStorage.setItem(workKey(), '{damaged');
  await click('Choose Actual opening');
  expect(localStorage.getItem(workKey())).toBe('{damaged');
  expect(JSON.parse(localStorage.getItem(key)!).opportunities[0].saved).toBe(false);
  expect(host.textContent).toContain('Saved data could not be read');
});

it('source changes and account changes close a privacy preview without saving or exposing its old draft', async () => {
  const key = 'semester.career.v1:alice:2026FA';
  const source = { ...EMPTY_CAREER, opportunities: [{ ...newOpportunity(), id: 'a', title: 'Actual opening' }] };
  localStorage.setItem(key, JSON.stringify(source)); await mount(<Career />);
  await click('Ask advisor'); await tick('Include Actual opening');
  const draft = host.querySelector<HTMLTextAreaElement>('[aria-label="Advisor draft"]')!;
  await input(draft, 'PRIVATE UNSAVED DRAFT');
  source.opportunities[0].cost = 'Updated cost'; localStorage.setItem(key, JSON.stringify(source));
  await act(async () => window.dispatchEvent(new CustomEvent('semester-device-library', { detail: key })));
  expect(host.querySelector('[aria-label="Advisor draft"]')).toBeNull();
  await click('Ask advisor'); await tick('Include Actual opening');
  identity.owner = 'bob'; await mount(<Career />);
  expect(host.querySelector('[aria-label="Advisor draft"]')).toBeNull(); expect(host.textContent).not.toContain('PRIVATE UNSAVED DRAFT');
  expect(localStorage.getItem(meetingKey('alice'))).toBeNull(); expect(localStorage.getItem(meetingKey('bob'))).toBeNull();
  expect(shareWithAdvisor).not.toHaveBeenCalled();
});

it('reports an honest saved personal choice if the later canonical career update is refused', async () => {
  const key = 'semester.career.v1:alice:2026FA';
  localStorage.setItem(key, JSON.stringify({ ...EMPTY_CAREER, opportunities: [{ ...newOpportunity(), id: 'a', title: 'Actual opening' }] }));
  await mount(<Career />); localStorage.setItem(key, '{damaged'); await click('Choose Actual opening');
  expect(localStorage.getItem(key)).toBe('{damaged'); expect(stored().comparisons![0].chosen).toBe('a');
  // Source becomes unreadable and disappears, but the independent original choice stays reviewable in Productivity.
  await reload(<ProductivityWorkspace />); expect(host.textContent).toContain('Personal choice: Actual opening');
  expect(shareWithAdvisor).not.toHaveBeenCalled();
});

it('refuses a stale productivity choice when another writer changes the actual decision', async () => {
  const d = newDecision('Live decision'); d.id = 'live'; d.options = [newOption('Live option')];
  localStorage.setItem(workKey(), JSON.stringify({ ...EMPTY_PRODUCTIVITY, decisions: [d] })); await mount(<ProductivityWorkspace />);
  await act(async () => { const select = host.querySelector<HTMLSelectElement>('[aria-label="Saved decisions"]')!; select.value = d.id; select.dispatchEvent(new Event('change', { bubbles: true })); });
  const changed = stored(); changed.decisions[0].questions = 'New official uncertainty'; localStorage.setItem(workKey(), JSON.stringify(changed));
  await click('Choose Live option'); expect(stored().decisions[0].questions).toBe('New official uncertainty');
  expect(stored().decisions[0].decided).toBe(false); expect(stored().comparisons).toBeUndefined();
});

it('changing the active term closes a career advisor draft and keeps the earlier term choice in its original scope', async () => {
  function TermChange() { const { dispatch } = useStore(); return <button onClick={() => dispatch({ type: 'setTerm', term: '2027SP' })}>Switch comparison term</button>; }
  const key = 'semester.career.v1:alice:2026FA';
  localStorage.setItem(key, JSON.stringify({ ...EMPTY_CAREER, opportunities: [{ ...newOpportunity(), id: 'a', title: 'Fall opening' }] }));
  await mount(<><Career /><TermChange /></>); await click('Choose Fall opening'); await click('Ask advisor'); await tick('Include Fall opening');
  await input(host.querySelector<HTMLTextAreaElement>('[aria-label="Advisor draft"]')!, 'UNSAVED FALL DRAFT');
  await click('Switch comparison term');
  expect(host.querySelector('[aria-label="Advisor draft"]')).toBeNull(); expect(host.textContent).not.toContain('Fall opening');
  expect(stored().comparisons![0].scope).toBe(key); expect(localStorage.getItem(meetingKey('alice'))).toBeNull();
});
