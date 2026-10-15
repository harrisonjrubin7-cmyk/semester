// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { loadSeed } from '../data/seed';
import type { Contributed, DemandRow, MyContribution } from '../lib/course-demand';
import { readDemand } from '../lib/course-demand';
import type { DemandScope } from '../lib/course-demand-remote';
import { STORAGE_KEY } from '../state/shape';
import { StoreProvider } from '../state/store';

/**
 * Phase K on screen, with the database's side mocked (its own rules are
 * `supabase/demand.check.sql`). With `demand_forecasting` off, the cart and
 * University show nothing of it (the control). With it on: signed out, nothing
 * is sent; contributing waits for a confirmation that lists exactly what is
 * sent and what is not, and sends exactly that; a changed cart is pointed
 * out, never re-sent quietly; stopping confirms and says it is prospective.
 * Staff with no scope are told so; with one, no count below ten is ever
 * shown, backups below ten are words, and unconnected capacity says so.
 */

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let mine: MyContribution | null = null;
let scopes: DemandScope[] = [];
let demand: DemandRow[] = [];
const sent: { term: string; courses: Contributed[] }[] = [];
const stopped: string[] = [];

vi.mock('../lib/course-demand-remote', async (importOriginal) => {
  const real = await importOriginal<typeof import('../lib/course-demand-remote')>();
  return {
    ...real,
    myContribution: vi.fn(async () => mine),
    contribute: vi.fn(async (term: string, courses: Contributed[]) => {
      sent.push({ term, courses: [...courses] });
      mine = { consentedAt: Date.now(), revokedAt: null, courses: [...courses] };
      return courses.length;
    }),
    stopContributing: vi.fn(async (term: string) => {
      stopped.push(term);
      mine = mine ? { ...mine, courses: [], revokedAt: Date.now() } : null;
    }),
    myDemandScopes: vi.fn(async () => scopes),
    courseDemand: vi.fn(async () => demand),
  };
});

const { DemandContribution } = await import('./DemandContribution');
const { DemandDesk } = await import('./DemandDesk');
const { RegistrationPortal } = await import('./RegistrationPortal');
const { University } = await import('../screens/University');

const section = (id: string, code: string, extra: Record<string, unknown> = {}) => ({
  id, code, section: 'S07', title: `${code} title`, term: '2027SP', department: code.split(' ')[0], credits: 3,
  instructor: 'Prof. Ruiz', location: 'Calhoun 101', description: 'd', prerequisites: '', seats: 10,
  meetings: [{ days: [1, 3], start: '09:00', end: '10:15' }], ...extra,
});

let host: HTMLDivElement;
let root: Root;

beforeAll(async () => {
  await loadSeed();
});

beforeEach(() => {
  window.location.hash = '';
  window.matchMedia = (() => ({ matches: false, addEventListener: () => {}, removeEventListener: () => {} })) as unknown as typeof window.matchMedia;
  localStorage.clear();
  localStorage.setItem(STORAGE_KEY, JSON.stringify({ schemaVersion: 6, seenOnboarding: true, sample: false, term: '2027SP', courses: [] }));
  localStorage.setItem(
    'semester.registration.v1',
    JSON.stringify({
      catalog: {
        institution: 'Example University',
        importedAt: new Date().toISOString(),
        courses: [section('e1', 'ECON 1010'), section('e3', 'ECON 1020'), section('m1', 'MATH 1300', { meetings: [{ days: [2, 4], start: '11:00', end: '12:15' }] })],
      },
      cart: ['e1', 'm1'],
      plans: [],
    }),
  );
  mine = null;
  scopes = [];
  demand = [];
  sent.length = 0;
  stopped.length = 0;
  host = document.createElement('div');
  host.className = 'device';
  document.body.append(host);
  root = createRoot(host);
});

afterEach(async () => {
  await act(async () => root.unmount());
  host.remove();
  localStorage.clear();
});

const settle = async (ready?: () => boolean) => {
  const until = Date.now() + 2000;
  for (let i = 0; ready ? !ready() && Date.now() < until : i < 4; i += 1) {
    await act(async () => {
      await new Promise((r) => setTimeout(r, 10));
    });
  }
};
const render = async (node: React.ReactNode) => {
  await act(async () => root.render(<StoreProvider>{node}</StoreProvider>));
  await settle();
};
const text = (el: ParentNode = document.body) => (el.textContent ?? '').replace(/\s+/g, ' ');
const button = (name: RegExp, within: ParentNode = document.body) => {
  const found = [...within.querySelectorAll('button, [role="tab"]')].find((b) => name.test((b.textContent ?? '').trim())) as HTMLElement | undefined;
  if (!found) throw new Error(`No button ${name}: ${[...within.querySelectorAll('button')].map((b) => b.textContent).join(' | ')}`);
  return found;
};
const dialog = () => [...document.querySelectorAll('[role="dialog"]')].find((d) => d.classList.contains('dialog')) ?? null;

describe('with demand_forecasting off', () => {
  it('the cart has no demand panel', async () => {
    await render(<RegistrationPortal demandForecasting={false} />);
    await act(async () => button(/^Cart \(2\)$/).click());
    await settle(() => host.querySelector('.demand-contribution') !== null);
    expect(host.querySelector('.demand-contribution')).toBeNull();
    // The control: the same cart with the flag on has it.
    await render(<RegistrationPortal demandForecasting />);
    await act(async () => button(/^Cart \(2\)$/).click());
    await settle(() => host.querySelector('.demand-contribution') !== null);
    expect(host.querySelector('.demand-contribution')).not.toBeNull();
  }, 15_000);

  it('University has no Demand tab', async () => {
    await render(<University />);
    expect(() => button(/^Demand$/)).toThrow();
  }, 15_000);
});

describe('a student contributing', () => {
  it('sends nothing signed out', async () => {
    await render(<DemandContribution accountId={null} />);
    expect(text()).toContain('Sign in to contribute. Nothing is counted from this device.');
    expect(() => button(/^Contribute/)).toThrow();
  });

  it('contributes only after a confirmation that lists what is sent and what is not, and sends exactly that', async () => {
    await render(<DemandContribution accountId="u1" />);
    await act(async () => button(/^Contribute my plan for 2027SP…$/).click());
    expect(sent).toEqual([]);
    const preview = text(dialog()!);
    expect(preview).toContain('ECON 1010 — planning to take');
    expect(preview).toContain('MATH 1300 — planning to take');
    expect(preview).toContain('Not sent: your name, sections, times, instructors, or anything else in Semester.');
    expect(preview).toContain('only when ten or more do');
    expect(preview).toContain('Not used for admissions or for any automated enrollment decision.');
    expect(document.activeElement?.textContent).toBe('Cancel');
    await act(async () => button(/^Contribute$/, dialog()!).click());
    await settle(() => sent.length > 0);
    expect(sent).toEqual([{ term: '2027SP', courses: [{ course: 'ECON 1010', role: 'primary' }, { course: 'MATH 1300', role: 'primary' }] }]);
  });

  it('points out a changed cart instead of re-sending it', async () => {
    // 07:00 UTC is Sep 20 from UTC-5 to UTC+14 (`npm run test:zones`); midnight UTC is Sep 19 in Chicago.
    mine = { consentedAt: Date.parse('2026-09-20T07:00:00Z'), revokedAt: null, courses: [{ course: 'ECON 1010', role: 'primary' }] };
    await render(<DemandContribution accountId="u1" />);
    expect(text()).toContain('You contribute for 2027SP since Sep 20, 2026.');
    expect(text()).toContain('Your cart has changed since you sent it. The counts still use what you sent.');
    expect(sent).toEqual([]);
    await act(async () => button(/^Send my current plan…$/).click());
    expect(sent).toEqual([]);
  });

  it('stops only after saying it is prospective', async () => {
    mine = { consentedAt: Date.now(), revokedAt: null, courses: [{ course: 'ECON 1010', role: 'primary' }, { course: 'MATH 1300', role: 'primary' }] };
    await render(<DemandContribution accountId="u1" />);
    await act(async () => button(/^Stop contributing…$/).click());
    expect(stopped).toEqual([]);
    expect(text(dialog()!)).toContain('Counts already published keep you until they are next refreshed. No refresh after that counts you.');
    await act(async () => button(/^Stop contributing$/, dialog()!).click());
    await settle(() => stopped.length > 0);
    expect(stopped).toEqual(['2027SP']);
  });
});

describe('a contribution after the cart is emptied', () => {
  const emptyCart = () => {
    const reg = JSON.parse(localStorage.getItem('semester.registration.v1')!);
    localStorage.setItem('semester.registration.v1', JSON.stringify({ ...reg, cart: [] }));
  };

  it('stays in view, and can still be stopped', async () => {
    mine = { consentedAt: Date.now(), revokedAt: null, courses: [{ course: 'ECON 1010', role: 'primary' }] };
    emptyCart();
    await render(<DemandContribution accountId="u1" />);
    await settle(() => text().includes('You contribute for 2027SP'));
    expect(text()).toContain('Your cart is empty now, but the counts still use what you sent.');
    await act(async () => button(/^Stop contributing…$/).click());
    expect(stopped).toEqual([]);
    await act(async () => button(/^Stop contributing$/, dialog()!).click());
    await settle(() => stopped.length > 0);
    expect(stopped).toEqual(['2027SP']);
  });

  it('asks for a cart when nothing is being counted (the control)', async () => {
    emptyCart();
    await render(<DemandContribution accountId="u1" />);
    expect(text()).toContain('Add courses to your cart first.');
    expect(() => button(/^Stop contributing…$/)).toThrow();
  });
});

describe('the staff view', () => {
  it('tells an account with no demand scope so, and asks for nothing', async () => {
    await render(<DemandDesk accountId="u1" />);
    await settle(() => text().includes('This account has none of those scopes.'));
    expect(text()).toContain('This account has none of those scopes.');
    expect(host.querySelector('.demand-row')).toBeNull();
  });

  it('shows counts of ten or more only, with backups and capacity said honestly', async () => {
    scopes = [{ kind: 'school', id: 'example' }];
    // Read through the same reader the remote uses, so a count of three in
    // the response is dropped here exactly as it would be there.
    demand = readDemand([
      { course_code: 'ECON 1010', planned_students: 70, backup_students: null, generated_at: new Date().toISOString(), capacity: 55, waitlist: 4, sections: 2, capacity_source: 'banner', capacity_synced_at: new Date().toISOString() },
      { course_code: 'MATH 1300', planned_students: 12, backup_students: 11, generated_at: new Date().toISOString(), capacity: null, waitlist: null, sections: 0 },
      { course_code: 'HIST 1000', planned_students: 3, backup_students: null, generated_at: new Date().toISOString(), sections: 0 },
    ]);
    await render(<DemandDesk accountId="u1" />);
    await settle(() => text().includes('Show demand'));
    await act(async () => button(/^Show demand$/).click());
    await settle(() => host.querySelectorAll('.demand-row').length > 0);
    expect(text()).toContain('Based on anonymized planning data from students who chose to contribute.');
    expect(text()).toContain('ECON 1010 — 70 planning to take');
    expect(text()).toContain('Fewer than 10 hold it as a backup');
    expect(text()).toContain('55 seats in 2 sections · 4 waitlisted · 15 more planned than seats');
    expect(text()).toContain('MATH 1300 — 12 planning to take');
    expect(text()).toContain('11 as a backup');
    expect(text()).toContain('Capacity not connected');
    expect(text()).not.toContain('HIST 1000');
    expect(text()).toContain('Not used for admissions or for any automated enrollment decision.');
  });
});
