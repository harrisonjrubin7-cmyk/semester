/**
 * What is due to be said today, worked out from the store.
 *
 * Lifted out of the provider's reminder interval so the thing that *fires*
 * reminders and the thing that *lists* them (the notifications feed,
 * `lib/read/notifications.ts`) read one function. Two copies would drift the
 * way the push queue and the in-page timer once did (see `classesToNudge`),
 * and the feed would then list a reminder the device never sent or the other
 * way round.
 */

import type { Catalog } from '../data/catalog';
import { atRiskToday } from '../lib/atrisk';
import { nextPayment } from '../lib/bill';
import { myReminders } from '../lib/myrules';
import { classesToNudge, dueReminders, type Reminder } from '../lib/notify';
import { storedWindow } from '../lib/registration-window';
import { datedItems, railFor } from '../lib/select';
import { beginNow, planFrom } from '../lib/start';
import type { State } from './shape';

/**
 * The slices of state reminders are worked out from, named — not the whole
 * store — so a caller that lists them can be checked against its effect's
 * dependency array (`reminders.deps.test.ts`) and the linter alike.
 */
export type ReminderSlices = Pick<
  State,
  | 'notifs' | 'mutedCourses' | 'appointments' | 'registrar' | 'myRules' | 'attendance' | 'attendPolicy'
  | 'done' | 'quiet' | 'term' | 'charges' | 'aid' | 'payments' | 'plans' | 'spent' | 'windows'
>;

export function remindersFor(
  state: ReminderSlices,
  catalog: Catalog,
  at: Date,
  courseCode: (id: string) => string,
): { rules: Reminder[]; mine: Reminder[] } {
  if (catalog.empty) return { rules: [], mine: [] };
  const items = datedItems(catalog, at);
  const rail = railFor(catalog, at, state.appointments);
  const rules = dueReminders(at, state.notifs, {
    items,
    done: state.done,
    classes: classesToNudge(rail),
    muted: state.mutedCourses,
    registrar: state.registrar,
    registrationOpens: storedWindow(),
    // The four lists `nextPayment` reads, named rather than passing the store.
    bill: nextPayment(
      { charges: state.charges, aid: state.aid, payments: state.payments, plans: state.plans },
      state.term,
      at,
    ),
    quiet: state.quiet,
    atRisk: atRiskToday(rail, state.attendance, state.attendPolicy, courseCode),
    // `planFrom` is the one calibration, so the reminder and the card on
    // Today cannot disagree about the date.
    starts: beginNow(
      planFrom({ items, done: state.done, spent: state.spent, windows: state.windows, now: at }),
    ),
  });
  // The student's own rules add and never subtract: see `lib/myrules.ts`.
  const mine: Reminder[] = myReminders(at, state.myRules, items, state.done).map((f) => ({
    id: f.id,
    rule: 'today' as const,
    title: f.title,
    body: f.body,
    why: 'Why: you set this up yourself, under “Your own reminders” in Settings.',
  }));
  return { rules, mine };
}
