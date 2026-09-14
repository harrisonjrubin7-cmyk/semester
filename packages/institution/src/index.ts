/**
 * The gateway contract: what a school's systems and this app agree to say.
 *
 * A second module beside `@semester/contract`, and the split is the point.
 * That one is the *academic record* — courses, deadlines, notes — the shape
 * this app's own data takes on the wire between its own clients. This one is
 * the shape of a conversation with somebody else's server: a university's
 * registration system, its bursar, its LMS. They are different promises with
 * different owners, and merging them would mean a change to how a note syncs
 * could alter what the app sends a registrar.
 *
 * Imported by three things that must agree exactly: the browser (`lib/
 * university.ts`), the gateway server (`server/institution/`), and the tests
 * that stand between them. Copied into any of the three, it drifts.
 *
 * ## Nothing here reaches a real institution
 *
 * This is a transport shape and a validator, not an integration. The adapter
 * registry a school would populate is empty and stays empty until an approved
 * adapter is implemented and tested — see `docs/UNIVERSITY_CONNECTIONS.md`.
 * Every screen built on this must keep saying so: a local plan, a draft, an
 * imported seat count and an estimate are preparation, and may never be drawn
 * as an official submission, a live record, an enrolment or a payment.
 */

export const INSTITUTION_VERSION = 1;

/**
 * The thirty-seven service areas, each with the name a student would read.
 *
 * A flat list rather than a nested taxonomy. Every attempt to group these —
 * "academic", "money", "campus life" — puts at least one area in the wrong
 * box for somebody: financial aid is money to a bursar and academic progress
 * to an advisor, and athletics is campus life until it is a travel letter
 * about a missed midterm. The screen groups them for display; the contract
 * does not, so a regrouping is never a change to what the gateway is asked.
 */
export const UNIVERSITY_AREAS = [
  // Coursework, and what a school does with it.
  ['courses', 'Courses'],
  ['assignments', 'Assignments & submissions'],
  ['assessments', 'Quizzes & exams'],
  ['grades', 'Grades & feedback'],
  ['email', 'University email'],
  ['registration', 'Course registration'],
  ['advising', 'Advising'],

  // Money.
  ['billing', 'University bills'],
  ['aid', 'Financial aid'],

  // Being on a campus.
  ['dining', 'Dining'],
  ['housing', 'Housing'],
  ['mailroom', 'Campus mail'],
  ['transport', 'Transportation'],
  ['library', 'Libraries'],
  ['athletics', 'Athletics'],
  ['recreation', 'Recreation & intramurals'],
  ['clubs', 'Clubs & organizations'],

  // Before and after the degree.
  ['career', 'Career & employers'],
  ['alumni', 'Alumni & mentorship'],
  ['abroad', 'Study abroad'],
  ['forms', 'Forms & surveys'],
  ['records', 'Student records & transcripts'],
  ['admissions', 'Admissions'],
  ['orientation', 'Welcome & orientation'],
  ['graduate', 'Graduate & professional education'],
  ['research', 'Research & ethics'],
  ['international', 'International student services'],
  ['accessibility', 'Accessibility services'],
  ['appeals', 'Feedback & appeals'],
  ['directory', 'University directory'],
  ['graduation', 'Graduation & credentials'],
  ['family', 'Authorized family access'],
  ['support', 'Help & service status'],

  // The four a student hopes not to need.
  ['health', 'Health services'],
  ['safety', 'Campus safety'],
  ['identity', 'Student ID'],
  ['admin', 'Administration'],
] as const;

export type UniversityArea = (typeof UNIVERSITY_AREAS)[number][0];

/**
 * The six roles a *draft* can be written as.
 *
 * Read the name of this type carefully, because the whole security posture of
 * the university work rests on it: these choose a template, and nothing else.
 * A person picking "Administrator" here gets administrator-shaped headings in
 * a document on their own device. What they may actually *see* comes from
 * `InstitutionStatus.roles`, which is a verified grant from the school's own
 * gateway and cannot be set from the browser. The two are deliberately
 * different fields with different names so that no screen can confuse them.
 */
export const UNIVERSITY_ROLES = ['student', 'faculty', 'advisor', 'admin', 'payer', 'staff'] as const;

export type UniversityRole = (typeof UNIVERSITY_ROLES)[number];

export type FieldKind = 'text' | 'textarea' | 'date' | 'datetime-local' | 'email' | 'number' | 'select';

export interface ActionField {
  id: string;
  label: string;
  kind: FieldKind;
  required: boolean;
  options?: string[];
}

export interface RecordAction {
  id: string;
  label: string;
  fields: ActionField[];
}

export interface UniversityRecord {
  id: string;
  area: UniversityArea;
  title: string;
  summary: string;
  status: string;
  /**
   * What the school last said this record's revision was.
   *
   * Sent back with any action taken on it, so the gateway can refuse an action
   * prepared against a record that has since moved. Without it, a student who
   * opened a bill on Monday could pay Monday's amount on Friday.
   */
  version: string;
  updatedAt: string;
  details: { label: string; value: string }[];
  actions: RecordAction[];
}

export interface ConnectionStatus {
  area: UniversityArea;
  state: 'not-configured' | 'connected' | 'error' | 'disconnected';
  provider: string;
  canRead: boolean;
  canWrite: boolean;
  lastSyncAt: string | null;
  permissions: string[];
  message: string;
}

export interface InstitutionStatus {
  version: 1;
  institutionId: string;
  institutionName: string;
  /** Verified by the school. Never the local role selector — see above. */
  roles: UniversityRole[];
  connections: ConnectionStatus[];
}

export interface RecordPage {
  records: UniversityRecord[];
  nextCursor: string | null;
  fetchedAt: string;
}

export interface ActionInput {
  area: UniversityArea;
  recordId: string;
  version: string;
  actionId: string;
  fields: Record<string, string>;
}

/**
 * What an action will do, before it is done.
 *
 * Every action that reaches a school is two round trips: prepare, which
 * returns this and changes nothing, and commit, which needs its id and an
 * explicit confirmation. A one-shot "submit" is what turns a mis-tap into a
 * dropped course, and the expiry is what stops a review sitting open in a tab
 * for a day and being confirmed against a changed record.
 */
export interface Review {
  id: string;
  title: string;
  details: { label: string; value: string }[];
  expiresAt: string;
}

export interface Receipt {
  id: string;
  status: 'completed' | 'pending';
  message: string;
  recordedAt: string;
}

export const isUniversityArea = (value: unknown): value is UniversityArea =>
  UNIVERSITY_AREAS.some(([id]) => id === value);

/**
 * Who the gateway believes is asking.
 *
 * Three fields, and the omissions are deliberate: no browser preferences, no
 * `user_metadata`, nothing the client can write. An identity assembled partly
 * from data the client controls is not an identity.
 */
export interface UniversityIdentity {
  userId: string;
  institutionId: string;
  roles: UniversityRole[];
}

/**
 * An action off the wire, or an error.
 *
 * Runs on the *server* as well as the browser — it is the gateway's front
 * door — so it assumes the input is hostile and states every bound rather
 * than trusting the type. The caps are there to make a request that would
 * exhaust the gateway fail here, cheaply, instead of downstream.
 */
export function parseAction(value: unknown): ActionInput {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Invalid action.');
  const v = value as Record<string, unknown>;

  const named = ['recordId', 'version', 'actionId'] as const;
  const namedOk = named.every((k) => {
    const x = v[k];
    return typeof x === 'string' && x.length > 0 && x.length <= 200;
  });
  if (!isUniversityArea(v.area) || !namedOk) throw new Error('Choose a record and action.');

  if (!v.fields || typeof v.fields !== 'object' || Array.isArray(v.fields)) {
    throw new Error('Invalid action fields.');
  }
  const entries = Object.entries(v.fields);
  const badField = entries.some(
    ([k, x]) => !/^[a-zA-Z][a-zA-Z0-9_-]{0,63}$/.test(k) || typeof x !== 'string' || x.length > 20000,
  );
  if (entries.length > 30 || badField) throw new Error('Action fields are too large or invalid.');

  return {
    area: v.area,
    recordId: v.recordId as string,
    version: v.version as string,
    actionId: v.actionId as string,
    fields: Object.fromEntries(entries) as Record<string, string>,
  };
}

/**
 * The fields against the action they claim to be for.
 *
 * Separate from `parseAction` because it needs the action, which the front
 * door does not have yet: parsing says the request is well formed, this says
 * it is the right shape for the thing it names. An unexpected field is an
 * error rather than something to drop quietly — a field the gateway ignores
 * is a field the student thinks they filled in.
 */
export function validateActionFields(input: ActionInput, action: RecordAction): void {
  if (Object.keys(input.fields).some((id) => !action.fields.some((f) => f.id === id))) {
    throw new Error('Unexpected action field.');
  }
  for (const f of action.fields) {
    const v = input.fields[f.id] ?? '';
    if (f.required && !v.trim()) throw new Error(`${f.label} is required.`);
    if (v && f.kind === 'select' && !f.options?.includes(v)) throw new Error(`Choose a listed ${f.label}.`);
    if (v && f.kind === 'number' && !Number.isFinite(Number(v))) throw new Error(`${f.label} must be a number.`);
  }
}

/* ── Authorized family access ───────────────────────────────────────────── */

/**
 * What a student can let somebody else see, and the rule that decides.
 *
 * A parent paying a bill is the ordinary case and the dangerous one. The easy
 * version gives the payer "the account", and the account is everything — the
 * grades, the health administration, the calendar showing where somebody is
 * at nine on a Tuesday. So access here is per *category*, per *named
 * resource*, with an expiry, and none of it exists until the recipient has
 * accepted.
 *
 * ## This is the server's rule, not the browser's
 *
 * `lib/family.ts` and the Family screen let a student *plan* a grant: choose
 * the categories, the items, the expiry. That plan grants nothing. A real
 * grant lives in verified server storage, and every resource operation is
 * checked against it by `allowsFamilyRequest` below. A permission object that
 * arrived from a browser is a request, never an authority.
 */
export const FAMILY_CATEGORIES = [
  'finances',
  'aid',
  'housing',
  'calendar',
  'academic',
  'emergency',
  'travel',
  'health-admin',
  'career',
  'communication',
] as const;

export type FamilyCategory = (typeof FAMILY_CATEGORIES)[number];

/**
 * How much of a category somebody has.
 *
 * `payment` is the one that is not a level of reading. It lets a payer pay and
 * lets them read nothing — see the last line of `allowsFamilyRequest`, which
 * is the whole reason the four are not an ordinal scale.
 */
export type FamilyAccess = 'none' | 'selected' | 'view' | 'payment';

export interface FamilyGrant {
  id: string;
  institutionId: string;
  studentId: string;
  recipientId: string;
  category: FamilyCategory;
  access: FamilyAccess;
  /** The individual things named. A category alone grants nothing. */
  resourceIds: string[];
  /** Null until the recipient has accepted. A grant nobody accepted is not one. */
  acceptedAt: number | null;
  expiresAt: number;
  revokedAt: number | null;
}

export interface FamilyRequest {
  institutionId: string;
  studentId: string;
  recipientId: string;
  category: FamilyCategory;
  resourceId: string;
  operation: 'read' | 'pay';
}

/**
 * Whether one grant permits one operation on one resource, right now.
 *
 * Written as a single predicate with no partial results on purpose: an
 * authorization that can be half-computed is one a caller can use half of.
 * Every condition is a reason to refuse, and the default at the end of each
 * branch is refusal.
 *
 * The order matters less than the completeness, but the checks are, in words:
 * the grant is live (accepted, not expired, not revoked, and not accepted in
 * the future); it names a real triangle of institution, student and recipient,
 * and the student is not the recipient; it is *this* triangle and *this*
 * category; the category is real, the access is not `none`, and the specific
 * resource is one of the ones named.
 *
 * Then the two operations, and the asymmetry between them is the point.
 * Paying requires `finances` *and* `payment` exactly. Reading requires
 * `selected` or `view` — which `payment` is not, so **payment-only access
 * discloses nothing**: a parent who can pay the bill cannot read the
 * statement, the transaction history, or anything else.
 */
export function allowsFamilyRequest(
  grant: FamilyGrant,
  request: FamilyRequest,
  now = Date.now(),
): boolean {
  const live =
    Number.isFinite(now) &&
    Number.isFinite(grant.expiresAt) &&
    grant.expiresAt > now &&
    grant.acceptedAt !== null &&
    Number.isFinite(grant.acceptedAt) &&
    grant.acceptedAt <= now &&
    grant.revokedAt === null;
  if (!live) return false;

  const named =
    !!grant.institutionId &&
    !!grant.studentId &&
    !!grant.recipientId &&
    grant.studentId !== grant.recipientId &&
    !!request.resourceId;
  if (!named) return false;

  const same =
    grant.institutionId === request.institutionId &&
    grant.studentId === request.studentId &&
    grant.recipientId === request.recipientId &&
    grant.category === request.category;
  if (!same) return false;

  const scoped =
    FAMILY_CATEGORIES.includes(grant.category) &&
    grant.access !== 'none' &&
    grant.resourceIds.includes(request.resourceId);
  if (!scoped) return false;

  if (request.operation === 'pay') return grant.category === 'finances' && grant.access === 'payment';
  if (request.operation !== 'read') return false;
  // Payment-only access cannot disclose statements or transaction history.
  return grant.access === 'selected' || grant.access === 'view';
}
