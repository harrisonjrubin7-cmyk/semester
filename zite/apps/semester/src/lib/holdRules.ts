// Registration holds (connection institution → student, register C05). Pure rules, no zitejs imports.
// The canonical hold is the Student Holds record; every student-facing view reads it through holdView, which carries only
// the student-facing fields (never the reason staff gave for placing or lifting it).
import { APPROVED_TEMPLATES } from './authz';

export const HOLD_OFFICES = ['Registrar', 'Bursar', 'Advising', 'Student Affairs'] as const;
export type HoldOffice = (typeof HOLD_OFFICES)[number];

/** Approved role templates that may lift a hold placed by each office. An Administrator may lift any hold; the plain
 *  Staff role may not, because it says nothing about which office the person works in. */
export const OFFICE_RELEASERS: Record<HoldOffice, string[]> = {
  Registrar: ['Registrar staff', 'Registration specialist', 'Academic-records specialist'],
  Bursar: ['Student accounts staff'],
  Advising: ['Academic advisor'],
  'Student Affairs': [],
};

/** Why this person may not lift a hold from this office, or null when they may. */
export function releaseRefusal(roles: string[], templates: string[], office: string, approved: Set<string> = APPROVED_TEMPLATES): string | null {
  if (roles.includes('Administrator')) return null;
  const allowed = OFFICE_RELEASERS[office as HoldOffice];
  if (!allowed) return 'This hold has no owning office on record, so only an administrator can lift it.';
  if (templates.some((t) => approved.has(t) && allowed.includes(t))) return null;
  return `Only ${office} office staff can lift this hold.`;
}

export type HoldRecord = { id: string; label?: string | null; originatingOffice?: string | null; studentFacingMessage?: string | null; blocksRegistration?: boolean | null; status?: string | null };
export type HoldView = { id: string; title: string; office: string; message: string; blocksRegistration: boolean };

/** The student-facing projection of an active hold. */
export function holdView(h: HoldRecord): HoldView {
  return { id: h.id, title: h.label || 'Hold', office: h.originatingOffice || 'Institution office', message: h.studentFacingMessage || '', blocksRegistration: !!h.blocksRegistration };
}

export function activeViews(holds: HoldRecord[]): HoldView[] {
  return holds.filter((h) => h.status === 'Active').map(holdView);
}

/** The in-app notice sent when a hold is lifted. It reports the outcome; it does not say why, and it does not promise
 *  registration, because other holds or requirements may still apply. */
export function releaseNotice(label: string, office: string, remainingBlocking: number): string {
  const rest = remainingBlocking > 0
    ? `${remainingBlocking} other hold${remainingBlocking === 1 ? '' : 's'} still block${remainingBlocking === 1 ? 's' : ''} registration.`
    : 'No hold blocks registration now. Registration still checks your requirements when you submit.';
  return `Your ${label || 'hold'} was lifted by the ${office || 'institution'} office. ${rest}`;
}

/** Why a student response cannot be accepted, or null when it can. Mirrors hld_respond in lib/hldMigration.ts:
 *  only an active hold can be answered, and the answer must be substantive enough for the office to act on.
 *  A response never lifts a hold; it informs the office's decision. */
export function responseBlocker(status: string | null | undefined, body: string): string | null {
  if (status !== 'Active') return 'This hold is no longer active.';
  if (body.trim().length < 10) return 'Say a little more (at least 10 characters) so the office can act on it.';
  if (body.length > 2000) return 'Keep your response under 2,000 characters.';
  return null;
}

/** The in-app notice sent to the person who placed a hold when the student answers it. It names the hold only;
 *  the response itself is read in the holds desk, never copied into a notification. */
export function responseNotice(label: string, office: string): string {
  return `A student responded to the ${label || 'hold'} from the ${office || 'institution'} office. Read it in the holds desk before you decide about the hold.`;
}
