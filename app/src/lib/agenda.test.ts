import { describe, expect, it } from 'vitest';
import { agendaCount, agendaDays, AGENDA_DAYS } from './agenda';
import type { Appointment, DatedEvent, DatedItem, FeedEvent, PersonalTask } from './types';

// A Wednesday. Local time throughout, as the app's own dates are.
const FROM = new Date(2026, 9, 7, 15, 30);

const item = (id: string, day: number): DatedItem =>
  ({ id, title: id, date: new Date(2026, 9, day), dueTime: '11:59 PM' }) as DatedItem;
const campus = (id: string, day: number): DatedEvent =>
  ({ id, title: id, date: new Date(2026, 9, day), time: '7 PM' }) as DatedEvent;
const feed = (id: string, date: string, at: number | null): FeedEvent =>
  ({ id, sourceId: 's', title: id, date, at, time: '', where: '', note: '', courseId: null }) as FeedEvent;
const task = (id: string, date: string | null, done = false): PersonalTask =>
  ({ id, title: id, date, time: '', note: '', done }) as PersonalTask;
const appt = (id: string, date: string, at: number | null, repeat?: Appointment['repeat']): Appointment =>
  ({ id, title: id, date, at, time: '', where: '', note: '', created: 0, repeat }) as Appointment;

const none = { items: [], events: [], feed: [], tasks: [], appointments: [] };

describe('agendaDays', () => {
  it('leaves out days with nothing on them', () => {
    const days = agendaDays({ ...none, items: [item('a', 9)] }, FROM);
    expect(days.map((d) => d.iso)).toEqual(['2026-10-09']);
  });

  it('starts today and stops at the horizon', () => {
    const inside = item('last', 7 + AGENDA_DAYS - 1);
    const outside = item('beyond', 7 + AGENDA_DAYS);
    const before = item('yesterday', 6);
    const days = agendaDays({ ...none, items: [before, item('today', 7), inside, outside] }, FROM);
    expect(days.flatMap((d) => d.entries.map((e) => (e.kind === 'deadline' ? e.item.id : '')))).toEqual([
      'today',
      'last',
    ]);
  });

  it('orders a day all-day first, then by hour, then the untimed records', () => {
    const days = agendaDays(
      {
        items: [item('deadline', 8)],
        events: [campus('game', 8)],
        tasks: [task('mine', '2026-10-08')],
        feed: [feed('lecture', '2026-10-08', 11 * 60), feed('holiday', '2026-10-08', null)],
        appointments: [appt('advisor', '2026-10-08', 9 * 60)],
      },
      FROM,
    );
    expect(days).toHaveLength(1);
    expect(days[0].entries.map((e) => e.kind)).toEqual([
      'feed',
      'appointment',
      'feed',
      'deadline',
      'campus',
      'action',
    ]);
  });

  it('repeats a weekly appointment on each of its days', () => {
    const weekly = appt('seminar', '2026-10-07', 14 * 60, { every: 'weekly', until: '2026-12-31' });
    const days = agendaDays({ ...none, appointments: [weekly] }, FROM);
    expect(days.map((d) => d.iso)).toEqual(['2026-10-07', '2026-10-14']);
  });

  it('drops finished and undated tasks', () => {
    const days = agendaDays(
      { ...none, tasks: [task('open', '2026-10-10'), task('done', '2026-10-10', true), task('someday', null)] },
      FROM,
    );
    expect(agendaCount(days)).toBe(1);
  });

  it('is empty, not a list of empty days, when there is nothing', () => {
    expect(agendaDays(none, FROM)).toEqual([]);
  });
});
