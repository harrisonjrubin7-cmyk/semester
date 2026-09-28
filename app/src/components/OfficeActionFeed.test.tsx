// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { loadSeed } from '../data/seed';
import { readOfficeActions, type OfficeAction } from '../lib/office-actions';
import type { DeskRow, PublishScope } from '../lib/office-actions-remote';
import { STORAGE_KEY } from '../state/shape';
import { StoreProvider } from '../state/store';

/**
 * Phase J on screen, with the database's side mocked (the database's own
 * rules are `supabase/officeactions.check.sql`). With `office_action_feed`
 * off, Key dates and Today show nothing of it (the control). With it on:
 * signed out asks to sign in; each card carries its office, source and
 * reason; the official page, marking done and saving what applies each wait
 * for a confirmation that says exactly what happens; the office desk appears
 * only for an account the server says may publish, never offers approving
 * your own, and prints no count below ten; and the Action Center ranks an
 * office action like any other.
 */

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const row = (over: Record<string, unknown> = {}) => ({
  id: 'a1',
  office: 'financial_aid',
  office_label: 'Financial Aid',
  action_type: 'aid',
  audience_kind: 'tenant',
  target_program: null,
  target_eligibility: null,
  title: 'FAFSA verification documents are due October 15',
  why_it_matters: 'This may affect aid processing.',
  due_at: '2026-10-15T23:59:00Z',
  official_url: 'https://aid.school.edu/verification',
  source_note: 'Financial Aid verification checklist',
  updated_at: new Date().toISOString(),
  published_at: new Date().toISOString(),
  done_at: null,
  ...over,
});

let feed: OfficeAction[] = [];
let feedError: string | null = null;
let scopes: PublishScope[] = [];
let desk: DeskRow[] = [];
const marked: { id: string; done: boolean }[] = [];
const audienceWrites: { kind: string; value: string; on: boolean }[] = [];
const moves: { id: string; step: string }[] = [];

vi.mock('../lib/office-actions-remote', async (importOriginal) => {
  const real = await importOriginal<typeof import('../lib/office-actions-remote')>();
  return {
    ...real,
    myOfficeActions: vi.fn(async () => {
      if (feedError) throw new Error(feedError);
      return feed;
    }),
    markDone: vi.fn(async (_user: string, id: string, done: boolean) => {
      marked.push({ id, done });
    }),
    myAudiences: vi.fn(async () => ({ programs: [], eligibility: [] })),
    publishedPrograms: vi.fn(async () => ['school/economics']),
    setAudience: vi.fn(async (_user: string, kind: string, value: string, on: boolean) => {
      audienceWrites.push({ kind, value, on });
    }),
    myPublishScopes: vi.fn(async () => scopes),
    deskActions: vi.fn(async () => desk),
    saveDraft: vi.fn(async () => 'new'),
    moveAction: vi.fn(async (id: string, step: string) => {
      moves.push({ id, step });
      return 'published';
    }),
  };
});

const { OfficeActionFeed } = await import('./OfficeActionFeed');
const { OfficeActionDesk } = await import('./OfficeActionDesk');
const { TodayActionCenter } = await import('./TodayActionCenter');
const { TodayDecisionSurface } = await import('./TodayDecisionSurface');
const { Registrar } = await import('../screens/Registrar');

let host: HTMLDivElement;
let root: Root;

beforeAll(async () => {
  await loadSeed();
});

beforeEach(() => {
  window.location.hash = '';
  window.matchMedia = (() => ({ matches: false, addEventListener: () => {}, removeEventListener: () => {} })) as unknown as typeof window.matchMedia;
  localStorage.clear();
  localStorage.setItem(STORAGE_KEY, JSON.stringify({ schemaVersion: 6, seenOnboarding: true, sample: false, term: '2026FA', courses: [] }));
  feed = readOfficeActions([row()]);
  feedError = null;
  scopes = [];
  desk = [];
  marked.length = 0;
  audienceWrites.length = 0;
  moves.length = 0;
  host = document.createElement('div');
  host.className = 'device';
  document.body.append(host);
  root = createRoot(host);
});

afterEach(async () => {
  await act(async () => root.unmount());
  host.remove();
  localStorage.clear();
  vi.restoreAllMocks();
});

const render = async (node: React.ReactNode) => {
  await act(async () => root.render(<StoreProvider>{node}</StoreProvider>));
  // The fetches resolve on the next turns.
  await act(async () => {
    await new Promise((r) => setTimeout(r, 0));
  });
};
// A lazy chunk and a fetch. Waits for `ready`, up to two seconds; without
// one, waits a fixed few turns.
const settle = async (ready?: () => boolean) => {
  const until = Date.now() + 2000;
  for (let i = 0; ready ? !ready() && Date.now() < until : i < 5; i += 1) {
    await act(async () => {
      await new Promise((r) => setTimeout(r, 10));
    });
  }
};
const text = (el: ParentNode = document.body) => (el.textContent ?? '').replace(/\s+/g, ' ');
const button = (name: RegExp, within: ParentNode = document.body) => {
  const found = [...within.querySelectorAll('button')].find((b) => name.test((b.textContent ?? '').trim()));
  if (!found) throw new Error(`No button ${name}: ${[...within.querySelectorAll('button')].map((b) => b.textContent).join(' | ')}`);
  return found;
};
const dialog = () => [...document.querySelectorAll('[role="dialog"]')].find((d) => d.classList.contains('dialog')) ?? null;

describe('with office_action_feed off', () => {
  it('shows nothing on Key dates or Today', async () => {
    await render(<Registrar officeActions={false} />);
    expect(host.querySelector('.office-feed')).toBeNull();
    expect(text()).not.toContain('From campus offices');
    await render(<TodayDecisionSurface actionCenter={false} registrationDay={false} crunchWeek={false} officeActions={false} officeAccountId="u1" />);
    // Waits the same way as the control below, so a card that should not be
    // here has every chance to arrive.
    await settle(() => host.querySelector('.office-today') !== null);
    expect(host.querySelector('.office-today')).toBeNull();
    // The control: the same Today, signed in the same way, with the flag on.
    await render(<TodayDecisionSurface actionCenter={false} registrationDay={false} crunchWeek={false} officeActions officeAccountId="u1" />);
    await settle(() => host.querySelector('.office-today') !== null);
    expect(host.querySelector('.office-today')).not.toBeNull();
  });
});

describe('with office_action_feed on', () => {
  it('asks a signed-out student to sign in, and fetches nothing', async () => {
    await render(<OfficeActionFeed enabled accountId={null} />);
    expect(text()).toContain('Sign in to see what your school’s offices have published for you.');
    expect(host.querySelector('.office-card')).toBeNull();
  });

  it('shows each action with its office, source, date and the reason it reached this student', async () => {
    await render(<OfficeActionFeed enabled accountId="u1" />);
    const card = host.querySelector('[aria-label="Financial Aid: FAFSA verification documents are due October 15"]')!;
    expect(card).not.toBeNull();
    expect(text(card)).toContain('Due Thu, Oct 15');
    expect(text(card)).toContain('This may affect aid processing.');
    expect(text(card)).toContain('Institution verified');
    expect(text(card)).toContain('Updated');
    expect(text(card)).toContain('Financial Aid sent this to every student at your school.');
    expect(text(card)).toContain('Source: Financial Aid verification checklist');
  });

  it('opens the official page only after a confirmation that shows the address', async () => {
    const opened = vi.spyOn(window, 'open').mockImplementation(() => null);
    await render(<OfficeActionFeed enabled accountId="u1" />);
    await act(async () => button(/^Open official page$/, host.querySelector('.office-card')!).click());
    expect(opened).not.toHaveBeenCalled();
    expect(text(dialog()!)).toContain('https://aid.school.edu/verification');
    expect(document.activeElement?.textContent).toBe('Cancel');
    await act(async () => button(/^Open official page$/, dialog()!).click());
    expect(opened).toHaveBeenCalledWith('https://aid.school.edu/verification', '_blank', 'noopener,noreferrer');
  });

  it('marks done only after saying the office sees a count at ten or more, never who', async () => {
    await render(<OfficeActionFeed enabled accountId="u1" />);
    await act(async () => button(/^Mark done…$/).click());
    expect(marked).toEqual([]);
    expect(text(dialog()!)).toContain('only a count of students who marked this done, and only once ten or more have');
    expect(text(dialog()!)).toContain('never sees your name');
    expect(document.activeElement?.textContent).toBe('Cancel');
    await act(async () => button(/^Mark done$/, dialog()!).click());
    expect(marked).toEqual([{ id: 'a1', done: true }]);
  });

  it('saves what applies only after a preview, and writes only what changed', async () => {
    await render(<OfficeActionFeed enabled accountId="u1" />);
    const box = [...host.querySelectorAll<HTMLInputElement>('.office-audiences input[type="checkbox"]')].find((i) =>
      /I applied for financial aid/.test(i.closest('label')?.textContent ?? ''),
    )!;
    await act(async () => box.click());
    expect(audienceWrites).toEqual([]);
    await act(async () => button(/^Save what applies to me…$/).click());
    expect(text(dialog()!)).toContain('I applied for financial aid');
    expect(text(dialog()!)).toContain('No office can see these.');
    expect(audienceWrites).toEqual([]);
    await act(async () => button(/^Save$/, dialog()!).click());
    await act(async () => {
      await new Promise((r) => setTimeout(r, 0));
    });
    expect(audienceWrites).toEqual([{ kind: 'eligibility', value: 'aid_applicant', on: true }]);
  });

  it('says so when nothing reaches the student, and offers a retry when the feed fails', async () => {
    feed = [];
    await render(<OfficeActionFeed enabled accountId="u1" />);
    expect(text()).toContain('No office has published anything that reaches you.');
    await act(async () => root.unmount());
    root = createRoot(host);
    feedError = 'network down';
    await render(<OfficeActionFeed enabled accountId="u1" />);
    expect(host.querySelector('[role="alert"]')?.textContent).toContain('Could not load office actions: network down');
    feedError = null;
    feed = readOfficeActions([row()]);
    await act(async () => button(/^Try again$/).click());
    await act(async () => {
      await new Promise((r) => setTimeout(r, 0));
    });
    expect(host.querySelector('.office-card')).not.toBeNull();
  });

  it('ranks an office action in the Action Center, and leaves out one marked done', async () => {
    feed = readOfficeActions([row(), row({ id: 'a2', title: 'Housing deposit confirmed', done_at: new Date().toISOString() })]);
    await render(<TodayActionCenter officeActions officeAccountId="u1" />);
    expect(text()).toContain('FAFSA verification documents are due October 15');
    expect(text()).not.toContain('Housing deposit confirmed');
  });

  it('shows the first three on the briefing Today', async () => {
    feed = readOfficeActions([1, 2, 3, 4].map((i) => row({ id: `a${i}`, title: `Office action ${i}` })));
    const { OfficeActionsToday } = await import('./OfficeActionsToday');
    await render(<OfficeActionsToday accountId="u1" />);
    expect(host.querySelectorAll('.office-card')).toHaveLength(3);
    expect(button(/^All 4 from campus offices$/)).toBeTruthy();
  });
});

describe('switching accounts on a shared device', () => {
  it('never shows the last account’s office actions to the next one', async () => {
    const remote = await import('../lib/office-actions-remote');
    await render(<OfficeActionFeed enabled accountId="student-a" />);
    await settle(() => text().includes('FAFSA verification'));
    expect(text()).toContain('FAFSA verification');
    // The next account's request has not answered yet.
    vi.mocked(remote.myOfficeActions).mockImplementationOnce(() => new Promise(() => {}));
    await render(<OfficeActionFeed enabled accountId="student-b" />);
    expect(text()).not.toContain('FAFSA verification');
  });
});

describe('the office desk', () => {
  it('is not there for an account that may not publish', async () => {
    await render(<OfficeActionDesk signedIn />);
    expect(host.querySelector('.office-desk')).toBeNull();
  });

  it('never offers approving your own, and prints no count below ten', async () => {
    scopes = [{ office: 'financial_aid', label: 'Financial Aid', scopeKind: 'school', scopeId: 'school', resourceOnly: false }];
    const base: DeskRow = {
      id: 'd1', office: 'financial_aid', scopeId: 'school', type: 'aid', audience: 'tenant', target: null,
      title: 'Mine in review', why: 'w', dueAt: null, url: 'https://x.edu', source: 's', status: 'in_review',
      mine: true, reviewNote: null, updatedAt: '2026-10-01T00:00:00Z', completed: null,
    };
    desk = [
      base,
      { ...base, id: 'd2', title: 'A colleague’s in review', mine: false },
      { ...base, id: 'd3', title: 'Published, nine done', status: 'published', completed: null },
      { ...base, id: 'd4', title: 'Published, twelve done', status: 'published', completed: 12 },
    ];
    await render(<OfficeActionDesk signedIn />);
    const card = (title: string) => [...host.querySelectorAll('.office-card')].find((c) => c.textContent?.includes(title))!;
    expect(() => button(/^Approve and publish…$/, card('Mine in review'))).toThrow();
    expect(button(/^Approve and publish…$/, card('A colleague’s in review'))).toBeTruthy();
    expect(text(card('Published, nine done'))).toContain('Fewer than 10 students have marked this done, so no count is shown.');
    expect(text(card('Published, twelve done'))).toContain('12 students marked this done.');
  });

  it('publishes only after a preview of what students will see', async () => {
    scopes = [{ office: 'financial_aid', label: 'Financial Aid', scopeKind: 'school', scopeId: 'school', resourceOnly: false }];
    desk = [{
      id: 'd2', office: 'financial_aid', scopeId: 'school', type: 'aid', audience: 'tenant', target: null,
      title: 'Verification due', why: 'This may affect aid processing.', dueAt: null, url: 'https://aid.school.edu', source: 's',
      status: 'in_review', mine: false, reviewNote: null, updatedAt: '2026-10-01T00:00:00Z', completed: null,
    }];
    await render(<OfficeActionDesk signedIn />);
    await act(async () => button(/^Approve and publish…$/).click());
    expect(moves).toEqual([]);
    expect(text(dialog()!)).toContain('https://aid.school.edu');
    expect(document.activeElement?.textContent).toBe('Cancel');
    await act(async () => button(/^Publish$/, dialog()!).click());
    expect(moves).toEqual([{ id: 'd2', step: 'approve' }]);
  });
});
