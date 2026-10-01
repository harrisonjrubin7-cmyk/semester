import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { DESTINATIONS } from './nav';
import { OFFICES, officeUrl } from './offices';
import { CAMPUS_LINKS } from '../data/campus';
import {
  EMPTY_LAUNCHPAD,
  STEPS,
  STUDENT_TYPES,
  matchMentors,
  openSteps,
  progress,
  readLaunchpad,
  semesterPreview,
  stepsFor,
  type Mentor,
} from './launchpad';
import {
  ABROAD_NOTICE,
  EMPTY_BUDGET,
  KINDS,
  TEMPLATES,
  deadlines,
  newOpportunity,
  readOpportunities,
  resumeBullets,
  skillMap,
  timeBudget,
} from './opportunities';
import { PRIVACY_SAYS, SECTIONS, allEntries, arranged, leaveBy, readSupport } from './support';
import { admit, digestGroups, inQuietHours, readHubPrefs, visible, EMPTY_PREFS, type Message } from './comms';
import { ACCESS_MODES, hasMode, readAccessModes, toggleMode, withPreset } from './accessmode';
import { readLook } from './look';
import { AREAS } from './journey-areas';

/**
 * The student-side promises of the journey expansion, held as tests.
 *
 * Each `describe` is one library, and each `it` is one sentence a screen says
 * to a student — "work-study stays private", "nothing sponsored", "a type only
 * adds steps". If one of these goes red, a screen is now saying something
 * untrue.
 */

const REGISTERED = new Set<string>(DESTINATIONS.map((d) => d.screen));
// Settings pages and detail screens are real screens that are not in the directory.
const ROUTABLE = new Set<string>([...REGISTERED, 'setLook', 'notifs', 'profile']);

describe('offices', () => {
  it('every office that names a campus link names one that exists', () => {
    for (const o of Object.values(OFFICES)) {
      if (o.link) expect(CAMPUS_LINKS.some((l) => l.id === o.link), o.id).toBe(true);
    }
  });

  it('says it does not know rather than guessing an address', () => {
    expect(officeUrl('abroad')).toBe('');
    expect(officeUrl('registrar')).toMatch(/^https:\/\//);
  });

  it('lets the student’s own address win, and refuses anything that is not https', () => {
    expect(officeUrl('registrar', { registrar: 'https://example.edu/reg' })).toBe('https://example.edu/reg');
    expect(officeUrl('registrar', { registrar: 'javascript:alert(1)' })).toBe('');
  });
});

describe('launchpad', () => {
  it('a student type only ever adds steps — first-year is a subset of every list', () => {
    const base = new Set(stepsFor(['first-year']).map((s) => s.id));
    for (const t of STUDENT_TYPES) {
      const mine = new Set(stepsFor(['first-year', t.id]).map((s) => s.id));
      for (const id of base) expect(mine.has(id), `${t.id} lost ${id}`).toBe(true);
    }
  });

  it('every step an office decides names the office', () => {
    for (const s of STEPS) if (s.kind === 'official') expect(s.office, s.id).toBeDefined();
  });

  it('every step that links somewhere links to a screen that exists', () => {
    for (const s of STEPS) if (s.screen) expect(ROUTABLE.has(s.screen), `${s.id} → ${s.screen}`).toBe(true);
  });

  it('counts only the stages reached', () => {
    const steps = stepsFor(['first-year']);
    const early = progress(steps, 'prospect', {});
    const late = progress(steps, 'first-term', {});
    expect(early.of).toBeLessThan(late.of);
    expect(openSteps(steps, 'admitted', { confirm: '2026-05-01' }).some((s) => s.id === 'confirm')).toBe(false);
  });

  it('never reads more hours into a term than its credits', () => {
    expect(semesterPreview([3, 3, 4])).toEqual({ courses: 3, inClass: 10, outside: 20, total: 30 });
    expect(semesterPreview([3, Number.NaN, -1]).inClass).toBe(3);
  });

  it('matches mentors on ticked interests only, and nobody with none ticked', () => {
    const mentors: Mentor[] = [
      { id: 'a', name: 'Ada', interests: ['Research'], supports: ['transfer'] },
      { id: 'b', name: 'Bo', interests: ['Study habits', 'Research'], supports: [] },
      { id: 'c', name: 'Cy', interests: ['Campus jobs'], supports: ['first-year'] },
    ];
    expect(matchMentors([], ['first-year'], mentors)).toEqual([]);
    const m = matchMentors(['Research', 'Study habits'], ['first-year'], mentors);
    expect(m.map((x) => x.mentor.id)).toEqual(['b', 'a']);
    expect(m.every((x) => !('email' in x.mentor))).toBe(true);
  });

  it('drops what it does not know on the way in', () => {
    const v = readLaunchpad({ stage: 'graduated', types: ['martian', 'transfer'], done: { confirm: 'x', bogus: 'y' }, mentorOptIn: 'yes' });
    expect(v.stage).toBe(EMPTY_LAUNCHPAD.stage);
    expect(v.types).toEqual(['transfer']);
    expect(Object.keys(v.done)).toEqual(['confirm']);
    expect(v.mentorOptIn).toBe(false);
  });
});

describe('opportunities', () => {
  it('a resume line comes only from evidence the student marked ready', () => {
    const o = { ...newOpportunity('job'), title: 'Library assistant', workStudy: true };
    o.evidence = [
      { id: '1', text: 'shelved 400 books a week.', approved: true },
      { id: '2', text: 'a draft I have not checked', approved: false },
    ];
    const out = resumeBullets([o]);
    expect(out).toEqual([{ heading: 'Library assistant', bullets: ['Shelved 400 books a week'] }]);
    expect(JSON.stringify(out).toLowerCase()).not.toContain('work');
  });

  it('every kind has a checklist, and every eligibility step names the office that decides', () => {
    for (const k of KINDS) {
      expect(TEMPLATES[k.id].length, k.id).toBeGreaterThan(0);
      for (const t of TEMPLATES[k.id]) if (/eligib/i.test(t.title)) expect(t.office, `${k.id}.${t.id}`).toBeDefined();
    }
  });

  it('marks the visa step informational, and the notice says it is not legal advice', () => {
    expect(TEMPLATES.abroad.find((t) => t.id === 'passport')?.informational).toBe(true);
    expect(ABROAD_NOTICE).toMatch(/not legal advice/);
  });

  it('never asks for citizenship or immigration status', () => {
    const src = readFileSync(new URL('./opportunities.ts', import.meta.url), 'utf8');
    expect(src).not.toMatch(/citizenship\s*[:?]\s*(string|boolean)/i);
    expect(src).not.toMatch(/immigrationStatus|visaStatus/);
  });

  it('adds a week up against 168 and says when it does not fit', () => {
    expect(timeBudget(EMPTY_BUDGET)).toEqual({ used: 101, left: 67, fits: true });
    expect(timeBudget({ ...EMPTY_BUDGET, work: 80 }).fits).toBe(false);
  });

  it('lists only open deadlines from today on, soonest first', () => {
    const a = { ...newOpportunity('funding'), deadline: '2026-10-05' };
    const b = { ...newOpportunity('funding'), deadline: '2026-10-01' };
    const c = { ...newOpportunity('funding'), deadline: '2026-09-01' };
    const d = { ...newOpportunity('funding'), deadline: '2026-10-02', stage: 'Closed' as const };
    expect(deadlines([a, b, c, d], '2026-09-27').map((o) => o.deadline)).toEqual(['2026-10-01', '2026-10-05']);
  });

  it('maps skills across entries without double counting case', () => {
    const a = { ...newOpportunity('research'), title: 'Lab', skills: ['Python'] };
    const b = { ...newOpportunity('credential'), title: 'Cert', skills: ['python', 'SQL'] };
    expect(skillMap([a, b])[0]).toEqual({ skill: 'Python', from: ['Lab', 'Cert'] });
  });

  it('drops unknown kinds, stages and steps on the way in', () => {
    const v = readOpportunities({ items: [{ id: 'x', kind: 'lottery' }, { id: 'y', kind: 'job', stage: 'Won', steps: { find: true, fly: true }, deadline: 'soon' }] });
    expect(v.items).toHaveLength(1);
    expect(v.items[0].stage).toBe('Interested');
    expect(v.items[0].steps).toEqual({ find: true });
    expect(v.items[0].deadline).toBe('');
  });
});

describe('support', () => {
  it('every entry is either an office, a national line or a screen in this app', () => {
    for (const e of allEntries()) expect(Boolean(e.office || e.call || e.screen), e.id).toBe(true);
  });

  it('every entry says what happens to what you tell them', () => {
    for (const e of allEntries()) expect(PRIVACY_SAYS[e.privacy], e.id).toBeTruthy();
  });

  it('offers no score, rating or tracking of the student anywhere', () => {
    const text = JSON.stringify(SECTIONS.map((s) => s.groups)).toLowerCase();
    for (const word of ['score', 'risk level', 'mood tracker', 'your location']) expect(text).not.toContain(word);
  });

  it('every section says what it will never do, and the safety section says it does not monitor', () => {
    for (const s of SECTIONS) expect(s.never.length, s.id).toBeGreaterThan(0);
    expect(SECTIONS.find((s) => s.id === 'now')!.never.join(' ')).toMatch(/does not monitor/);
  });

  it('every in-app link goes to a screen that exists', () => {
    for (const e of allEntries()) if (e.screen) expect(ROUTABLE.has(e.screen), `${e.id} → ${e.screen}`).toBe(true);
  });

  it('sensory-friendly reorders and never hides', () => {
    const g = SECTIONS.find((s) => s.id === 'campus')!.groups[1].entries;
    const out = arranged(g, true);
    expect(out).toHaveLength(g.length);
    expect(out[0].quiet).toBe(true);
    expect(arranged(g, false)).toEqual(g);
  });

  it('works out when to leave, and a bad-weather day doubles only the buffer', () => {
    expect(leaveBy(540, 20, 10)).toBe(510);
    expect(leaveBy(540, 20, 10, true)).toBe(500);
    expect(leaveBy(10, 20, 10)).toBe(0);
  });

  it('drops what it does not know on the way in', () => {
    const v = readSupport({ continuity: { sources: true, rocket: true }, commute: { travel: -5, buffer: 9999 } });
    expect(v.continuity).toEqual({ sources: true });
    expect(v.commute).toEqual({ travel: 20, buffer: 10 });
  });
});

describe('the notices hub', () => {
  const m = (patch: Partial<Message>): Message => ({ id: String(Math.random()), channel: 'course', source: 'ECON 1010', title: 'Problem set', at: '2026-09-28T09:00:00Z', priority: 'normal', ...patch });

  it('drops anything sponsored, and anything without a source', () => {
    const r = admit([m({ sponsored: true, channel: 'official', priority: 'required' }), m({ source: '  ' }), m({})]);
    expect(r.shown).toHaveLength(1);
    expect(r.refused).toBe(2);
  });

  it('only an official channel can say Required, and only while its record is current', () => {
    const r = admit([
      m({ id: 'sem', channel: 'semester', priority: 'required' }),
      m({ id: 'cur', channel: 'official', priority: 'required', source: 'Registrar', current: true }),
      m({ id: 'old', channel: 'official', priority: 'required', source: 'Registrar', current: false }),
      m({ id: 'unsaid', channel: 'official', priority: 'required', source: 'Registrar' }),
    ]);
    const p = (id: string) => r.shown.find((x) => x.id === id)!.priority;
    expect(p('cur')).toBe('required');
    expect([p('sem'), p('old'), p('unsaid')]).toEqual(['high', 'high', 'high']);
    expect(r.shown[0].id).toBe('cur');
  });

  it('keeps only https links', () => {
    const r = admit([m({ id: 'a', url: 'https://registrar.example.edu' }), m({ id: 'b', url: 'javascript:alert(1)' }), m({ id: 'c', url: 'http://plain.example.edu' })]);
    expect(r.shown.map((x) => x.url)).toEqual(['https://registrar.example.edu', undefined, undefined]);
  });

  it('quiet hours wrap midnight', () => {
    expect(inQuietHours(23 * 60, 22 * 60, 7 * 60)).toBe(true);
    expect(inQuietHours(6 * 60, 22 * 60, 7 * 60)).toBe(true);
    expect(inQuietHours(12 * 60, 22 * 60, 7 * 60)).toBe(false);
    expect(inQuietHours(12 * 60, 9 * 60, 9 * 60)).toBe(false);
  });

  it('holds optional messages in quiet hours and never holds or mutes a required one', () => {
    const prefs = { ...EMPTY_PREFS, muted: ['official' as const] };
    const req = m({ channel: 'official', priority: 'required', source: 'Registrar' });
    const opt = m({ channel: 'semester', priority: 'low', source: 'Launchpad' });
    const late = visible([req, opt], prefs, 23 * 60);
    expect(late.now).toEqual([req]);
    expect(late.held).toBe(1);
  });

  it('has no way to send anything', () => {
    const src = readFileSync(new URL('./comms.ts', import.meta.url), 'utf8');
    expect(src).not.toMatch(/export (async )?function (send|email|sms|text|push|notify)/i);
    expect(src).not.toMatch(/fetch\(/);
  });

  it('groups a weekly digest by the Monday of each week', () => {
    const g = digestGroups([m({ at: '2026-09-28T09:00:00Z' }), m({ at: '2026-10-04T09:00:00Z' }), m({ at: '2026-10-05T09:00:00Z' })], 'weekly');
    expect(g.map((x) => [x.key, x.items.length])).toEqual([['Week of 2026-09-28', 2], ['Week of 2026-10-05', 1]]);
  });

  it('reads stored preferences defensively', () => {
    expect(readHubPrefs({ muted: ['official', 'ads'], quietFrom: 2000, digest: 'hourly' })).toMatchObject({ muted: ['official'], quietFrom: EMPTY_PREFS.quietFrom, digest: 'instant' });
  });
});

describe('access modes', () => {
  it('toggles in registry order and drops what it does not know', () => {
    expect(toggleMode('sensory', 'plain')).toBe('plain,sensory');
    expect(toggleMode('plain,sensory', 'plain')).toBe('sensory');
    expect(readAccessModes('plain,telepathy,plain')).toEqual(['plain']);
    expect(hasMode(undefined, 'chunk')).toBe(false);
  });

  it('a preset adds modes and keeps the ones already on', () => {
    expect(withPreset('sensory', 'low-load')).toBe('plain,chunk,predictable,sensory');
  });

  it('survives a round trip through the look reader, minus anything unknown', () => {
    expect(readLook({ access: 'chunk,x-ray' } as never).access).toBe('chunk');
  });

  it('is only ever read through the access-mode reader — never inferred from behaviour', () => {
    for (const file of ['../screens/Launchpad.tsx', '../screens/Support.tsx', '../screens/Opportunities.tsx', '../screens/Hub.tsx']) {
      const src = readFileSync(new URL(file, import.meta.url), 'utf8');
      const reads = [...src.matchAll(/state\.access\b[^,)]*/g)];
      for (const r of reads) expect(src.slice(Math.max(0, r.index! - 20), r.index), file).toMatch(/hasMode\($/);
      expect(src, file).not.toMatch(/setLook[^}]*access/);
    }
    expect(ACCESS_MODES).toHaveLength(5);
  });
});

describe('the twenty-six areas', () => {
  it('are all here, numbered once each', () => {
    expect(AREAS.map((a) => a.n)).toEqual(Array.from({ length: 26 }, (_, i) => i + 1));
  });

  it('each lives somewhere that exists', () => {
    const ops = readFileSync(new URL('../components/institutional/OperationsStudio.tsx', import.meta.url), 'utf8');
    for (const a of AREAS) {
      expect(a.homes.length, `area ${a.n}`).toBeGreaterThan(0);
      for (const h of a.homes) {
        if ('screen' in h) expect(ROUTABLE.has(h.screen), `area ${a.n} → ${h.screen}`).toBe(true);
        if ('staff' in h) expect(ops, `area ${a.n} → ${h.tab}`).toContain(`id: '${h.tab}' as const`);
      }
      expect(() => readFileSync(new URL(`./${a.lib}`, import.meta.url)), a.lib).not.toThrow();
    }
  });
});
