// @vitest-environment jsdom
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, useEffect, type ReactNode } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { StoreProvider, useStore } from '../../state/store';
import { loadSeed } from '../../data/seed';
import { STORAGE_KEY, type State } from '../../state/shape';
import { closeOverlay } from '../../lib/unity';
import { REGISTRATION_DAY_KEY, CHECKLIST, EMPTY_REGISTRATION_DAY } from '../../lib/registration-day';
import { GRADUATION_KEY } from '../../lib/graduation';
import { ARCHIVED_LINE } from '../../lib/rollover';
import { EMPTY_CAREER, newOpportunity } from '../../lib/career';
import { EMPTY_PATHWAY, newProgram } from '../../lib/pathway';
import type { CatalogCourse } from '../../lib/registration';
import { UnityLayer } from './UnityLayer';
import { RegistrationDay } from '../RegistrationDay';
import { GraduationSimulator } from '../GraduationSimulator';
import { CloseTerm } from '../CloseTerm';
import { Career } from '../../screens/Career';
import { Pathway } from '../../screens/Pathway';
import { Degree } from '../../screens/Degree';
import { University } from '../../screens/University';

/**
 * The shared components on the screens they were placed on — each mounted for
 * real, inside the store, and read the way a student would read it.
 */

const gateway = vi.hoisted(() => ({ status: vi.fn(), records: vi.fn() }));
vi.mock('../../lib/university', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  gatewayConfigured: true,
  institutionStatus: gateway.status,
  institutionRecords: gateway.records,
}));

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let host: HTMLDivElement;
let root: Root;
let seen: State;

function Probe() {
  const { state } = useStore();
  useEffect(() => {
    seen = state;
  });
  return null;
}

beforeAll(async () => {
  window.matchMedia = (() => ({
    matches: false,
    addEventListener: () => {},
    removeEventListener: () => {},
  })) as unknown as typeof window.matchMedia;
  await loadSeed();
});

beforeEach(async () => {
  localStorage.clear();
  sessionStorage.clear();
  localStorage.setItem(STORAGE_KEY, JSON.stringify({ schemaVersion: 6 }));
  host = document.createElement('div');
  document.body.append(host);
  await act(async () => {
    root = createRoot(host);
  });
});

afterEach(async () => {
  await act(async () => closeOverlay());
  await act(async () => root.unmount());
  host.remove();
  localStorage.clear();
  sessionStorage.clear();
});

async function mount(node: ReactNode) {
  await act(async () => {
    root.render(
      <StoreProvider>
        <Probe />
        {node}
        <UnityLayer />
      </StoreProvider>,
    );
  });
}

const text = () => (host.textContent ?? '').replace(/\s+/g, ' ');
const buttons = (label: string) => [...host.querySelectorAll('button')].filter((b) => (b.textContent ?? '').trim() === label);
const button = (label: string): HTMLButtonElement => {
  const found = buttons(label)[0];
  if (!found) throw new Error(`no button "${label}" in: ${text()}`);
  return found;
};
const press = (label: string) => act(async () => button(label).click());
/** A NextSteps entry by its label — its button also carries the why. */
const step = (label: string): HTMLButtonElement => {
  const found = [...host.querySelectorAll('button.next-step')].find(
    (b) => b.querySelector('.next-step-label')?.textContent === label,
  );
  if (!found) throw new Error(`no next step "${label}" in: ${text()}`);
  return found as HTMLButtonElement;
};

const course = (id: string, patch: Partial<CatalogCourse> = {}): CatalogCourse => ({
  id,
  code: 'CS 101',
  section: '01',
  title: 'Programming',
  term: 'Spring 2027',
  department: 'CS',
  credits: 3,
  instructor: '',
  location: '',
  description: '',
  prerequisites: '',
  seats: 10,
  meetings: [{ days: [1, 3], start: 540, end: 590 }],
  ...patch,
});
const cs1 = course('cs1');
const cs2 = course('cs2', { section: '02', meetings: [{ days: [2, 4], start: 540, end: 615 }] });

describe('the recovery-copy error', () => {
  it('is an announced ErrorState with the download as its recovery, on registration day', async () => {
    localStorage.setItem(REGISTRATION_DAY_KEY, 'not json at all');
    await mount(<RegistrationDay catalog={[cs1, cs2]} cart={[cs1]} institution={null} onOpenCart={() => {}} />);
    const alert = host.querySelector('.state-error[role="alert"]');
    expect(alert?.textContent).toContain('Could not save on this device');
    expect(alert?.querySelector('button')?.textContent).toBe('Download recovery copy');
    // The pinned promises are still on the screen.
    expect(text()).toContain('Semester never registers for you.');
    expect(text()).toContain('not live');
  });

  it('is the same ErrorState in the graduation simulator', async () => {
    localStorage.setItem(GRADUATION_KEY, 'not json at all');
    await mount(<GraduationSimulator done={60} />);
    const alert = host.querySelector('.state-error[role="alert"]');
    expect(alert?.textContent).toContain('Could not save on this device');
    expect(buttons('Download recovery copy')).toHaveLength(1);
  });
});

describe('registration day', () => {
  it('acknowledges a finished checklist and offers only steps it does not already show', async () => {
    localStorage.setItem(
      REGISTRATION_DAY_KEY,
      JSON.stringify({
        ...EMPTY_REGISTRATION_DAY,
        opensAt: '2027-04-03T08:00',
        checks: CHECKLIST.map((c) => c.id),
        backups: { cs1: ['cs2'] },
      }),
    );
    let opened = 0;
    await mount(<RegistrationDay catalog={[cs1, cs2]} cart={[cs1]} institution="Example University" onOpenCart={() => opened++} />);
    const done = host.querySelector('.state-success');
    expect(done?.textContent).toContain('Your registration checklist is complete');
    expect(done?.textContent).toContain('Example University’s registration system');
    const next = host.querySelector('section.next-steps')!;
    const offered = [...next.querySelectorAll('.next-step-label')].map((l) => l.textContent);
    // Copy is the button beside the list, and every section has a backup.
    expect(offered).toEqual(['Open cart']);
    await act(async () => next.querySelector('button')!.click());
    expect(opened).toBe(1);
  });

  it('says nothing is complete while it is not, and points at the missing backups', async () => {
    await mount(<RegistrationDay catalog={[cs1, cs2]} cart={[cs1]} institution={null} onOpenCart={() => {}} />);
    expect(host.querySelector('.state-success')).toBeNull();
    await act(async () => step('Add backups').click());
    expect(document.activeElement?.getAttribute('aria-label')).toBe('Add a backup for CS 101 section 01');
  });
});

describe('closing a term', () => {
  it('says the term is closed, keeps the archived line, and offers the record and the next import', async () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ schemaVersion: 6, term: '2026FA', archivedTerms: ['2026FA'] }));
    await mount(<CloseTerm />);
    const done = host.querySelector('.state-success')!;
    expect(done.querySelector('.state-title')?.textContent).toMatch(/Fall 2026 is closed$/);
    expect(text()).toContain(ARCHIVED_LINE);
    await act(async () => step('See your record').click());
    expect(seen.screen).toBe('degree');
    await act(async () => step('Import next term’s syllabus').click());
    expect(seen.screen).toBe('import');
  });
});

describe('an opportunity in Career', () => {
  it('is an ObjectCard with Track it first, Save beside it, and letter and edit after', async () => {
    const job = { ...newOpportunity(), id: 'job', title: 'Summer analyst', organization: 'Acme', deadline: '2026-11-01' };
    localStorage.setItem('semester.career.v1:device:2026FA', JSON.stringify({ ...EMPTY_CAREER, opportunities: [job] }));
    await mount(<Career careerSkillsGraph />);
    const card = [...host.querySelectorAll('[style*="auto-fit"] > button')].find(
      (b) => b.querySelector('span')?.textContent?.trim() === 'Summer analyst',
    )!;
    await act(async () => card.dispatchEvent(new MouseEvent('click', { bubbles: true })));
    const object = host.querySelector('article.object-card[data-kind="opportunity"]')!;
    expect(object.querySelector('h2')?.textContent).toBe('Summer analyst');
    expect(object.textContent).toContain('Opportunity · Yours');
    expect(object.textContent).toContain('Acme');
    expect(object.textContent).toContain('Due 2026-11-01');
    expect(object.textContent).not.toContain('Official');
    expect(text()).toContain('You entered this');
    expect(buttons('Draft a letter')).toHaveLength(1);
    expect(buttons('Edit')).toHaveLength(1);

    await press('Save');
    expect(JSON.parse(localStorage.getItem('semester.career.v1:device:2026FA')!).opportunities[0].saved).toBe(true);
    expect(buttons('Unsave')).toHaveLength(1);

    await press('Track it');
    expect(seen.applications.some((a) => a.role === 'Summer analyst' && a.org === 'Acme')).toBe(true);
    expect(text()).toContain('Nothing has been applied for.');
  });
});

describe('a programme in Pathway', () => {
  it('is headed by a ContextBar that says it is yours and unconfirmed, with Edit as its one primary', async () => {
    const program = { ...newProgram(), school: 'Example A', program: 'Biology', url: 'example.edu/bio' };
    localStorage.setItem('semester.pathway.v1:device', JSON.stringify({ ...EMPTY_PATHWAY, programs: [program] }));
    await mount(<Pathway />);
    await press('Programs');
    const card = [...host.querySelectorAll('[style*="auto-fit"] > button')].find(
      (b) => b.querySelector('span')?.textContent?.trim() === 'Example A',
    )!;
    await act(async () => card.dispatchEvent(new MouseEvent('click', { bubbles: true })));
    const bar = host.querySelector('section.context-bar')!;
    expect(bar.getAttribute('aria-label')).toBe('Example A: Biology');
    expect(bar.querySelector('h2')?.textContent).toBe('Biology');
    expect(bar.textContent).toContain('Yours');
    expect(bar.textContent).toContain('Needs confirmation');
    expect(text()).toContain(`You recorded: ${program.status}`);
    expect(buttons('Edit')).toHaveLength(1);

    const opened = vi.spyOn(window, 'open').mockReturnValue(null);
    await press('Source & details');
    await press('Open the source you recorded ↗');
    expect(opened).toHaveBeenCalledWith('https://example.edu/bio', '_blank', 'noopener,noreferrer');
    opened.mockRestore();
  });
});

describe('the degree screen', () => {
  /*
   * In the one trust vocabulary (constitution §7), not the status chips'.
   * It said "Yours" and "Needs confirmation" here while Grades and the
   * assistant's answers said "Student entered" and "Estimated" for the same
   * kinds of fact.
   */
  it('marks its figures as student entered and estimated, and keeps the sentence', async () => {
    await mount(<Degree />);
    // The degree section's own badges. The Path Snapshot card on the same
    // screen (BL-1.6) labels its own figures, and is held to that in its test.
    const badges = [...host.querySelectorAll('.context-bar-states [data-source]')].map((b) => b.getAttribute('data-source'));
    expect(badges).toEqual(['student_entered', 'estimated']);
    expect(host.querySelectorAll('.status-chip')).toHaveLength(0);
    expect(text()).toContain('Your arithmetic, not the registrar’s');
    expect(text()).toContain('This app ships no degree requirements');
  });
});

describe('school records in University', () => {
  it('are connected task cards, with the first action as primary only when writing is allowed', async () => {
    gateway.status.mockResolvedValue({
      version: 1,
      institutionId: 'school',
      institutionName: 'Test school',
      roles: ['student'],
      connections: [
        { area: 'courses', state: 'connected', provider: 'Fixture LMS', canRead: true, canWrite: true, lastSyncAt: null, permissions: [], message: '' },
      ],
    });
    gateway.records.mockResolvedValue({
      records: [
        {
          id: 'course',
          area: 'courses',
          title: 'Test course',
          summary: 'Record fixture',
          status: 'Ready',
          version: '1',
          updatedAt: '2026-09-13T12:00:00Z',
          details: [{ label: 'Credits', value: '3' }],
          actions: [
            { id: 'acknowledge', label: 'Acknowledge course policy', fields: [] },
            { id: 'drop', label: 'Request a drop', fields: [] },
          ],
        },
      ],
      nextCursor: null,
      fetchedAt: '2026-09-13T12:00:00Z',
    });
    await mount(<University />);
    await press('Connections');
    await press('Check school access');
    await press('Records');
    await act(async () => host.querySelector('form')!.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })));
    const card = host.querySelector('article.object-card[data-kind="task"]')!;
    expect(card.textContent).toContain('Task · Connected');
    expect(card.textContent).not.toContain('Official');
    expect(card.querySelector('.object-card-meta')?.textContent).toBe('Ready · Credits: 3');
    expect(card.querySelector('.btn-primary')?.textContent).toBe('Acknowledge course policy');
    // The second action stays, once, as a button after the card.
    expect(buttons('Request a drop')).toHaveLength(1);
    expect(card.contains(button('Request a drop'))).toBe(false);
  });
});
