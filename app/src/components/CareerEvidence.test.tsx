// @vitest-environment jsdom
import { act, useEffect } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { AIProvider } from '../ai/store';
import { loadSeed } from '../data/seed';
import { EMPTY_CAREER, newOpportunity, type CareerLibrary } from '../lib/career';
import { EMPTY_PATHWAY } from '../lib/pathway';
import type { CourseModule } from '../lib/types';
import { Career } from '../screens/Career';
import { STORAGE_KEY } from '../state/shape';
import { StoreProvider, useStore } from '../state/store';
import { CourseHub } from './CourseHub';

/**
 * Phase I on screen. With `career_evidence` off, Career has no Evidence tab
 * and courses no skills panel (the control). With it on: skills wait for the
 * student's decision; bullets show only what was answered; a résumé opens in
 * Write only after its preview and lists confirmed skills only; a fair
 * contact reaches the tracker only when the student adds it; an interview
 * card appears for an application at that stage; and a course's own panel
 * shares the same decisions.
 */

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const KEY = 'semester.career.v1:device:2026FA';
const EVIDENCE_KEY = 'semester.career-evidence.v1:device:2026FA';
let host: HTMLDivElement;
let root: Root;

const ECON = {
  course: { id: 'econ', code: 'ECON 1010', name: 'Econometrics', prof: '', email: '', meets: '', room: '', credits: '', source: '', grading: [], term: '2026FA' },
  items: [],
  schedule: [],
  guide: { code: 'ECON 1010', name: 'Econometrics', blurb: 'Regression and statistics with a written research brief.', source: '', mastery: 0, audio: false, terms: [], units: [{ name: 'Regression', mastery: 0, cards: [] }] },
  planMinutes: '45 min',
  frameLabel: 'Frames',
} as unknown as CourseModule;

const CAREER: Partial<CareerLibrary> = {
  name: 'Sam Lee',
  contact: 'sam@school.edu',
  experiences: [{ id: 'e1', category: 'Experience', title: 'Research assistant', organization: 'Econ lab', dates: '2025–26', details: 'Survey data' }],
  opportunities: [{ ...newOpportunity(), id: 'fair1', title: 'Fall career fair', kind: 'Career event', deadline: '2026-10-08' }],
};

let seen: { documents: { title: string }[]; applications: { org: string; stage: string }[] } | null = null;
function Probe() {
  const { state } = useStore();
  useEffect(() => {
    seen = { documents: state.documents, applications: state.applications };
  });
  return null;
}

beforeAll(async () => {
  await loadSeed();
});

beforeEach(() => {
  window.location.hash = '';
  window.matchMedia = (() => ({ matches: false, addEventListener: () => {}, removeEventListener: () => {} })) as unknown as typeof window.matchMedia;
  localStorage.clear();
  localStorage.setItem(
    STORAGE_KEY,
    JSON.stringify({
      schemaVersion: 6,
      seenOnboarding: true,
      sample: false,
      term: '2026FA',
      courses: [ECON],
      applications: [{ id: 'a1', org: 'Acme', role: 'Analyst intern', kind: 'internship', url: '', where: '', due: '', rolling: false, stage: 'talking', next: '', nextBy: '', note: '', created: 1, moves: [] }],
    }),
  );
  localStorage.setItem(KEY, JSON.stringify({ ...EMPTY_CAREER, ...CAREER }));
  localStorage.setItem('semester.pathway.v1:device', JSON.stringify(EMPTY_PATHWAY));
  host = document.createElement('div');
  host.className = 'device';
  document.body.append(host);
  root = createRoot(host);
  seen = null;
});

afterEach(async () => {
  await act(async () => root.unmount());
  host.remove();
  localStorage.clear();
});

const render = async (node: React.ReactNode) => {
  await act(async () => root.render(<StoreProvider><AIProvider>{node}<Probe /></AIProvider></StoreProvider>));
};
const text = (el: ParentNode = host) => (el.textContent ?? '').replace(/\s+/g, ' ');
const button = (name: RegExp, within: ParentNode = host) => {
  const found = [...within.querySelectorAll('button, [role="tab"], [role="radio"]')].find((b) => name.test((b.textContent ?? '').trim())) as HTMLElement | undefined;
  if (!found) throw new Error(`No button ${name}: ${[...within.querySelectorAll('button')].map((b) => b.textContent).join(' | ')}`);
  return found;
};
const field = (label: RegExp) => [...host.querySelectorAll<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>('input, select, textarea')].find((i) => label.test(i.closest('label')?.textContent ?? ''))!;
const type = async (el: HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement, value: string) => {
  await act(async () => {
    const proto = el instanceof HTMLSelectElement ? HTMLSelectElement.prototype : el instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
    Object.getOwnPropertyDescriptor(proto, 'value')!.set!.call(el, value);
    el.dispatchEvent(new Event(el instanceof HTMLSelectElement ? 'change' : 'input', { bubbles: true }));
  });
};
const openEvidence = async (section?: RegExp) => {
  await render(<Career careerSkillsGraph careerEvidence />);
  await act(async () => button(/^Evidence$/).click());
  if (section) await act(async () => button(section, host.querySelector('.career-evidence')!).click());
};
const stored = () => JSON.parse(localStorage.getItem(EVIDENCE_KEY) ?? 'null');

describe('with career_evidence off', () => {
  it('has no Evidence tab and no course skills panel', async () => {
    await render(<Career careerSkillsGraph careerEvidence={false} />);
    expect(() => button(/^Evidence$/)).toThrow();
    await render(<CourseHub course={ECON.course} information={null} readiness={false} locker={false} careerEvidence={false} />);
    expect(host.querySelector('.course-skills')).toBeNull();
  });
});

describe('with career_evidence on', () => {
  it('leaves every suggested skill unconfirmed until the student decides', async () => {
    await openEvidence();
    const rows = [...host.querySelectorAll('.evidence-list > li')];
    expect(rows.length).toBeGreaterThan(0);
    expect(rows.every((r) => r.getAttribute('data-state') === 'suggested')).toBe(true);
    await act(async () => button(/^Confirm$/, rows[0]).click());
    const decided = Object.values(stored().decisions) as { status: string }[];
    expect(decided).toEqual([expect.objectContaining({ status: 'confirmed' })]);
  });

  it('builds a bullet from the answers only, and names what is left out', async () => {
    await openEvidence(/^Bullets$/);
    await type(field(/^Entry/), 'e1');
    await type(field(/^What did you do\?/), 'cleaned three years of survey data');
    await type(field(/^What tools or methods/), 'Stata');
    expect(host.querySelector('.evidence-preview')?.textContent).toBe('Cleaned three years of survey data using Stata.');
    expect(text()).toContain('Left out until you answer: How many people did this affect? · What was the outcome? Semester never fills these in.');
    await act(async () => (field(/^Finished/) as HTMLInputElement).click());
    await act(async () => button(/^Save bullet$/).click());
    expect(stored().bullets).toEqual([expect.objectContaining({ experienceId: 'e1', people: '', outcome: '', final: true })]);
  });

  it('opens a résumé in Write only after its preview, with confirmed skills only', async () => {
    localStorage.setItem(EVIDENCE_KEY, JSON.stringify({
      version: 1,
      decisions: { 'data-analysis': { status: 'confirmed', name: 'Data analysis', at: 1 }, writing: { status: 'rejected', name: 'Writing', at: 1 } },
      own: [], artifacts: [], versions: [], interviewDone: {}, fairs: {},
      bullets: [{ id: 'b1', experienceId: 'e1', did: 'cleaned survey data', people: '', tools: 'Stata', outcome: '', final: true, updated: 1 }],
    }));
    await openEvidence(/^Résumé versions$/);
    await type(field(/^Version name/), 'Research roles');
    const before = seen!.documents.length;
    await act(async () => button(/^Preview and open in Write…$/).click());
    expect(seen!.documents.length).toBe(before);
    const dialog = [...host.querySelectorAll('[role="dialog"]')].find((d) => d.classList.contains('dialog'))!;
    const preview = text(dialog);
    expect(preview).toContain('- Cleaned survey data using Stata.');
    expect(preview).toContain('## Skills Data analysis');
    expect(preview).not.toContain('Writing');
    expect(preview).not.toContain('Research ·');
    expect(preview).toContain('Nothing is sent anywhere.');
    expect(document.activeElement?.textContent).toBe('Cancel');
    await act(async () => button(/^Open in Write$/).click());
    expect(seen!.documents.length).toBe(before + 1);
    expect(seen!.documents[0].title).toBe('Research roles — résumé');
  });

  it('adds a fair contact to the tracker only when the student does', async () => {
    await openEvidence(/^Fair plans$/);
    await type(field(/^Employer/), 'Acme Analytics');
    await act(async () => button(/^Add employer$/).click());
    const before = seen!.applications.length;
    const visited = [...host.querySelectorAll<HTMLInputElement>('.evidence-list input[type="checkbox"]')][0];
    await act(async () => visited.click());
    expect(seen!.applications.length).toBe(before);
    await act(async () => button(/^Add to my tracker$/).click());
    expect(seen!.applications.length).toBe(before + 1);
    expect(seen!.applications.find((a) => a.org === 'Acme Analytics')).toMatchObject({ stage: 'found' });
    expect(text()).toContain('Semester does not apply anywhere.');
  });

  it('shows an interview card for an application at that stage, and keeps its ticks', async () => {
    await openEvidence(/^Interviews$/);
    const card = host.querySelector('[aria-label="Interview: Analyst intern · Acme"]')!;
    expect(card).not.toBeNull();
    const first = card.querySelector<HTMLInputElement>('input[type="checkbox"]')!;
    await act(async () => first.click());
    expect(stored().interviewDone.a1).toEqual(['stories']);
  });

  it('shows a course’s suggested skills on its overview, sharing the same decisions', async () => {
    await render(<CourseHub course={ECON.course} information={null} readiness={false} locker={false} careerEvidence />);
    const panel = host.querySelector('.course-skills')!;
    expect(text(panel)).toContain('only confirmed skills reach your résumé.');
    await act(async () => button(/^Reject$/, panel).click());
    expect(Object.values(stored().decisions)).toContainEqual(expect.objectContaining({ status: 'rejected' }));
  });
});
