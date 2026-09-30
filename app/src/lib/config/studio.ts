/**
 * The Configuration Studio: what a school may set about its own Semester, the
 * platform's default for each setting, and the arithmetic of drafts and
 * versions (D-1011).
 *
 * The brief of 30 September (`docs/CONFIGURATION-STUDIO.md` carries it) asks
 * for "one configurable codebase rather than hundreds of custom deployments":
 * a school changes terminology, workflow thresholds, roles, AI defaults,
 * notification hours, data retention and reporting floors by configuration,
 * not by asking for code. It lists eleven domains. This file is those eleven
 * as data.
 *
 * ## What it is, and what it is not yet
 *
 * It is the place a school's choices are written, reviewed by a second person,
 * versioned and audited — `school_config_versions`. It is not yet read by the
 * features the settings describe: `effectiveConfig` returns what a school has
 * chosen over the platform's defaults, and each domain's consumer is wired to
 * it one at a time (the screen says so). A setting that nothing reads is
 * labelled "recorded, not yet applied" rather than left to look live.
 *
 * ## Held in two places
 *
 * The spec is enforced by the database (`private.config_spec()` in
 * `20260930230000_configuration_studio.sql`), which refuses any write with an
 * unknown key or an out-of-range value, and mirrored here so the screen can
 * say what is wrong before anyone presses Save. `studio.test.ts` holds this
 * spec equal to that one, key for key and bound for bound.
 */

export const DOMAINS = [
  'academic_structure', 'workflows', 'roles', 'branding', 'content', 'ai',
  'notifications', 'data', 'features', 'accessibility', 'reporting',
] as const;
export type ConfigDomain = (typeof DOMAINS)[number];

export const DOMAIN_LABEL: Record<ConfigDomain, string> = {
  academic_structure: 'Academic structure',
  workflows: 'Workflows',
  roles: 'Roles',
  branding: 'Branding and terminology',
  content: 'Content',
  ai: 'AI',
  notifications: 'Notifications',
  data: 'Data',
  features: 'Features',
  accessibility: 'Accessibility',
  reporting: 'Reporting',
};

/** What a school can configure in each domain, in the brief's words. */
export const DOMAIN_ABOUT: Record<ConfigDomain, string> = {
  academic_structure: 'How the school divides its year and grades its work.',
  workflows: 'Which approvals a registration or advising step needs, and how long each may wait.',
  roles: 'Which kinds of person the school has in Semester.',
  branding: 'What the school is called and what it calls a course; the theme, language and accent.',
  content: 'How often policies and resources are reviewed, and who owns the forms.',
  ai: 'Whether AI is on, what a course starts with, what it may do, and whether answers must cite.',
  notifications: 'Which channels the school uses, its quiet hours, and how soon an unanswered alert escalates.',
  data: 'How often systems sync, and how long data is kept after someone leaves.',
  features: 'What is on for the school by default, and the name of its pilot cohort.',
  accessibility: 'Defaults for reading, language and text size.',
  reporting: 'The smallest group a report may show, and the school’s board dashboard.',
};

export type SettingSpec =
  | { kind: 'int'; min: number; max: number }
  | { kind: 'bool' }
  | { kind: 'enum'; values: readonly string[] }
  | { kind: 'set'; values: readonly string[] }
  | { kind: 'text'; max: number }
  | { kind: 'pattern'; re: string; max: number };

/** Held equal to `private.config_spec()` by `studio.test.ts`. */
export const SPEC: Record<ConfigDomain, Record<string, SettingSpec>> = {
  academic_structure: {
    calendar_kind: { kind: 'enum', values: ['semester', 'trimester', 'quarter', 'block', 'year_round'] },
    terms_per_year: { kind: 'int', min: 1, max: 12 },
    grading_scale: { kind: 'enum', values: ['letter', 'numeric', 'pass_fail', 'competency', 'ects'] },
    catalog_year_start_month: { kind: 'int', min: 1, max: 12 },
  },
  workflows: {
    registration_clearance_required: { kind: 'bool' },
    advisor_approval_required: { kind: 'bool' },
    approval_sla_days: { kind: 'int', min: 1, max: 60 },
    escalate_after_days: { kind: 'int', min: 1, max: 90 },
  },
  roles: {
    enabled_roles: { kind: 'set', values: ['student', 'faculty', 'advisor', 'registrar', 'tutor', 'staff', 'parent', 'alumni'] },
  },
  branding: {
    display_name: { kind: 'text', max: 120 },
    course_term: { kind: 'text', max: 40 },
    default_locale: { kind: 'pattern', re: '^[a-z]{2,3}(-[A-Za-z0-9]{2,8})?$', max: 16 },
    accent_color: { kind: 'pattern', re: '^#[0-9a-fA-F]{6}$', max: 7 },
  },
  content: {
    policy_review_months: { kind: 'int', min: 1, max: 36 },
    resource_review_months: { kind: 'int', min: 1, max: 36 },
    forms_owner: { kind: 'text', max: 120 },
  },
  ai: {
    ai_enabled: { kind: 'bool' },
    default_course_mode: { kind: 'enum', values: ['off', 'assist', 'full'] },
    allowed_actions: { kind: 'set', values: ['explain', 'quiz', 'summarize', 'plan', 'feedback'] },
    require_citations: { kind: 'bool' },
  },
  notifications: {
    channels: { kind: 'set', values: ['in_app', 'push', 'email'] },
    quiet_hours_start: { kind: 'int', min: 0, max: 23 },
    quiet_hours_end: { kind: 'int', min: 0, max: 23 },
    escalation_hours: { kind: 'int', min: 1, max: 168 },
  },
  data: {
    sync_interval_minutes: { kind: 'int', min: 5, max: 1440 },
    retention_days_after_exit: { kind: 'int', min: 0, max: 3650 },
    export_on_offboarding: { kind: 'bool' },
  },
  features: {
    default_release_stage: { kind: 'enum', values: ['off', 'pilot', 'on'] },
    pilot_cohort_label: { kind: 'text', max: 80 },
  },
  accessibility: {
    plain_language_default: { kind: 'bool' },
    default_text_scale: { kind: 'enum', values: ['standard', 'large', 'larger'] },
    languages: { kind: 'set', values: ['en', 'es', 'fr', 'de', 'pt', 'zh', 'ar', 'hi', 'ja', 'ko'] },
  },
  reporting: {
    min_cohort_size: { kind: 'int', min: 10, max: 1000 },
    board_dashboard: { kind: 'bool' },
    export_formats: { kind: 'set', values: ['csv', 'json', 'pdf'] },
  },
};

export type Value = boolean | number | string | string[];
export type Settings = Record<string, Value>;

/** What each setting says, in a school administrator's words. */
export const SETTING_LABEL: Record<string, string> = {
  calendar_kind: 'Academic calendar',
  terms_per_year: 'Terms per year',
  grading_scale: 'Grading scale',
  catalog_year_start_month: 'Catalog year starts in month',
  registration_clearance_required: 'Registration needs a clearance checklist',
  advisor_approval_required: 'Registration needs advisor approval',
  approval_sla_days: 'Days an approval may wait',
  escalate_after_days: 'Days before an unanswered approval escalates',
  enabled_roles: 'Roles the school uses',
  display_name: 'School name shown to students',
  course_term: 'What the school calls a course',
  default_locale: 'Default language',
  accent_color: 'Accent colour',
  policy_review_months: 'Review each policy every (months)',
  resource_review_months: 'Review each resource every (months)',
  forms_owner: 'Office that owns the forms',
  ai_enabled: 'AI is on for the school',
  default_course_mode: 'What a new course starts with',
  allowed_actions: 'What AI may do',
  require_citations: 'AI answers must cite a source',
  channels: 'Notification channels',
  quiet_hours_start: 'Quiet hours start (hour of day)',
  quiet_hours_end: 'Quiet hours end (hour of day)',
  escalation_hours: 'Hours before an unread official alert escalates',
  sync_interval_minutes: 'Sync every (minutes)',
  retention_days_after_exit: 'Keep data after someone leaves (days)',
  export_on_offboarding: 'Offer the student an export when they leave',
  default_release_stage: 'A new feature starts',
  pilot_cohort_label: 'Name of the pilot cohort',
  plain_language_default: 'Plain-language mode on by default',
  default_text_scale: 'Default text size',
  languages: 'Languages offered',
  min_cohort_size: 'Smallest group a report may show',
  board_dashboard: 'Board dashboard on',
  export_formats: 'Report export formats',
};

/** A sentence on a setting whose effect is not obvious from its label. */
export const SETTING_HINT: Record<string, string> = {
  min_cohort_size: 'The platform never shows a group under 10. A school can raise that floor and cannot lower it.',
  ai_enabled: 'The kill switch and each course’s own policy still apply; this is the school’s default, not an override.',
  retention_days_after_exit: 'Financial records keep their own seven-year retention whatever this says.',
  quiet_hours_start: 'Official alerts about deadlines and safety are not held back by quiet hours.',
  languages: 'A language is offered when the school has reviewed its translation of official content.',
};

/** Choice words as a person reads them. */
export const CHOICE_LABEL: Record<string, string> = {
  semester: 'Semester', trimester: 'Trimester', quarter: 'Quarter', block: 'Block', year_round: 'Year-round',
  letter: 'Letter grades', numeric: 'Numeric', pass_fail: 'Pass/fail', competency: 'Competency-based', ects: 'ECTS',
  student: 'Students', faculty: 'Faculty', advisor: 'Advisors', registrar: 'Registrars', tutor: 'Tutors', staff: 'Staff', parent: 'Parents', alumni: 'Alumni',
  off: 'Off', assist: 'Assist', full: 'Full', pilot: 'Pilot first', on: 'On',
  explain: 'Explain', quiz: 'Quiz', summarize: 'Summarize', plan: 'Plan', feedback: 'Feedback',
  in_app: 'In the app', push: 'Push', email: 'Email',
  standard: 'Standard', large: 'Large', larger: 'Larger',
  en: 'English', es: 'Spanish', fr: 'French', de: 'German', pt: 'Portuguese', zh: 'Chinese', ar: 'Arabic', hi: 'Hindi', ja: 'Japanese', ko: 'Korean',
  csv: 'CSV', json: 'JSON', pdf: 'PDF',
};

/**
 * The platform's default for a setting: what Semester does for a school that
 * has chosen nothing. A text or pattern setting with no default is simply
 * unset — the platform's own name, theme and wording apply.
 */
export const DEFAULTS: Record<ConfigDomain, Settings> = {
  academic_structure: { calendar_kind: 'semester', terms_per_year: 2, grading_scale: 'letter', catalog_year_start_month: 8 },
  workflows: { registration_clearance_required: false, advisor_approval_required: false, approval_sla_days: 5, escalate_after_days: 10 },
  roles: { enabled_roles: ['student', 'faculty', 'advisor', 'registrar', 'staff'] },
  branding: { course_term: 'course', default_locale: 'en' },
  content: { policy_review_months: 12, resource_review_months: 6 },
  ai: { ai_enabled: true, default_course_mode: 'assist', allowed_actions: ['explain', 'quiz', 'summarize', 'plan', 'feedback'], require_citations: true },
  notifications: { channels: ['in_app', 'push'], quiet_hours_start: 22, quiet_hours_end: 7, escalation_hours: 24 },
  data: { sync_interval_minutes: 60, retention_days_after_exit: 90, export_on_offboarding: true },
  features: { default_release_stage: 'off' },
  accessibility: { plain_language_default: false, default_text_scale: 'standard', languages: ['en'] },
  reporting: { min_cohort_size: 10, board_dashboard: false, export_formats: ['csv', 'json'] },
};

/** The floor the platform keeps for every report, whatever a school sets. */
export const PLATFORM_MIN_COHORT = 10;

// ── Checking a value ────────────────────────────────────────────────────────

const CARD = /[0-9]([ -]?[0-9]){12,18}/;
// eslint-disable-next-line no-control-regex -- the point is to refuse control characters
const CONTROL = /[\u0000-\u001f\u007f]/;

/** Whether one value fits its spec — the same rules as `private.config_problems`. */
export function valid(spec: SettingSpec, v: unknown): boolean {
  switch (spec.kind) {
    case 'bool':
      return typeof v === 'boolean';
    case 'int':
      return typeof v === 'number' && Number.isInteger(v) && v >= spec.min && v <= spec.max;
    case 'enum':
      return typeof v === 'string' && spec.values.includes(v);
    case 'text':
      return typeof v === 'string' && v.trim().length >= 1 && v.trim().length <= spec.max && !CONTROL.test(v) && !CARD.test(v);
    case 'pattern':
      return typeof v === 'string' && v.length <= spec.max && new RegExp(spec.re).test(v);
    case 'set':
      return Array.isArray(v) && v.length >= 1 && v.length <= spec.values.length
        && v.every((e) => typeof e === 'string' && spec.values.includes(e))
        && new Set(v).size === v.length;
  }
}

/**
 * What is wrong with a domain's settings, as the database's codes:
 * `unknown_key:<key>`, `bad_value:<key>`, `not_object`, `too_large`. Empty
 * means the database will store it.
 */
export function problems(domain: ConfigDomain, settings: unknown): string[] {
  if (settings === null || typeof settings !== 'object' || Array.isArray(settings)) return ['not_object'];
  if (JSON.stringify(settings).length > 8192) return ['too_large'];
  const spec = SPEC[domain];
  const out: string[] = [];
  for (const key of Object.keys(settings).sort()) {
    const s = spec[key];
    if (!s) out.push(`unknown_key:${key}`);
    else if (!valid(s, (settings as Record<string, unknown>)[key])) out.push(`bad_value:${key}`);
  }
  return out;
}

/** The sentence the screen shows for a code. */
export function problemText(code: string): string {
  const [kind, key] = code.split(':');
  const name = key ? (SETTING_LABEL[key] ?? key) : '';
  if (kind === 'bad_value') return `${name}: that value is outside what is allowed.`;
  if (kind === 'unknown_key') return `${name} is not a setting the studio offers.`;
  if (kind === 'too_large') return 'This configuration is too large to store.';
  if (kind === 'not_object') return 'This configuration is not a set of settings.';
  return code;
}

// ── Versions ────────────────────────────────────────────────────────────────

export interface ConfigVersion {
  id: string;
  tenant_id: string;
  domain: ConfigDomain;
  state: 'draft' | 'published';
  version: number | null;
  settings: Settings;
  note: string;
  based_on: number | null;
  created_by: string | null;
  published_by: string | null;
  created_at: string;
  updated_at: string;
  published_at: string | null;
}

/** The school's current published version of a domain: the highest number. */
export function current(rows: readonly ConfigVersion[], domain: ConfigDomain): ConfigVersion | null {
  let best: ConfigVersion | null = null;
  for (const r of rows) {
    if (r.domain !== domain || r.state !== 'published' || r.version === null) continue;
    if (!best || r.version > (best.version ?? 0)) best = r;
  }
  return best;
}

/** The domain's draft, if it has one. There is at most one. */
export function draftOf(rows: readonly ConfigVersion[], domain: ConfigDomain): ConfigVersion | null {
  return rows.find((r) => r.domain === domain && r.state === 'draft') ?? null;
}

/** A domain's published versions, newest first. */
export function history(rows: readonly ConfigVersion[], domain: ConfigDomain): ConfigVersion[] {
  return rows
    .filter((r) => r.domain === domain && r.state === 'published' && r.version !== null)
    .sort((a, b) => (b.version ?? 0) - (a.version ?? 0));
}

/** What a school runs on: the platform's defaults, over which its published choices sit. */
export function effectiveConfig(rows: readonly ConfigVersion[]): Record<ConfigDomain, Settings> {
  const out = {} as Record<ConfigDomain, Settings>;
  for (const d of DOMAINS) out[d] = { ...DEFAULTS[d], ...(current(rows, d)?.settings ?? {}) };
  return out;
}

export interface Change {
  key: string;
  from: Value | undefined;
  to: Value | undefined;
}

const same = (a: Value | undefined, b: Value | undefined) => JSON.stringify(a) === JSON.stringify(b);

/** What differs between two sets of settings, in spec order; unset is `undefined`. */
export function diff(domain: ConfigDomain, before: Settings, after: Settings): Change[] {
  return Object.keys(SPEC[domain])
    .filter((key) => !same(before[key], after[key]))
    .map((key) => ({ key, from: before[key], to: after[key] }));
}

/** A value as a person reads it. */
export function show(v: Value | undefined): string {
  if (v === undefined) return 'platform default';
  if (Array.isArray(v)) return v.map((e) => CHOICE_LABEL[e] ?? e).join(', ');
  if (typeof v === 'boolean') return v ? 'Yes' : 'No';
  if (typeof v === 'number') return String(v);
  return CHOICE_LABEL[v] ?? v;
}

/**
 * Whether the signed-in account may publish this draft, and if not, why not —
 * the sentences the database would raise. `holds` is the account's verified
 * capabilities at this school.
 */
export function publishBlocker(draft: ConfigVersion, viewerId: string | null, holds: readonly string[]): string | null {
  if (!holds.includes('config:publish')) return 'Your account cannot publish configuration at this school.';
  if (viewerId !== null && viewerId === draft.created_by) return 'Whoever drafted a configuration does not publish it. Ask a colleague who holds the publish role.';
  const bad = problems(draft.domain, draft.settings);
  if (bad.length > 0) return problemText(bad[0]);
  return null;
}

// `studioAllowed` lives in its own module so the University screen can ask it
// without importing this whole file (the spec, defaults and diff) into the
// route's opening cost. Re-exported here so this file stays the one import.
export { studioAllowed } from './allowed';
