// @vitest-environment jsdom
import { act, useEffect } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { loadSeed } from '../data/seed';
import { LOCKER_KEY } from '../lib/source-locker';
import { READINESS_KEY } from '../lib/study-readiness';
import type { CourseModule } from '../lib/types';
import { STORAGE_KEY } from '../state/shape';
import { StoreProvider, useStore } from '../state/store';
import { AIProvider } from '../ai/store';

const trashed: string[] = [];
const FILES = [
  { id: 'f1', name: 'reading-7.pdf', type: 'application/pdf', size: 10, added: Date.parse('2026-09-20T12:00:00Z'), courseId: 'econ', trashedAt: null, folderId: null, starred: false, openedAt: null, itemId: null },
];
vi.mock('../lib/clips', async (importOriginal) => ({ ...(await importOriginal<typeof import('../lib/clips')>()), useFiles: () => FILES }));
vi.mock('../lib/files', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../lib/files')>()),
  trashFile: vi.fn(async (id: string) => {
    trashed.push(id);
  }),
  openFile: vi.fn(async () => true),
}));

const { CourseHub } = await import('./CourseHub');
const { SourceLocker } = await import('./SourceLocker');
const { StudyReadiness } = await import('./StudyReadiness');
const { StudyStudio } = await import('./StudyStudio');

/**
 * Phase H on screen: the course hub's two new tabs only with their flags; the
 * Source Locker listing materials, removing one only after showing what
 * depends on it (generated items kept unless ticked, notes kept always), and
 * the AI switch that Study Studio obeys; Study Readiness keeping the student's
 * marks and suggesting one session without predicting anything.
 */

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let host: HTMLDivElement;
let root: Root;

const ECON = (ai: 'allowed' | 'banned' = 'allowed'): CourseModule =>
  ({
    course: { id: 'econ', code: 'ECON 1010', name: 'Econ', prof: '', email: '', meets: '', room: '', credits: '', source: 'syllabus.pdf', grading: [], term: '2026FA', ai: { stance: ai, note: '' } },
    items: [{ id: 'mid', c: 'econ', title: 'Midterm', kind: 'Exam', month: 9, day: 20, year: 2026, dueTime: '', weight: '25%', where: '', detail: '', quote: '', source: '', checked: { confirmed: true } }],
    schedule: [],
    guide: {
      code: 'ECON 1010', name: 'Econ', blurb: '', source: '', mastery: 0, audio: false, terms: [],
      units: [
        { name: 'Supply', mastery: 0, cards: [{ q: 'What shifts supply?', a: 'Costs' }] },
        { name: 'Demand', mastery: 0, cards: [{ q: 'What shifts demand?', a: 'Tastes' }, { q: 'Law of demand?', a: 'Down' }] },
      ],
    },
    planMinutes: '45 min',
    frameLabel: 'Frames',
  }) as unknown as CourseModule;

let seen: { updates: { id: string }[]; notes: { id: string; fileIds: string[] }[]; documents: { id: string }[]; sources: { id: string }[] } | null = null;
function Probe() {
  const { state } = useStore();
  useEffect(() => {
    seen = { updates: state.updates, notes: state.notes, documents: state.documents, sources: state.sources };
  });
  return null;
}

const seed = (ai: 'allowed' | 'banned' = 'allowed') =>
  localStorage.setItem(
    STORAGE_KEY,
    JSON.stringify({
      schemaVersion: 6,
      seenOnboarding: true,
      sample: false,
      courses: [ECON(ai)],
      updates: [{ id: 'u1', courseId: 'econ', unit: 0, title: 'Reading 7 notes', source: 'Reading 7', body: 'Supply shifts with costs.', cards: [{ q: 'q', a: 'a' }], terms: [], fileIds: ['f1'], created: Date.parse('2026-09-21T12:00:00Z') }],
      notes: [{ id: 'n1', title: 'Lecture 4', body: 'my words', created: 1, updated: 1, courseId: 'econ', itemId: null, fileIds: ['f1'] }],
      documents: [{ id: 'd1', title: 'ECON 1010 · Study guide', subtitle: '', courseId: 'econ', blocks: [], created: 1, updated: 1 }],
      sources: [{ id: 'r1', raw: 'Smith 2020', author: 'Smith', year: '2020', title: 'Markets', container: '', url: 'https://doi.org/10.1/x', role: '', courseId: 'econ', project: '', created: 1 }],
    }),
  );

beforeAll(async () => {
  await loadSeed();
});

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date(2026, 8, 27, 10, 0));
  window.location.hash = '';
  window.matchMedia = (() => ({ matches: false, addEventListener: () => {}, removeEventListener: () => {} })) as unknown as typeof window.matchMedia;
  localStorage.clear();
  seed();
  localStorage.setItem(LOCKER_KEY, JSON.stringify({ version: 1, aiBlocked: [], built: [{ asset: { kind: 'document', id: 'd1' }, materials: ['material:u1'], at: 1 }] }));
  host = document.createElement('div');
  host.className = 'device';
  document.body.append(host);
  root = createRoot(host);
  trashed.length = 0;
  seen = null;
});

afterEach(async () => {
  await act(async () => root.unmount());
  host.remove();
  localStorage.clear();
  vi.useRealTimers();
});

const render = async (node: React.ReactNode) => {
  await act(async () => root.render(<StoreProvider><AIProvider>{node}<Probe /></AIProvider></StoreProvider>));
};
const course = () => ECON().course;
const text = (el: ParentNode = host) => (el.textContent ?? '').replace(/\s+/g, ' ');
const button = (name: RegExp, within: ParentNode = host) => {
  const found = [...within.querySelectorAll('button')].find((b) => name.test((b.textContent ?? '').trim()));
  if (!found) throw new Error(`No button ${name}: ${[...within.querySelectorAll('button')].map((b) => b.textContent).join(' | ')}`);
  return found;
};
const row = (title: string) => [...host.querySelectorAll('.locker-list > li')].find((li) => li.querySelector('.locker-head strong')?.textContent === title)!;
const dialog = () => [...host.querySelectorAll('[role="dialog"]')].find((d) => d.classList.contains('dialog'))!;

describe('the course hub', () => {
  it('has neither tab with the flags off, and both with them on', async () => {
    const tabs = () => [...host.querySelectorAll('[role="tab"]')].map((t) => t.textContent);
    await render(<CourseHub course={course()} information={null} readiness={false} locker={false} />);
    expect(tabs()).not.toContain('Readiness');
    expect(tabs()).not.toContain('Sources');
    await render(<CourseHub course={course()} information={null} readiness locker />);
    expect(tabs()).toEqual(expect.arrayContaining(['Readiness', 'Sources']));
  });
});

describe('the Source Locker', () => {
  it('lists every material with its type, date, where it is, what uses it and its label', async () => {
    await render(<SourceLocker course={course()} />);
    expect([...host.querySelectorAll('.locker-head strong')].map((s) => s.textContent)).toEqual(['syllabus.pdf', 'reading-7.pdf', 'Reading 7 notes', 'Markets']);
    const file = row('reading-7.pdf');
    expect(text(file)).toContain('TypePDF upload');
    expect(text(file)).toContain('WhereOn this device');
    expect(text(file)).toContain('Reading 7 notes (Added material read from it: 1 cards, 0 terms)');
    expect(text(file)).toContain('ECON 1010 · Study guide (Study guide built from material read from it)');
    expect(text(file)).toContain('Note: Lecture 4');
    expect(file.querySelector('[data-source]')?.getAttribute('data-source')).toBe('imported');
    expect(text(row('syllabus.pdf'))).toContain('Remove the course from Courses');
    expect(() => button(/^Remove…$/, row('syllabus.pdf'))).toThrow();
  });

  it('removes a file only after showing its dependents — keeping generated items unless ticked, and notes always', async () => {
    await render(<SourceLocker course={course()} />);
    await act(async () => button(/^Remove…$/, row('reading-7.pdf')).click());
    const d = text(dialog());
    expect(d).toContain('stays for 30 days');
    expect(d).toContain('It is detached from Lecture 4. The note is kept.');
    expect(d).not.toContain('checked against it'); // no deadline cites this file
    expect(d).toContain('Reading 7 notes — Added material read from it');
    expect(d).toContain('ECON 1010 · Study guide');
    expect(document.activeElement?.textContent).toBe('Cancel');
    expect(trashed).toEqual([]);
    await act(async () => button(/^Remove$/).click());
    expect(trashed).toEqual(['f1']);
    expect(seen!.updates.map((u) => u.id)).toEqual(['u1']);
    expect(seen!.documents.map((x) => x.id)).toEqual(['d1']);
    expect(seen!.notes).toEqual([expect.objectContaining({ id: 'n1', fileIds: [] })]);
  });

  it('deletes the generated items too when the student ticks it', async () => {
    await render(<SourceLocker course={course()} />);
    await act(async () => button(/^Remove…$/, row('reading-7.pdf')).click());
    const tick = dialog().querySelector<HTMLInputElement>('input[type="checkbox"]')!;
    await act(async () => tick.click());
    await act(async () => button(/^Remove$/).click());
    expect(seen!.updates).toEqual([]);
    expect(seen!.documents).toEqual([]);
    expect(seen!.notes.map((n) => n.id)).toEqual(['n1']);
    expect(text()).toContain('2 generated items were deleted.');
  });

  it('changes nothing when the file cannot be moved to the trash', async () => {
    const files = await import('../lib/files');
    vi.mocked(files.trashFile).mockRejectedValueOnce(new Error('Storage is unavailable.'));
    await render(<SourceLocker course={course()} />);
    const before = { updates: seen!.updates.length, documents: seen!.documents.length };
    await act(async () => button(/^Remove…$/, row('reading-7.pdf')).click());
    const tick = dialog().querySelector<HTMLInputElement>('input[type="checkbox"]')!;
    await act(async () => tick.click());
    await act(async () => button(/^Remove$/).click());
    expect(seen!.updates.length).toBe(before.updates);
    expect(seen!.documents.length).toBe(before.documents);
    expect(text()).toContain('could not be removed, so nothing was changed.');
  });

  it('turns AI use off per material, and Study Studio then leaves it out', async () => {
    await render(<SourceLocker course={course()} />);
    const ai = [...row('Reading 7 notes').querySelectorAll<HTMLInputElement>('input[type="checkbox"]')][0];
    expect(ai.checked).toBe(true);
    await act(async () => ai.click());
    expect(JSON.parse(localStorage.getItem(LOCKER_KEY)!).aiBlocked).toEqual(['material:u1']);

    await render(<StudyStudio courseId="econ" onClose={() => {}} sourceLocker adaptiveLearning={false} />);
    const offered = [...host.querySelectorAll('.study-source-list input')].map((i) => i.getAttribute('aria-label'));
    expect(offered).not.toContain('Reading 7 notes');
    expect(offered).toContain('Supply');
    expect(text()).toContain('1 source is hidden because you turned off AI use for it in the Source locker.');

    await render(<StudyStudio courseId="econ" onClose={() => {}} sourceLocker={false} adaptiveLearning={false} />);
    expect([...host.querySelectorAll('.study-source-list input')].map((i) => i.getAttribute('aria-label'))).toContain('Reading 7 notes');
  });

  it('records which materials a saved study guide was built from', async () => {
    localStorage.setItem('semester.drafts', JSON.stringify({ 'study-studio:guide:2026FA:econ': { text: '# Supply\n\nCosts shift supply.', at: Date.now() } }));
    const state = JSON.parse(localStorage.getItem(STORAGE_KEY)!);
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...state, term: '2026FA' }));
    await render(<StudyStudio courseId="econ" onClose={() => {}} sourceLocker adaptiveLearning={false} />);
    const pick = (label: string) => host.querySelector<HTMLInputElement>(`.study-source-list input[aria-label="${label}"]`)!;
    await act(async () => pick('Supply').click());
    await act(async () => pick('Reading 7 notes').click());
    await act(async () => button(/^Save & open in Write$/).click());
    const made = seen!.documents.find((d) => d.id !== 'd1')!;
    expect(JSON.parse(localStorage.getItem(LOCKER_KEY)!).built[0]).toMatchObject({
      asset: { kind: 'document', id: made.id },
      materials: ['syllabus:econ', 'material:u1'],
    });
  });

  it('locks every AI switch when the course policy bans AI', async () => {
    localStorage.clear();
    seed('banned');
    await render(<SourceLocker course={ECON('banned').course} />);
    const switches = [...host.querySelectorAll<HTMLInputElement>('.locker-list input[type="checkbox"]')];
    expect(switches.length).toBe(4);
    expect(switches.every((s) => s.disabled && !s.checked)).toBe(true);
    expect(text()).toContain('not allowed by the course policy');
  });

  it('opens a reading link only after saying Semester cannot see it', async () => {
    const opened = vi.spyOn(window, 'open').mockReturnValue(null);
    await render(<SourceLocker course={course()} />);
    await act(async () => button(/^Open$/, row('Markets')).click());
    expect(text()).toContain('You are leaving Semester');
    expect(opened).not.toHaveBeenCalled();
    await act(async () => button(/^Open link$/).click());
    expect(opened).toHaveBeenCalledWith('https://doi.org/10.1/x', '_blank', 'noopener,noreferrer');
    opened.mockRestore();
  });
});

describe('Study Readiness', () => {
  it('keeps the student’s marks, suggests one session, and predicts nothing', async () => {
    await render(<StudyReadiness course={course()} />);
    expect(text()).toContain('Midterm');
    expect(text()).toContain('Next: a 25-minute session');
    const topics = [...host.querySelectorAll('.readiness-topics > li')];
    expect(topics.map((t) => t.querySelector('strong')?.textContent)).toEqual(['Supply', 'Demand']);
    const status = topics[0].querySelector<HTMLSelectElement>('select')!;
    await act(async () => {
      status.value = 'needs_review';
      status.dispatchEvent(new Event('change', { bubbles: true }));
    });
    expect(JSON.parse(localStorage.getItem(READINESS_KEY)!).byItem.mid.topics['0'].status).toBe('needs_review');
    expect(text(host.querySelector('.readiness-next')!)).toContain('You marked Supply as needing review.');
    expect(text(topics[0])).toContain('Reading 7 notes — Added material · Reading 7');
    expect(text()).not.toMatch(/predicted|likely grade|chance of|percentile|rank|compared with other/i);
    expect(text()).toContain('not a forecast of your result');
  });
});
