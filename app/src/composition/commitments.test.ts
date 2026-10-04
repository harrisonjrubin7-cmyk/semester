import { beforeAll, describe, expect, it } from 'vitest';
import { buildCatalog, type Catalog } from '../data/catalog';
import { loadSeed } from '../data/seed';
import { MemorySink, counterIds, fixedClock } from '../kernel';
import { HORIZON_DAYS, legacyCommitmentRows } from '../lib/commitment-rows';
import { dateToIso } from '../lib/date';
import { datedItems, upcomingItems } from '../lib/select';
import { ownedScope } from '../lib/standing';
import { planCommitments, type CommitmentRow } from '../lib/today-center';
import type { Appointment, CourseModule, PersonalTask } from '../lib/types';
import { DEFAULT_PERSISTED, initialEphemeral, type State } from '../state/shape';
import { CLASS_DAYS, commitmentRowsFromDomain, type CommitmentLookups } from './commitments';
import { composeDomains } from './domains';
import { hostOver, type StoreSnapshot } from './react';

/**
 * The domain-backed commitment rows, held to the code they replace.
 *
 * Same state, same moment: `lib/commitment-rows.ts` (what the Action Center built
 * inline) and the domain's look-ahead joined to the legacy records. The claim is
 * about what a student sees, so it is stated three ways:
 *
 * 1. every row the old code built, the new code built;
 * 2. anything the new code built that the old did not is already past, which
 *    `planCommitments` discards (the old rows come from `upcomingItems`, which drops
 *    a deadline whose hour has gone; the domain reads every dated item);
 * 3. `planCommitments`, which is what is drawn, gives the same answer.
 */

let modules: CourseModule[];
let catalog: Catalog;
beforeAll(async () => {
  modules = await loadSeed();
  catalog = buildCatalog(modules);
});

const NOWS: Record<string, Date> = {
  'a morning in the sample semester': new Date(2026, 8, 27, 10, 0),
  'late the next night': new Date(2026, 8, 28, 23, 30),
  'a Monday morning two weeks on': new Date(2026, 9, 12, 8, 0),
  'the first minute of a day': new Date(2026, 9, 14, 0, 1),
};

const plus = (now: Date, days: number): string => dateToIso(new Date(now.getFullYear(), now.getMonth(), now.getDate() + days));
const task = (id: string, date: string | null, over: Partial<PersonalTask> = {}): PersonalTask => ({ id, title: `Task ${id}`, date, time: '', note: '', done: false, created: 0, courseId: null, ...over });
const appt = (id: string, date: string, over: Partial<Appointment> = {}): Appointment => ({ id, title: `Appt ${id}`, date, at: 600, time: '10:00 AM', where: '', note: '', created: 0, ...over });

const STATE_NAMES = [
  'sample on, nothing of the student’s',
  'sample on, tasks and appointments',
  'adopted: every course the seed has, nothing ticked',
  'adopted, with tasks, appointments and two deadlines ticked',
] as const;

function states(now: Date): Record<(typeof STATE_NAMES)[number], State> {
  const base: State = { ...DEFAULT_PERSISTED, ...initialEphemeral() };
  const mine = {
    tasks: [
      task('t-today-timed', plus(now, 0), { time: '6:30 PM' }),
      task('t-today-early', plus(now, 0), { time: '7 AM' }),
      task('t-today-plain', plus(now, 0)),
      task('t-today-done', plus(now, 0), { done: true }),
      task('t-tomorrow', plus(now, 1), { time: 'before work' }),
      task('t-day5', plus(now, 5), { time: '2:15 PM' }),
      task('t-day9', plus(now, 9)),
      task('t-day10-outside', plus(now, 10)),
      task('t-yesterday', plus(now, -1)),
      task('t-someday', null),
      task('t-weekly', plus(now, 2), { repeat: { every: 'weekly', until: plus(now, 90) } }),
    ],
    appointments: [
      appt('a-today', plus(now, 0), { at: 840, where: 'Library 2F' }),
      appt('a-today-allday', plus(now, 0), { at: null as unknown as number }),
      appt('a-tomorrow', plus(now, 1), { at: 540, where: 'Hall B' }),
      appt('a-day3', plus(now, 3), { at: 1020 }),
      appt('a-weekly', plus(now, 0), { at: 660, where: 'Gym', repeat: { every: 'weekly', until: plus(now, 60) } }),
      appt('a-day12-outside', plus(now, 12)),
    ],
  };
  const firstTwo = upcomingItems(catalog, now).slice(0, 2).map((i) => i.id);
  return {
    'sample on, nothing of the student’s': { ...base },
    'sample on, tasks and appointments': { ...base, ...mine },
    'adopted: every course the seed has, nothing ticked': { ...base, sample: false, courses: modules },
    'adopted, with tasks, appointments and two deadlines ticked': { ...base, sample: false, courses: modules, ...mine, done: Object.fromEntries(firstTwo.map((id) => [id, true])) },
  };
}

async function bothAt(now: Date, state: State) {
  const ownIds = state.courses.map((c) => c.course.id);
  const upcoming = ownedScope(upcomingItems(catalog, now), ownIds, state.sample, catalog.empty).items;
  const legacy = legacyCommitmentRows({ catalog, now, ownIds, sample: state.sample, tasks: state.tasks, appointments: state.appointments, done: state.done, upcoming });

  const snapshot: StoreSnapshot = { state, catalog, accountId: null, schoolId: 'default', now, grants: [], choices: {} };
  const clock = fixedClock(dateToIso(now), now.getHours() * 60 + now.getMinutes());
  const domains = composeDomains(hostOver(() => snapshot, () => {}), { clock, ids: counterIds('req'), events: new MemorySink() });
  const look = await domains.today.commitments(HORIZON_DAYS);
  if (!look.ok) throw new Error(`the look-ahead refused: ${look.error.code}`);
  const items = new Map(datedItems(catalog, now).map((i) => [i.id, i]));
  const lookups: CommitmentLookups = {
    deadline: (id) => items.get(id),
    appointment: (id) => state.appointments.find((a) => a.id === id),
    courseCode: (c) => catalog.byId[c]?.code,
  };
  const fromDomain = commitmentRowsFromDomain(look.value, lookups);
  return { legacy, fromDomain };
}

const byId = (rows: readonly CommitmentRow[]) => [...rows].sort((a, b) => a.id.localeCompare(b.id));

describe('commitment rows: the domain’s, against the Action Center’s own', () => {
  for (const [when, now] of Object.entries(NOWS)) {
    for (const stateName of STATE_NAMES) {
      it(`${when} · ${stateName}`, async () => {
        const { legacy, fromDomain } = await bothAt(now, states(now)[stateName]);
        expect(fromDomain, 'an entry had no record to draw it from').not.toBeNull();
        const rows = fromDomain!;
        const at = now.getTime();

        // 1. nothing the old code built is missing
        const have = new Set(rows.map((r) => r.id));
        expect(legacy.filter((r) => !have.has(r.id)).map((r) => r.id)).toEqual([]);
        for (const r of legacy) expect(rows.find((x) => x.id === r.id), r.id).toEqual(r);

        // 2. whatever is extra is already past, and `planCommitments` discards it
        const extra = rows.filter((r) => !legacy.some((l) => l.id === r.id));
        expect(extra.filter((r) => r.at >= at - 60_000).map((r) => r.id)).toEqual([]);

        // 3. what is drawn is the same, with and without a leading action named
        expect(planCommitments(rows, at, null)).toEqual(planCommitments(legacy, at, null));
        const leading = byId(legacy.filter((r) => r.at >= at - 60_000))[0]?.id ?? null;
        expect(planCommitments(rows, at, leading)).toEqual(planCommitments(legacy, at, leading));
      });
    }
  }
});

describe('commitment rows: the control, and the edges', () => {
  it('the cases are not empty: the busy states really do produce rows of every kind', async () => {
    const now = NOWS['a morning in the sample semester'];
    const { legacy } = await bothAt(now, states(now)['adopted, with tasks, appointments and two deadlines ticked']);
    const kinds = new Set(legacy.map((r) => r.kind));
    expect([...kinds].sort()).toEqual(['appointment', 'class', 'deadline', 'task']);
    expect(legacy.length).toBeGreaterThan(15);
  });

  it('a wrong mapping would be caught: shifting every task by an hour makes the comparison fail', async () => {
    const now = NOWS['a morning in the sample semester'];
    const { legacy, fromDomain } = await bothAt(now, states(now)['sample on, tasks and appointments']);
    const shifted = fromDomain!.map((r) => (r.kind === 'task' ? { ...r, at: r.at + 3_600_000 } : r));
    expect(legacy.every((r) => shifted.some((x) => x.id === r.id && x.at === r.at))).toBe(false);
  });

  it('draws classes for today and tomorrow only, as the old rows did, though the domain knows every day', async () => {
    const now = NOWS['a morning in the sample semester'];
    const { fromDomain } = await bothAt(now, states(now)['adopted: every course the seed has, nothing ticked']);
    const days = new Set(fromDomain!.filter((r) => r.kind === 'class').map((r) => r.id.split(':')[1]));
    expect(days.size).toBeLessThanOrEqual(CLASS_DAYS);
  });

  it('returns null, not a shorter list, when a deadline has no record behind it', async () => {
    const now = NOWS['a morning in the sample semester'];
    const state = states(now)['adopted: every course the seed has, nothing ticked'];
    const snapshot: StoreSnapshot = { state, catalog, accountId: null, schoolId: 'default', now, grants: [], choices: {} };
    const domains = composeDomains(hostOver(() => snapshot, () => {}), { clock: fixedClock(dateToIso(now), 600), ids: counterIds('req'), events: new MemorySink() });
    const look = await domains.today.commitments(HORIZON_DAYS);
    expect(look.ok && commitmentRowsFromDomain(look.value, { deadline: () => undefined, appointment: () => undefined, courseCode: () => undefined })).toBeNull();
  });
});
