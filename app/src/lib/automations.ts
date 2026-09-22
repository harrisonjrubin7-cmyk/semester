/**
 * What the app is doing on its own right now, in one list.
 *
 * Platform §313–315 ask for automations a student can see, switch and
 * trust. The app has had automations for a long time — ten built-in
 * reminder rules, the student's own rules, mail rules, quiet hours, muted
 * courses — and every one of them was switchable where it lived. What no
 * screen answered was the sentence §313 puts in bold: *users must understand
 * what automations are active.* The reminders were on Alerts, the mail rules
 * were behind a button on Mail, and "what will this app do tonight without
 * me" had no one place to be read.
 *
 * This is that place, as data: every automation that is running, one row
 * each, in the words the screen it came from already uses. `components/
 * RunningNow.tsx` draws it at the top of Alerts, which is where the switches
 * are and so where §314's "enable, disable, edit and delete, in one place"
 * is met — the mail rules get their switch there too, so nothing is running
 * that cannot be stopped from the same screen it is listed on.
 *
 * ## What an automation here is allowed to do
 *
 * §315: notify, organise, draft, and reversible things — never register or
 * drop a course, send a consequential email, buy anything or submit an
 * application. Every engine this file reads from does one of two things: it
 * *says* something (`lib/notify.ts`, `lib/myrules.ts` — a browser
 * notification, from data already on the device) or it *marks* mail
 * (`lib/mailrules.ts` — star, read, archive, label, laid underneath the
 * person's own marks so a rule can never overrule them). `MAY` is that list
 * written down, and `automations.test.ts` reads the three engines' source to
 * check none of them has grown a network call or a dispatch — which is what
 * the line between "reversible" and "consequential" looks like in this code.
 */

import type { NotifKey } from '../data/misc';
import { NOTIF_DEFS } from '../data/misc';
import { essentialOnly } from './focus';
import { describeRule, doesSomething, ruleName, type Rule } from './mailrules';
import { ruleLine, type MyRule } from './myrules';
import { clock } from './date';
import type { Quiet } from './notify';

/** The verbs an automation in this app may have. §315's allow-list, as data. */
export const MAY = ['notify', 'star', 'mark read', 'archive', 'label'] as const;

/** Where a row came from, which is also where it is edited. */
export type Source = 'builtin' | 'own' | 'mail' | 'quiet' | 'mute';

export interface Running {
  source: Source;
  id: string;
  /** The sentence the screen it came from would use. */
  says: string;
  /**
   * Running, or listed but held. A built-in reminder that focus has quieted
   * is `held` rather than absent: it is still switched on, and the person
   * who switched it on should see that it is not firing and why.
   */
  held?: string;
}

/** What `running` reads. Named, so a test can build one without the store. */
export interface Seen {
  notifs: Record<NotifKey, boolean>;
  focus: string;
  myRules: MyRule[];
  mailRules: Rule[];
  quiet: Quiet | null;
  mutedCourses: string[];
}

/** Every automation that is on, one row each, in the order the screen lists them. */
export function running(s: Seen, courseCode?: (id: string) => string): Running[] {
  const out: Running[] = [];
  const view = essentialOnly(s.notifs, s.focus);
  for (const n of NOTIF_DEFS) {
    if (!s.notifs[n.k]) continue;
    out.push({
      source: 'builtin',
      id: n.k,
      says: n.label,
      held: view[n.k] ? undefined : 'quiet while focus is on',
    });
  }
  for (const r of s.myRules) {
    if (!r.on) continue;
    out.push({ source: 'own', id: r.id, says: ruleLine(r, courseCode) });
  }
  for (const r of s.mailRules) {
    if (r.off || !doesSomething(r)) continue;
    out.push({ source: 'mail', id: r.id, says: `${ruleName(r)} — ${describeRule(r)}` });
  }
  if (s.quiet && s.quiet.from !== s.quiet.to) {
    out.push({
      source: 'quiet',
      id: 'quiet',
      says: `Quiet between ${clock(s.quiet.from)} and ${clock(s.quiet.to)}; anything due then arrives after.`,
    });
  }
  if (s.mutedCourses.length > 0) {
    const n = s.mutedCourses.length;
    out.push({
      source: 'mute',
      id: 'mute',
      says: `${n === 1 ? 'One course is' : `${n} courses are`} muted — nothing about ${n === 1 ? 'it' : 'them'} fires.`,
    });
  }
  return out;
}

/** One line for the top of the screen, counting what `running` returned. */
export function runningLine(rows: Running[]): string {
  const live = rows.filter((r) => !r.held);
  if (live.length === 0) {
    return rows.length === 0
      ? 'Nothing is running. The app does nothing on its own until something below is switched on.'
      : `Nothing is firing — ${rows.length === 1 ? 'the one thing switched on is' : `all ${rows.length} switched on are`} held while focus is on.`;
  }
  const by = (source: Source) => live.filter((r) => r.source === source).length;
  const parts: string[] = [];
  const builtin = by('builtin');
  if (builtin) parts.push(`${builtin} ${builtin === 1 ? 'reminder' : 'reminders'}`);
  const own = by('own');
  if (own) parts.push(`${own} ${own === 1 ? 'rule' : 'rules'} of your own`);
  const mail = by('mail');
  if (mail) parts.push(`${mail} mail ${mail === 1 ? 'rule' : 'rules'}`);
  const held = rows.length - live.length;
  const tail = [
    by('quiet') ? 'quiet hours' : '',
    by('mute') ? 'a mute' : '',
    held ? `${held} held by focus` : '',
  ].filter(Boolean);
  const said = parts.length === 0 ? 'Only ' + tail.join(' and ') : `Running: ${parts.join(', ')}`;
  return `${said}${parts.length && tail.length ? `; ${tail.join(', ')}` : ''}.`;
}
