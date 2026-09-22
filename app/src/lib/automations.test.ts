import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { MAY, running, runningLine, type Seen } from './automations';
import { DEFAULT_NOTIFS, NOTIF_DEFS } from '../data/misc';
import { newRule } from './myrules';
import type { Rule } from './mailrules';

/**
 * The one list of what is running, held against the engines it reads.
 */

const none: Seen = {
  notifs: Object.fromEntries(NOTIF_DEFS.map((d) => [d.k, false])) as Seen['notifs'],
  focus: 'off',
  myRules: [],
  mailRules: [],
  quiet: null,
  mutedCourses: [],
};

const mailRule = (patch: Partial<Rule> = {}): Rule => ({
  id: 'm1',
  name: 'Newsletter',
  when: 'from:news',
  folder: 'archive',
  created: 1,
  ...patch,
});

describe('what is running', () => {
  it('is nothing on a fresh account with every switch off, and says so', () => {
    expect(running(none)).toEqual([]);
    expect(runningLine([])).toMatch(/Nothing is running/);
  });

  it('lists every built-in reminder that is on, in its own words', () => {
    const rows = running({ ...none, notifs: DEFAULT_NOTIFS });
    const on = NOTIF_DEFS.filter((d) => DEFAULT_NOTIFS[d.k]);
    expect(rows.filter((r) => r.source === 'builtin').map((r) => r.says)).toEqual(on.map((d) => d.label));
    expect(runningLine(rows)).toMatch(new RegExp(`${on.length} reminders`));
  });

  it('shows a reminder focus has quieted as held, not gone', () => {
    // Switched on and not firing is a state the person should be able to
    // read; dropping the row would make focus look like it turned things off.
    const rows = running({ ...none, notifs: { ...DEFAULT_NOTIFS, free: true, sun: true }, focus: 'on' });
    const free = rows.find((r) => r.id === 'free');
    expect(free?.held).toMatch(/focus/);
    expect(rows.find((r) => r.id === 'class')?.held).toBeUndefined();
    expect(runningLine(rows)).toMatch(/held by focus/);
  });

  it('lists the rules of your own that are on, as the sentence MyRules shows', () => {
    const on = newRule(1);
    const off = { ...newRule(2), on: false };
    const rows = running({ ...none, myRules: [on, off] });
    expect(rows).toHaveLength(1);
    expect(rows[0].source).toBe('own');
    expect(rows[0].says).toMatch(/3 days before/);
    expect(runningLine(rows)).toMatch(/1 rule of your own/);
  });

  it('lists a mail rule only when it is on and does something', () => {
    const rows = running({
      ...none,
      mailRules: [mailRule(), mailRule({ id: 'm2', off: true }), mailRule({ id: 'm3', folder: undefined })],
    });
    expect(rows.map((r) => r.id)).toEqual(['m1']);
    expect(rows[0].says).toMatch(/Newsletter — Mail matching from:news will skip the inbox/);
    expect(runningLine(rows)).toMatch(/1 mail rule\./);
  });

  it('names quiet hours and a mute, and does not count an empty quiet window', () => {
    const rows = running({ ...none, quiet: { from: 22 * 60, to: 8 * 60 }, mutedCourses: ['econ'] });
    expect(rows.map((r) => r.source)).toEqual(['quiet', 'mute']);
    expect(rows[0].says).toMatch(/Quiet between/);
    expect(rows[1].says).toMatch(/One course is muted/);
    expect(runningLine(rows)).toMatch(/^Only quiet hours and a mute\./);
    expect(running({ ...none, quiet: { from: 60, to: 60 } })).toEqual([]);
  });

  it('counts everything in one sentence', () => {
    const rows = running({
      ...none,
      notifs: DEFAULT_NOTIFS,
      myRules: [newRule(1)],
      mailRules: [mailRule()],
      quiet: { from: 1, to: 2 },
      mutedCourses: ['a', 'b'],
    });
    const line = runningLine(rows);
    expect(line).toMatch(/^Running: \d+ reminders, 1 rule of your own, 1 mail rule; quiet hours, a mute\.$/);
  });
});

/**
 * §315, as a guard rather than a promise.
 *
 * An automation may notify, organise, draft and do reversible things; it may
 * not register or drop a course, send consequential email, buy or submit.
 * In this code the line falls in one place: the three engines are pure over
 * data on the device, or call the browser's Notification API, and nothing
 * else. A network call or a dispatch in any of them is the moment one could
 * start doing something a switch does not undo.
 */
describe('what an automation may do', () => {
  const engines = ['notify', 'myrules', 'mailrules'];
  const source = (name: string) => readFileSync(new URL(`./${name}.ts`, import.meta.url), 'utf8');

  it('is the allow-list, and the mail engine writes nothing outside it', () => {
    expect([...MAY]).toEqual(['notify', 'star', 'mark read', 'archive', 'label']);
    // The verbs `describeRule` can say are the verbs a mail rule has.
    const said = source('mailrules');
    expect(said).toContain("does.push('skip the inbox')");
    expect(said).toContain("does.push('be starred')");
    expect(said).not.toMatch(/send|forward|reply/i);
  });

  it('never reaches the network or the store from an engine', () => {
    for (const name of engines) {
      const code = source(name);
      expect(code, name).not.toMatch(/\bfetch\s*\(/);
      expect(code, name).not.toMatch(/XMLHttpRequest|sendBeacon|WebSocket/);
      expect(code, name).not.toMatch(/\bdispatch\s*\(/);
      expect(code, name).not.toMatch(/supabase|functions\/v1/);
    }
  });

  it('is drawn on Alerts, which is the one place §314 asks for', () => {
    const alerts = readFileSync(new URL('../screens/settings/Alerts.tsx', import.meta.url), 'utf8');
    expect(alerts).toContain('<RunningNow />');
    const panel = readFileSync(new URL('../components/RunningNow.tsx', import.meta.url), 'utf8');
    expect(panel).toMatch(/from '\.\.\/lib\/automations'/);
    // And the mail rules are switchable from there, not only listed.
    expect(panel).toContain("type: 'putMailRule'");
  });

  it('reads the files it claims to, or the case above proves nothing', () => {
    expect(source('notify')).toContain('new Notification');
    expect(source('mailrules')).toContain('export function ruleMarks');
    expect(source('myrules')).toContain('export function myReminders');
  });
});
