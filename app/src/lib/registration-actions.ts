import type { Action } from './actions';
import type { CatalogCourse } from './registration';
import { CHECKLIST, localTime, modeActive, readiness, type RegistrationDayData } from './registration-day';
import { toHash } from './route';

/**
 * Registration readiness, as actions for the Action Center (BL-1.4).
 *
 * While Registration Day Mode is showing (`modeActive`), each thing still
 * standing between the student and a calm registration becomes one action
 * in the "Registration readiness" group: add the time, choose a backup for
 * each section that has none, resolve a clash, and each checklist item not
 * yet ticked. Outside the mode there are none — the checklist is not a
 * nagging list for the other fifty weeks of the year.
 *
 * Every action opens the registration workspace. None registers anything,
 * and none claims to know about holds or seats: those items say they are the
 * student's to check in the official system.
 *
 * Ids are stable (`regday:backup:<section id>`, `regday:check:<id>`), so a
 * snooze or a dismissal survives the next render.
 */

export const READINESS_GROUP = 'Registration readiness';

const open = (label: string) => ({
  label,
  kind: 'navigate' as const,
  target: toHash({ screen: 'yes', id: '' }),
  requiresConfirmation: false,
});

const LIMITS = [
  'Semester cannot see your official registration record, holds or live seats.',
  'Nothing here registers you. You enroll in your school’s own system.',
];

export function registrationActions(
  data: RegistrationDayData,
  cart: CatalogCourse[],
  catalog: CatalogCourse[],
  now: Date,
): Action[] {
  if (!modeActive(data, now)) return [];
  const opens = localTime(data.opensAt)?.getTime() ?? null;
  const due = opens !== null && opens > now.getTime() ? opens : null;
  const soon = due !== null && due - now.getTime() <= 3 * 86_400_000;
  const base = { type: 'registration', group: READINESS_GROUP, dueAt: due } as const;
  const out: Action[] = [];

  if (opens === null) {
    out.push({
      ...base,
      id: 'regday:time',
      title: 'Add your registration time',
      whyItMatters: 'The countdown, the reminders and this checklist all run from it.',
      priority: 'high',
      source: { label: 'student_entered', system: 'Your registration-day plan' },
      explanation: {
        trigger: 'Registration Day Mode is on, and no registration time is recorded.',
        factors: ['No time ticket entered'],
        expectedImpact: 'A countdown, and reminders the day before and the hour before.',
        limitations: ['Semester does not know your time ticket. Copy it from your school’s registration system.', ...LIMITS.slice(1)],
        alternatives: ['Turn Registration Day Mode off until your time is posted.'],
      },
      primary: open('Add registration time'),
    });
  }

  if (!cart.length) {
    out.push({
      ...base,
      id: 'regday:cart',
      title: 'Build your registration cart',
      whyItMatters: 'Backups, conflicts and the section list all start from the sections you plan to take.',
      priority: 'high',
      source: { label: 'imported', system: 'Your imported course catalog' },
      explanation: {
        trigger: 'Your registration window is close and the cart is empty.',
        factors: ['No sections in the cart'],
        expectedImpact: 'A primary plan you can check before the window opens.',
        limitations: LIMITS,
        alternatives: ['Load a saved potential schedule into the cart.'],
      },
      primary: open('Open registration'),
    });
    return out;
  }

  const ready = readiness(data, cart, catalog);
  for (const c of ready.unbacked) {
    out.push({
      ...base,
      id: `regday:backup:${c.id}`,
      title: `Choose a backup for ${c.code}`,
      whyItMatters: `If section ${c.section} is full, you will know what to try next without deciding on the spot.`,
      priority: soon ? 'critical' : 'high',
      source: { label: 'imported', system: 'Your imported course catalog' },
      explanation: {
        trigger: `${c.code} section ${c.section} is in your cart with no backup chosen.`,
        factors: [`${c.code} · section ${c.section}`, 'Other sections and nearby courses that fit around the rest of your cart'],
        expectedImpact: 'One less decision to make while the window is open.',
        limitations: ['Seat counts come from your imported catalog, not a live feed.', ...LIMITS.slice(1)],
        alternatives: ['Ask your advisor which course could satisfy the same requirement.'],
      },
      primary: open('Choose a backup'),
    });
  }

  if (ready.conflicts > 0) {
    out.push({
      ...base,
      id: 'regday:conflicts',
      title: ready.conflicts === 1 ? 'Resolve a time conflict in your cart' : `Resolve ${ready.conflicts} time conflicts in your cart`,
      whyItMatters: 'Most registration systems refuse overlapping sections, and the refusal comes at the worst moment.',
      priority: soon ? 'critical' : 'high',
      source: { label: 'imported', system: 'Meeting times from your imported catalog' },
      explanation: {
        trigger: 'Two sections in your cart meet at the same time.',
        factors: [`${ready.conflicts} overlapping pair${ready.conflicts === 1 ? '' : 's'}`],
        expectedImpact: 'A cart the registration system can accept in one go.',
        limitations: ['Meeting times are only as current as the catalog you imported.', ...LIMITS.slice(1)],
        alternatives: ['Swap one section for another section of the same course.'],
      },
      primary: open('Review cart'),
    });
  }

  for (const item of CHECKLIST) {
    if (data.checks.includes(item.id)) continue;
    out.push({
      ...base,
      id: `regday:check:${item.id}`,
      title: item.label,
      whyItMatters: item.why,
      priority: soon ? 'high' : 'normal',
      source: { label: 'student_entered', system: 'Your registration checklist' },
      explanation: {
        trigger: 'This item on your registration checklist is not ticked yet.',
        factors: ['Registration checklist'],
        expectedImpact: 'One fewer way for the window to go wrong.',
        limitations: ['Only you can check this, in your school’s own systems. Semester records the tick.', ...LIMITS.slice(1)],
        alternatives: ['Tick it on the registration checklist once you have checked.'],
      },
      primary: open('Open checklist'),
    });
  }

  return out;
}
