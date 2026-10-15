import { describe, expect, it } from 'vitest';
import { NEEDS } from './help-routes';
import { DESTINATIONS } from './nav';
import {
  DISCLOSED,
  EMPTY_LIFE_EVENTS,
  FOLLOW_UP_DAYS,
  LIFE_EVENTS,
  LIFE_EVENT_IDS,
  MAX_ACTIVE,
  PLAN_DAYS,
  activePlans,
  chooseEvent,
  clearEvent,
  dayOf,
  eventById,
  lifeEventsFlag,
  lifeEventsOn,
  planFor,
  pruneLapsed,
  readLifeEvents,
} from './lifeevents';

const registered = new Set<string>(DESTINATIONS.map((d) => d.screen));
const needs = new Set<string>(NEEDS.map((n) => n.id));

describe('life events', () => {
  it('has the twelve the brief lists, once each', () => {
    expect(LIFE_EVENTS.map((e) => e.id)).toEqual([...LIFE_EVENT_IDS]);
    expect(new Set(LIFE_EVENT_IDS).size).toBe(12);
  });

  it('routes only to registered screens and real help needs', () => {
    for (const e of LIFE_EVENTS) {
      expect(e.adjustments.length, e.id).toBeGreaterThan(0);
      for (const a of e.adjustments) expect(registered.has(a.screen), `${e.id}: ${a.screen}`).toBe(true);
      for (const n of e.routes) expect(needs.has(n), `${e.id}: ${n}`).toBe(true);
    }
  });

  it('asks for nothing: no field can carry a sentence, and no sentence asks for one', () => {
    expect(DISCLOSED).toBe('nothing');
    for (const e of LIFE_EVENTS) {
      expect(Object.keys(e).sort()).toEqual(['adjustments', 'id', 'routes', 'says']);
      expect(e.says).not.toMatch(/diagnos|why|explain|describe|reason|prove|evidence|doctor/i);
    }
    const p = planFor('illness', '2026-10-01');
    expect(Object.keys(p).sort()).toEqual(['adjustments', 'disclosed', 'event', 'expires', 'followUp', 'line', 'routes']);
    expect(p.disclosed).toBe('nothing');
  });

  it('gives a plan that lapses, with one follow-up before it does', () => {
    const p = planFor('caregiving', '2026-10-01');
    expect(PLAN_DAYS).toBe(28);
    expect(FOLLOW_UP_DAYS).toBeLessThan(PLAN_DAYS);
    expect(p.expires).toBe('2026-10-29');
    expect(p.followUp).toBe('2026-10-15');
    expect(planFor('leave', '2026-12-20').expires).toBe('2027-01-17');
  });

  it('points to the offices that decide and decides nothing itself', () => {
    const p = planFor('illness', '2026-10-01');
    const acc = p.routes.find((r) => r.need === 'accessibility')!;
    expect(acc.directoryOnly).toBe(true);
    expect(p.line).toMatch(/did not have to say why/);
    expect(JSON.stringify(LIFE_EVENTS)).not.toMatch(/approve|granted|eligible|extension is|you qualify/i);
    expect(eventById('money').routes).toContain('money');
  });

  it('keeps wellbeing a directory, never a request', () => {
    for (const e of LIFE_EVENTS) for (const n of e.routes) if (n === 'wellbeing') expect(NEEDS.find((x) => x.id === n)!.directoryOnly).toBe(true);
  });

  it('reads a stored choice back only if it is a known event on a real day, once each, capped', () => {
    expect(readLifeEvents(null)).toBe(EMPTY_LIFE_EVENTS);
    expect(readLifeEvents('nonsense')).toBe(EMPTY_LIFE_EVENTS);
    expect(readLifeEvents({ events: 'x' })).toBe(EMPTY_LIFE_EVENTS);
    const raw = {
      events: [
        { id: 'illness', chosenOn: '2026-10-01' },
        { id: 'illness', chosenOn: '2026-10-02' }, // a repeat is dropped
        { id: 'not-an-event', chosenOn: '2026-10-01' },
        { id: 'money', chosenOn: '2026-02-31' }, // a day that is not the day it says
        { id: 'leave', chosenOn: 'yesterday' },
        { id: 'housing', chosenOn: '' },
        { id: 'travel', chosenOn: '2026-10-03', note: 'a sentence somebody typed' },
      ],
    };
    const read = readLifeEvents(raw);
    expect(read.events).toEqual([
      { id: 'illness', chosenOn: '2026-10-01' },
      { id: 'travel', chosenOn: '2026-10-03' },
    ]);
    // Nothing but the id and the day survives, so a stored sentence cannot come back out.
    expect(Object.keys(read.events[1]).sort()).toEqual(['chosenOn', 'id']);
    const many = readLifeEvents({ events: LIFE_EVENT_IDS.map((id) => ({ id, chosenOn: '2026-10-01' })) });
    expect(many.events).toHaveLength(MAX_ACTIVE);
    expect(many.events.at(-1)!.id).toBe(LIFE_EVENT_IDS.at(-1));
  });

  it('keeps a chosen event, restarts its clock when chosen again, and lets go of the oldest above the cap', () => {
    let s = chooseEvent(EMPTY_LIFE_EVENTS, 'illness', '2026-10-01');
    s = chooseEvent(s, 'money', '2026-10-02');
    s = chooseEvent(s, 'illness', '2026-10-20');
    expect(s.events).toEqual([
      { id: 'money', chosenOn: '2026-10-02' },
      { id: 'illness', chosenOn: '2026-10-20' },
    ]);
    s = chooseEvent(chooseEvent(s, 'leave', '2026-10-21'), 'travel', '2026-10-22');
    expect(s.events.map((e) => e.id)).toEqual(['illness', 'leave', 'travel']);
    expect(clearEvent(s, 'leave').events.map((e) => e.id)).toEqual(['illness', 'travel']);
  });

  it('lapses on its own: drawn until the day it clears, then gone, and pruned only when something has lapsed', () => {
    const s = chooseEvent(EMPTY_LIFE_EVENTS, 'caregiving', '2026-10-01');
    expect(activePlans(s, '2026-10-28')).toHaveLength(1);
    expect(activePlans(s, '2026-10-29')).toHaveLength(0); // the day it clears
    expect(pruneLapsed(s, '2026-10-28')).toBe(s); // same object: no write needed
    expect(pruneLapsed(s, '2026-10-29').events).toEqual([]);
  });

  it('says the one follow-up is due from day 14 until the plan lapses, and not before', () => {
    const s = chooseEvent(EMPTY_LIFE_EVENTS, 'caregiving', '2026-10-01');
    expect(activePlans(s, '2026-10-14')[0].followUpDue).toBe(false);
    expect(activePlans(s, '2026-10-15')[0].followUpDue).toBe(true);
    expect(activePlans(s, '2026-10-28')[0].followUpDue).toBe(true);
  });

  it('reads today as the student’s day, not UTC’s', () => {
    expect(dayOf(new Date(2026, 9, 1, 0, 30))).toBe('2026-10-01'); // half past midnight local
    expect(dayOf(new Date(2026, 9, 1, 23, 30))).toBe('2026-10-01');
    expect(dayOf(new Date(2026, 11, 31, 23, 59))).toBe('2026-12-31');
  });

  it('is off unless a real state is set, and does not follow anything else', () => {
    expect(lifeEventsFlag({})).toBe('off');
    expect(lifeEventsFlag({ VITE_ME_LIFE_EVENTS: 'nonsense' })).toBe('off');
    expect(lifeEventsFlag({ VITE_ME_LIFE_EVENTS: 'preview' })).toBe('preview');
    expect(lifeEventsFlag({ VITE_ME_LIFE_EVENTS: 'production' })).toBe('production');
    expect(lifeEventsFlag({ VITE_INSTITUTIONAL_PREVIEW: 'true' })).toBe('off');
    expect(lifeEventsOn('off')).toBe(false);
    expect(lifeEventsOn('sandbox')).toBe(true);
  });
});
