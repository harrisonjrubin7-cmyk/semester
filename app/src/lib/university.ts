/**
 * The university, as far as this app can honestly reach it.
 *
 * Two halves, and keeping them apart is the whole design. The first is a
 * client for a school's gateway — status, records, and the two-step action —
 * and it does nothing at all until a school has deployed one and configured
 * its address. The second is *preparation*: drafts written on this device,
 * for a conversation with an advisor or a form that will be filed somewhere
 * else. The second works today and always will. The first is dark.
 *
 * ## Why the dark half is here at all
 *
 * Because the alternative is a screen that pretends. A student looking at
 * "Course registration" needs to know whether this app can register them —
 * and the answer is no, it cannot, until Vanderbilt says otherwise. Writing
 * the client now, with the empty adapter registry visible on screen, is how
 * that answer gets stated rather than implied. See
 * `docs/UNIVERSITY_CONNECTIONS.md`.
 *
 * ## Rules that are not negotiable
 *
 * A local plan, a draft, an imported seat count, an estimate: none may ever
 * be drawn as an official submission, a live record, an enrolment or a
 * payment. The role chosen on screen picks a draft template and nothing else
 * — what a person may actually see comes from `InstitutionStatus.roles`,
 * which only the school's gateway can set. And every action that would reach
 * an institution is prepare-then-confirm, never one tap.
 */

import { UNIVERSITY_AREAS as AREAS, UNIVERSITY_ROLES as ROLES } from '@semester/institution';
import { currentSession } from './cloud';
import type {
  ActionInput,
  InstitutionStatus,
  Receipt,
  RecordPage,
  Review,
  UniversityArea,
  UniversityRole,
} from '@semester/institution';

export { UNIVERSITY_AREAS, UNIVERSITY_ROLES } from '@semester/institution';
export type {
  InstitutionStatus,
  Receipt,
  RecordAction,
  Review,
  UniversityArea,
  UniversityRecord,
  UniversityRole,
} from '@semester/institution';

/**
 * Whether a school has given this build a gateway to talk to.
 *
 * Read once, at module load, from the build's environment. False is the
 * ordinary state and the one every screen must draw correctly.
 */
export const gatewayConfigured = !!import.meta.env.VITE_UNIVERSITY_GATEWAY_URL;

/**
 * One request to the school's gateway.
 *
 * The checks before the `fetch` are the interesting part, and each is there
 * for a reason worth keeping:
 *
 *  - **The address must be secure.** `https:` anywhere real; `http:` only
 *    when both the gateway and the page are on this machine, which is what
 *    makes local development possible without making a plaintext gateway
 *    possible in production.
 *  - **No credentials, query or fragment in the configured address.** A
 *    gateway URL carrying `?token=` or a userinfo pair is a misconfiguration
 *    that would put a secret into every request line and every proxy log.
 *  - **`redirect: 'error'`.** A gateway that answers with a redirect is not
 *    the gateway; following one would send the bearer token to wherever it
 *    pointed.
 *  - **`credentials: 'omit'`.** The session token is the only thing that
 *    should authenticate this, and it is sent deliberately. Ambient cookies
 *    riding along would be a second, invisible one.
 *  - **A timeout.** A school's system that stops answering must fail, not
 *    hang a screen with a spinner on it forever.
 */
async function gateway<T>(path: string, body?: unknown): Promise<T> {
  if (!gatewayConfigured) {
    throw new Error(
      'An approved university connection has not been configured yet. Your planning tools still work.',
    );
  }

  const url = new URL(import.meta.env.VITE_UNIVERSITY_GATEWAY_URL, location.origin);
  const local = ['localhost', '127.0.0.1'];
  const secure =
    url.protocol === 'https:' ||
    (url.protocol === 'http:' && local.includes(url.hostname) && local.includes(location.hostname));
  if (url.username || url.password || url.search || url.hash || !secure) {
    throw new Error('The university gateway must use a secure configured address.');
  }

  const session = await currentSession();
  if (!session) throw new Error('Sign in to your school-approved Semester account first.');

  const response = await fetch(`${url.href.replace(/\/$/, '')}${path}`, {
    method: body ? 'POST' : 'GET',
    headers: {
      Authorization: `Bearer ${session.access_token}`,
      ...(body ? { 'Content-Type': 'application/json' } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
    redirect: 'error',
    credentials: 'omit',
    signal: AbortSignal.timeout(25_000),
  });

  const result = await response.json();
  if (!response.ok) {
    throw new Error(
      typeof result.error === 'string' ? result.error : 'The connection could not complete this request.',
    );
  }
  return result as T;
}

/** What the school says this account may see, per area. */
export const institutionStatus = () => gateway<InstitutionStatus>('/status');

/** One page of a school's own records. Never copied into a local draft. */
export const institutionRecords = (area: UniversityArea, search: string, cursor?: string | null) =>
  gateway<RecordPage>(`/records?${new URLSearchParams({ area, search, ...(cursor ? { cursor } : {}) })}`);

/**
 * Step one of two: what this action *would* do. Changes nothing.
 *
 * Split from the commit below so that no single tap can reach a registrar.
 * The `Review` it returns carries an expiry, so one left open in a tab
 * overnight cannot be confirmed against a record that has moved since.
 */
export const prepareInstitutionAction = (input: ActionInput) => gateway<Review>('/actions/prepare', input);

/** Step two: do it, against a review the person has explicitly confirmed. */
export const commitInstitutionAction = (reviewId: string) =>
  gateway<Receipt>('/actions/commit', { reviewId, confirmed: true });

/**
 * Ask again about an action whose outcome was never seen.
 *
 * The case this exists for: a commit that timed out, or a tab closed between
 * sending and answering. Retrying the *commit* there would risk doing it
 * twice — dropping a course twice, paying a bill twice — so this asks the
 * gateway what happened to that review instead, and the gateway answers from
 * its own journal. Idempotency belongs upstream; this is how the browser
 * reaches it.
 */
export const reconcileInstitutionAction = (reviewId: string) =>
  gateway<Receipt>('/actions/reconcile', { reviewId });

/** A preparation draft. Lives on this device, and says so wherever it is drawn. */
export interface UniversityDraft {
  id: string;
  role: UniversityRole;
  area: UniversityArea;
  title: string;
  body: string;
  due: string;
  courseId: string;
  steps: { id: string; text: string; done: boolean }[];
  updatedAt: string;
}

/** Caps, named once so the reader and the validator cannot disagree. */
export const DRAFT_LIMITS = {
  drafts: 50,
  title: 160,
  body: 30_000,
  id: 100,
  steps: 100,
  stepText: 500,
} as const;

/**
 * Drafts out of a file somebody chose, or an error.
 *
 * A draft export is an ordinary JSON file a person can edit, mail to
 * themselves, and re-import six months later — so it is read the way any
 * untrusted input is, with every bound stated. It refuses the whole file
 * rather than salvaging part of it: half an import is worse than none,
 * because the half that vanished is the half nobody notices.
 *
 * Accepts both an array and `{ drafts: [...] }`, because the exporter writes
 * the second and older copies hold the first.
 */
export function readUniversityDrafts(text: string): UniversityDraft[] {
  const value = JSON.parse(text);
  const rows = Array.isArray(value) ? value : value.drafts;
  if (!Array.isArray(rows) || rows.length > DRAFT_LIMITS.drafts) {
    throw new Error(`Use a Semester draft export with up to ${DRAFT_LIMITS.drafts} drafts.`);
  }

  const areas: string[] = AREAS.map(([id]) => id);
  const roles: string[] = [...ROLES];

  return rows.map((d) => {
    const strings = ['id', 'title', 'body', 'due', 'courseId', 'updatedAt'] as const;
    const shaped =
      d &&
      typeof d === 'object' &&
      roles.includes(d.role) &&
      areas.includes(d.area) &&
      strings.every((k) => typeof d[k] === 'string') &&
      d.title.length <= DRAFT_LIMITS.title &&
      d.body.length <= DRAFT_LIMITS.body &&
      d.id.length <= DRAFT_LIMITS.id &&
      d.courseId.length <= DRAFT_LIMITS.id &&
      Number.isFinite(Date.parse(d.updatedAt)) &&
      // An empty due date is the ordinary case; a present one must be a date.
      (!d.due || /^\d{4}-\d{2}-\d{2}$/.test(d.due)) &&
      Array.isArray(d.steps) &&
      d.steps.length <= DRAFT_LIMITS.steps &&
      !d.steps.some(
        (s: { id: unknown; text: unknown; done: unknown }) =>
          !s ||
          typeof s.id !== 'string' ||
          s.id.length > DRAFT_LIMITS.id ||
          typeof s.text !== 'string' ||
          s.text.length > DRAFT_LIMITS.stepText ||
          typeof s.done !== 'boolean',
      );

    if (!shaped) throw new Error('This draft export contains an invalid entry.');

    return {
      id: d.id,
      role: d.role,
      area: d.area,
      title: d.title,
      body: d.body,
      due: d.due,
      courseId: d.courseId,
      updatedAt: d.updatedAt,
      steps: d.steps.map((s: { id: string; text: string; done: boolean }) => ({
        id: s.id,
        text: s.text,
        done: s.done,
      })),
    };
  });
}
