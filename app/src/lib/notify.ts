/**
 * Reminders that actually arrive.
 *
 * Settings has offered six "tell me when" toggles since the app was built, and
 * every one of them did nothing: no permission was ever requested and no
 * notification was ever shown. A switch that lies is worse than no switch,
 * because it is the reason somebody stops checking.
 *
 * **What this does and does not do**, because the difference matters and the
 * screen says it too. It uses the browser's own Notification API, which fires
 * while the app is running — a tab open on a laptop, or the installed app in
 * the background on a desktop. It cannot wake a phone whose browser is closed:
 * that needs Web Push, which needs a push service, VAPID keys and a server to
 * hold them, and pretending otherwise is exactly the failure this replaces.
 *
 * Everything is computed on the device from data already there. No schedule is
 * uploaded and nothing is sent anywhere.
 */

import { money } from './bill';
import type { NotifKey } from '../data/misc';
import { daysTo, type TermDate } from './registrar';
import { isExam } from './runway';
import type { DatedItem } from './types';

const SEEN_KEY = 'semester.notified';

export type Permission = 'unsupported' | 'default' | 'granted' | 'denied';

export function permission(): Permission {
  if (typeof Notification === 'undefined') return 'unsupported';
  return Notification.permission as Permission;
}

export async function requestPermission(): Promise<Permission> {
  if (typeof Notification === 'undefined') return 'unsupported';
  try {
    return (await Notification.requestPermission()) as Permission;
  } catch {
    return 'denied';
  }
}

/** Ids already fired, so a reminder shows once rather than every tick. */
function seen(): Set<string> {
  try {
    return new Set(JSON.parse(localStorage.getItem(SEEN_KEY) ?? '[]') as string[]);
  } catch {
    return new Set();
  }
}

function remember(ids: Set<string>): void {
  try {
    // Bounded: a semester of reminders is a few hundred, and the oldest are of
    // no interest once fired.
    localStorage.setItem(SEEN_KEY, JSON.stringify([...ids].slice(-400)));
  } catch {
    /* storage off; reminders may repeat this session */
  }
}

export interface Reminder {
  /** Unique per reminder per day, so it fires once. */
  id: string;
  rule: NotifKey;
  title: string;
  body: string;
}

interface Source {
  items: DatedItem[];
  /**
   * What has already been ticked off.
   *
   * Optional only because a caller that has nothing ticked can leave it out;
   * the app always passes it. Without it every rule here counted finished
   * work, so a student who handed in all three of Thursday's deadlines on
   * Wednesday night was still told on Thursday morning that three were due.
   * A reminder about work you have done is the reason people turn reminders
   * off, and it costs the ones that matter their credibility.
   */
  done?: Record<string, boolean>;
  /** Blocks on today's rail: label and minutes-from-midnight. */
  classes: { label: string; at: number; where: string }[];
  /** The university's own dates, if the student has filled any in. */
  registrar?: TermDate[];
  /**
   * Classes today in a course whose absence allowance is nearly or already
   * gone. Worked out by the caller with `lib/attend.ts`, not here: the absence
   * arithmetic has one implementation and this file is not going to become a
   * second one.
   */
  atRisk?: AtRisk[];
  /**
   * The next unpaid instalment on the term's bill, worked out by the caller
   * with `lib/bill.ts`.
   *
   * Same division as `atRisk` above: the money arithmetic has one
   * implementation and this file is not going to become a second one. All that
   * is decided here is when to say it.
   */
  bill?: { due: string; cents: number } | null;
}

/**
 * The rail as a reminder should read it.
 *
 * Here rather than at the two call sites because there are two call sites and
 * they disagreed. The push queue filtered a cancelled or optional block out
 * and the in-page timer did not, so the same rule sent a phone
 * "PSCI 1104 — canceled in 10 min" through one path and nothing through the
 * other. That sentence is in the app's own shipped syllabus data: PSCI has
 * two blocks marked cancelled on 3 September, one of them an office hour that
 * was optional as well.
 *
 * A block that is not happening is not a class to leave for, and an optional
 * one is not a class you are late for. Neither earns a buzz.
 */
export function classesToNudge(
  rail: { title: string; meta: string; at: number; canceled?: boolean; optional?: boolean }[],
): { label: string; at: number; where: string }[] {
  return rail
    .filter((b) => !b.optional && !b.canceled)
    .map((b) => ({ label: b.title, at: b.at, where: b.meta }));
}

/** A class meeting worth a warning, and why it is worth one. */
export interface AtRisk {
  code: string;
  /** Minutes from midnight, matching `classes`. */
  at: number;
  /** How it reads on a clock — "1:15". */
  clock: string;
  /** Absences left before the penalty starts. 0 means it has already begun. */
  left: number;
  /** What one more costs, in points of the final grade. */
  costs: number;
}

/** How long before the class the warning is worth having. */
export const ATTEND_LEAD = 45;

const day = (d: Date) => `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;

/**
 * The Sunday that starts this week, as an id.
 *
 * The attendance nudge fires once per course per week rather than before every
 * meeting: three warnings in a week about the same absence is not three times
 * the help, it is the reason people turn reminders off.
 */
const week = (d: Date) => {
  const s = new Date(d.getFullYear(), d.getMonth(), d.getDate() - d.getDay());
  return `${s.getFullYear()}-${s.getMonth()}-${s.getDate()}`;
};

/**
 * Everything that should have fired by `now` today, given the rules that are
 * on. Pure, so the whole thing is testable without a browser.
 */
export function dueReminders(
  now: Date,
  on: Record<NotifKey, boolean>,
  src: Source,
): Reminder[] {
  const out: Reminder[] = [];
  const today = day(now);
  const minutes = now.getHours() * 60 + now.getMinutes();
  const done = src.done ?? {};
  const left = (i: DatedItem): boolean => !done[i.id];
  // Two different questions, and only one of them is about work still to do.
  // `onToday` is what the day holds; `todays` is what is left of it.
  const onToday = src.items.filter((i) => i.isToday);
  const todays = onToday.filter(left);

  // Before the class rather than after the absence. Everything that decides
  // *whether* to warn happened in `lib/attend.ts` and arrived in `atRisk`;
  // what is decided here is only when to say it and how it reads.
  if (on.attend) {
    for (const r of src.atRisk ?? []) {
      const away = r.at - minutes;
      if (away <= 0 || away > ATTEND_LEAD) continue;
      out.push({
        id: `attend:${week(now)}:${r.code}`,
        rule: 'attend',
        title: `${r.code} at ${r.clock}`,
        body:
          r.left > 0
            ? `${r.left === 1 ? 'One absence' : `${r.left} absences`} left before the penalty.`
            : r.costs > 0
              ? `Past the allowance. Another costs ${r.costs}% of the final grade.`
              : 'Past the allowance already.',
      });
    }
  }

  if (on.class) {
    for (const c of src.classes) {
      const away = c.at - minutes;
      if (away > 0 && away <= 15) {
        out.push({
          id: `class:${today}:${c.label}`,
          rule: 'class',
          title: `${c.label} in ${away} min`,
          body: c.where || 'Starting shortly',
        });
      }
    }
  }

  if (on.today && minutes >= 8 * 60 && todays.length > 0) {
    out.push({
      id: `today:${today}`,
      rule: 'today',
      title: `${todays.length} due today`,
      body: todays.map((i) => i.title).slice(0, 3).join(' · '),
    });
  }

  // Deliberately about the day rather than about the list: the all-clear is
  // for a day that had nothing on it, not for a list you have just cleared.
  // Firing it on the second would contradict the "3 due today" that went out
  // the same morning, and two notifications a day apart on the same facts is
  // worse than one.
  if (on.free && minutes >= 8 * 60 && onToday.length === 0) {
    out.push({
      id: `free:${today}`,
      rule: 'free',
      title: 'Nothing due today',
      body: 'The all-clear you asked for.',
    });
  }

  if (on.two) {
    for (const i of src.items.filter((x) => x.daysAway === 2 && left(x))) {
      out.push({
        id: `two:${today}:${i.id}`,
        rule: 'two',
        title: `Two days: ${i.title}`,
        body: `${i.dueShort} · ${i.weight || i.kind}`,
      });
    }
  }

  // A registrar deadline at a week and again at a day. Twice rather than
  // daily for a fortnight: the app's job here is to make sure the date is not
  // a surprise, not to become the thing you swipe away every morning.
  if (on.term && minutes >= 8 * 60) {
    for (const d of src.registrar ?? []) {
      if (!d.iso || d.kind === 'break') continue;
      const away = daysTo(d.iso, now);
      if (away !== 7 && away !== 1) continue;
      out.push({
        id: `term:${today}:${d.id}`,
        rule: 'term',
        title: away === 1 ? `Tomorrow: ${d.label}` : `One week: ${d.label}`,
        body: d.cost || 'From your registrar.',
      });
    }
  }

  /*
   * A tuition instalment at a week and again at a day, on the same two-strike
   * rhythm as the registrar dates above — and for the same reason: the job is
   * to make sure the date is not a surprise, not to become the thing swiped
   * away every morning for a fortnight.
   *
   * Separate from `term` rather than folded into it, because the registrar
   * rule reads `src.registrar` and a payment date is not a registrar date: it
   * lives on the plan, where the student entered it, and a student who wants
   * academic deadlines without money notifications can now have exactly that.
   */
  if (on.bill && minutes >= 8 * 60 && src.bill) {
    const away = daysTo(src.bill.due, now);
    if (away === 7 || away === 1) {
      out.push({
        id: `bill:${today}:${src.bill.due}`,
        rule: 'bill',
        title: away === 1 ? 'Tomorrow: tuition payment' : 'One week: tuition payment',
        body: `${money(src.bill.cents)} due. An unpaid balance is what puts a hold on next term's registration.`,
      });
    }
  }

  // At four weeks as well as at one. Four is where the runway starts, and the
  // whole point of it is that the week to act is not the week before.
  if (on.exam) {
    for (const i of src.items) {
      if (i.daysAway !== 7 && i.daysAway !== 28) continue;
      if (!isExam(i) || !left(i)) continue;
      out.push({
        id: `exam:${today}:${i.id}`,
        rule: 'exam',
        title: i.daysAway === 7 ? `One week: ${i.title}` : `Four weeks: ${i.title}`,
        body:
          i.daysAway === 7
            ? `${i.dueShort} · ${i.weight || i.kind}`
            : 'Far enough out to find what you do not know. See the runway.',
      });
    }
  }

  // Sunday evening: the weekly report, which covers the week just gone as
  // well as the one starting tomorrow.
  //
  // It fires whether or not anything is due next week, which is a change from
  // when this only looked forward. A week with nothing coming is exactly the
  // week worth reading the backward half of — what slipped, what was drilled,
  // what has had no attention — and staying silent on it meant the report
  // never arrived in the weeks it would have helped most.
  if (on.sun && now.getDay() === 0 && minutes >= 18 * 60) {
    const week = src.items.filter((i) => i.daysAway > 0 && i.daysAway <= 7 && left(i));
    out.push({
      id: `sun:${today}`,
      rule: 'sun',
      title: 'Your weekly report',
      body:
        week.length > 0
          ? `${week.length} due this week · ${week
              .map((i) => i.title)
              .slice(0, 2)
              .join(' · ')}`
          : 'Nothing due next week — a good one to look back on.',
    });
  }

  return out;
}

/**
 * Show whatever is due and has not been shown.
 *
 * Returns how many were shown, which is how the caller stays quiet when the
 * answer is none.
 */
export function fire(reminders: Reminder[]): number {
  if (permission() !== 'granted') return 0;
  const already = seen();
  let shown = 0;
  for (const r of reminders) {
    if (already.has(r.id)) continue;
    try {
      new Notification(r.title, { body: r.body, tag: r.id, icon: 'icon-192.png' });
      already.add(r.id);
      shown += 1;
    } catch {
      // Some browsers only allow notifications from a service worker. Nothing
      // to fall back to here; the toggle still shows its true state.
      break;
    }
  }
  if (shown > 0) remember(already);
  return shown;
}

/**
 * The reminders the next few days will produce, with when each one fires.
 *
 * `dueReminders` answers "what should have fired by now", which is the right
 * question for a tab that is open and the wrong one for a phone that is not:
 * a push has to be queued before it is due.
 *
 * So this walks the clock forward and collects each reminder the first time it
 * appears. Deliberately the same function doing the deciding — a second
 * implementation of "when should this fire" living on a server would drift
 * from this one within a term, and the divergence would show up as a
 * notification about a deadline that had moved.
 *
 * Quarter-hourly, because the tightest rule in `dueReminders` is a fifteen
 * minute warning before a class; anything coarser would miss it.
 */
export function planAhead(
  from: Date,
  days: number,
  on: Record<NotifKey, boolean>,
  forDay: (d: Date) => Source,
): { id: string; title: string; body: string; at: number }[] {
  const out: { id: string; title: string; body: string; at: number }[] = [];
  const seen = new Set<string>();
  const STEP = 15 * 60 * 1000;

  const end = from.getTime() + days * 86_400_000;

  for (let t = from.getTime(); t <= end; t += STEP) {
    const at = new Date(t);
    // The source changes by day — today's classes, today's deadlines — so it
    // is asked for per day rather than computed once.
    const src = forDay(at);
    for (const r of dueReminders(at, on, src)) {
      if (seen.has(r.id)) continue;
      seen.add(r.id);
      out.push({ id: r.id, title: r.title, body: r.body, at: t });
    }
  }

  return out.sort((a, b) => a.at - b.at);
}
