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
  /** Blocks on today's rail: label and minutes-from-midnight. */
  classes: { label: string; at: number; where: string }[];
  /** The university's own dates, if the student has filled any in. */
  registrar?: TermDate[];
}

const day = (d: Date) => `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;

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
  const todays = src.items.filter((i) => i.isToday);

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

  if (on.free && minutes >= 8 * 60 && todays.length === 0) {
    out.push({
      id: `free:${today}`,
      rule: 'free',
      title: 'Nothing due today',
      body: 'The all-clear you asked for.',
    });
  }

  if (on.two) {
    for (const i of src.items.filter((x) => x.daysAway === 2)) {
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

  // At four weeks as well as at one. Four is where the runway starts, and the
  // whole point of it is that the week to act is not the week before.
  if (on.exam) {
    for (const i of src.items) {
      if (i.daysAway !== 7 && i.daysAway !== 28) continue;
      if (!isExam(i)) continue;
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
    const week = src.items.filter((i) => i.daysAway > 0 && i.daysAway <= 7);
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
