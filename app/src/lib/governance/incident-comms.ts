/**
 * Incident communications, by audience.
 *
 * docs/market-readiness/INCIDENT_COMMUNICATION_TEMPLATES.md holds the phases
 * (initial, update, resolution, handoff). This holds the audiences — a student
 * during an outage needs different words from a CISO during a privacy
 * incident — and the seven things every message must say, whoever reads it.
 *
 * `compose` refuses to produce a message with a section missing or a bracketed
 * placeholder left in it. A calm, incomplete notice is worse than a late one:
 * the reader fills the gap with the worst reading, and the next update has to
 * correct it.
 *
 * See docs/operating-model/INCIDENT-COMMUNICATIONS.md.
 */

export type Audience =
  | 'student_outage'
  | 'admin_outage'
  | 'integration_delay'
  | 'security'
  | 'privacy'
  | 'accessibility'
  | 'ai_quality'
  | 'marketplace_sponsor'
  | 'community_safety'
  | 'scheduled_maintenance'
  | 'feature_rollback'
  | 'launch_delay'
  | 'change_notice';

export const AUDIENCE_LABEL: Record<Audience, string> = {
  student_outage: 'Student-facing outage',
  admin_outage: 'Institution admin outage',
  integration_delay: 'Integration data delay',
  security: 'Security incident',
  privacy: 'Privacy incident',
  accessibility: 'Accessibility incident',
  ai_quality: 'AI quality incident',
  marketplace_sponsor: 'Marketplace/sponsor safety incident',
  community_safety: 'Community safety incident',
  scheduled_maintenance: 'Scheduled maintenance',
  feature_rollback: 'Feature rollback',
  launch_delay: 'Launch delay',
  change_notice: 'Change notice',
};

export type Section =
  | 'what_happened'
  | 'who_is_affected'
  | 'what_is_impacted'
  | 'what_to_do_now'
  | 'what_semester_is_doing'
  | 'next_update'
  | 'where_to_get_help';

export const SECTIONS: readonly Section[] = [
  'what_happened',
  'who_is_affected',
  'what_is_impacted',
  'what_to_do_now',
  'what_semester_is_doing',
  'next_update',
  'where_to_get_help',
];

export const SECTION_HEADING: Record<Section, string> = {
  what_happened: 'What happened',
  who_is_affected: 'Who is affected',
  what_is_impacted: 'What data or workflow is affected',
  what_to_do_now: 'What you should do now',
  what_semester_is_doing: 'What Semester is doing',
  next_update: 'Next update',
  where_to_get_help: 'Where to get help',
};

/**
 * A fact an audience's message must carry beyond the seven sections. Stated as
 * a field, not as a sentence somebody promises to include: free text would let
 * any line at all stand in for "the source system and last sync time".
 * `oneOf`, where given, is the only answers accepted.
 */
export interface RequiredDetail {
  key: string;
  heading: string;
  oneOf?: readonly string[];
}

export interface AudiencePolicy {
  /** Who must approve before sending. */
  approvers: readonly string[];
  /** Longest gap between updates while the incident is open. */
  updateEveryMinutes: number;
  /** Also notify the institution’s named contact, not just the affected users. */
  notifyInstitution: boolean;
  requires: readonly RequiredDetail[];
}

export const EXPOSURE = ['Not indicated', 'Suspected', 'Confirmed', 'Unknown'] as const;

export const AUDIENCES: Record<Audience, AudiencePolicy> = {
  student_outage: { approvers: ['Incident commander'], updateEveryMinutes: 60, notifyInstitution: true,
    requires: [{ key: 'deadline_contact', heading: 'If a deadline was affected, contact' }] },
  admin_outage: { approvers: ['Incident commander'], updateEveryMinutes: 60, notifyInstitution: true, requires: [] },
  integration_delay: { approvers: ['Integration owner'], updateEveryMinutes: 240, notifyInstitution: true,
    requires: [{ key: 'source_system', heading: 'Source system' }, { key: 'last_successful_sync', heading: 'Last successful sync' }] },
  security: { approvers: ['Security owner', 'Legal'], updateEveryMinutes: 60, notifyInstitution: true,
    requires: [{ key: 'data_exposure', heading: 'Data exposure', oneOf: EXPOSURE }] },
  privacy: { approvers: ['Privacy owner', 'Legal'], updateEveryMinutes: 60, notifyInstitution: true,
    requires: [{ key: 'data_classes', heading: 'Data classes involved' }, { key: 'data_exposure', heading: 'Data exposure', oneOf: EXPOSURE }] },
  accessibility: { approvers: ['Accessibility lead'], updateEveryMinutes: 240, notifyInstitution: true,
    requires: [{ key: 'alternative_route', heading: 'Accessible alternative route' }] },
  ai_quality: { approvers: ['AI platform lead', 'AI governance chair'], updateEveryMinutes: 240, notifyInstitution: true,
    requires: [{ key: 'outputs_to_distrust', heading: 'Outputs to distrust' }, { key: 'feature_paused', heading: 'AI feature paused', oneOf: ['Yes', 'No'] }] },
  marketplace_sponsor: { approvers: ['Trust & Safety lead', 'Legal'], updateEveryMinutes: 240, notifyInstitution: true, requires: [] },
  community_safety: { approvers: ['Trust & Safety lead'], updateEveryMinutes: 60, notifyInstitution: true,
    requires: [{ key: 'crisis_contact', heading: 'Campus crisis contact' }] },
  scheduled_maintenance: { approvers: ['Operations lead'], updateEveryMinutes: 1440, notifyInstitution: false, requires: [] },
  feature_rollback: { approvers: ['Product owner'], updateEveryMinutes: 1440, notifyInstitution: true,
    requires: [{ key: 'instead', heading: 'What you will see instead' }, { key: 'work_affected', heading: 'Is your work affected', oneOf: ['Yes', 'No'] }] },
  // Not incidents: the start of a cohort is on hold, or something is about to
  // change. The delay is told as a gate not yet evidenced, never as a promise
  // of a later date, and a weekly cadence is the steering meeting's.
  launch_delay: { approvers: ['Founder'], updateEveryMinutes: 10080, notifyInstitution: true,
    requires: [{ key: 'gate_pending', heading: 'Check not yet complete' }, { key: 'data_changed', heading: 'Has any account or data changed', oneOf: ['Yes', 'No'] }] },
  // Every approver, every time: a change to terms, data use or AI behaviour
  // needs the privacy owner and counsel, and one that needs neither belongs to
  // `feature_rollback` or `scheduled_maintenance`. The cadence is the longest
  // notice period, so a contract that asks for more is a change to this line.
  change_notice: { approvers: ['Product owner', 'Privacy owner', 'Legal'], updateEveryMinutes: 43200, notifyInstitution: true,
    requires: [{ key: 'effective_date', heading: 'Takes effect' }, { key: 'work_affected', heading: 'Is your work affected', oneOf: ['Yes', 'No'] }] },
};

export type Composed =
  | { ok: true; subject: string; body: string }
  | { ok: false; missing: Section[]; placeholders: string[] };

/** Words that turn a notice into speculation or legalese. Refused in the body. */
export const AVOID: readonly string[] = ['we believe', 'probably', 'hereinafter', 'notwithstanding', 'out of an abundance of caution'];

/**
 * Any bracketed text, whatever its case: `[school]` is as unfilled as
 * `[SCHOOL]`. A markdown link's `[text](url)` is not a placeholder.
 */
const PLACEHOLDER = /\[[^\]\n]+\](?!\()/g;

export function compose(
  audience: Audience,
  facts: Partial<Record<Section, string>>,
  details: Readonly<Record<string, string>> = {},
): Composed {
  const missing = SECTIONS.filter((s) => !(facts[s] ?? '').trim());
  const required = AUDIENCES[audience].requires;
  const all = [...SECTIONS.map((s) => facts[s] ?? ''), ...required.map((r) => details[r.key] ?? '')].join('\n');
  const placeholders = [...all.matchAll(PLACEHOLDER)].map((m) => m[0]);
  for (const phrase of AVOID) if (all.toLowerCase().includes(phrase)) placeholders.push(`avoid: “${phrase}”`);
  for (const r of required) {
    const v = (details[r.key] ?? '').trim();
    if (!v) placeholders.push(`required: ${r.heading}`);
    else if (r.oneOf && !r.oneOf.includes(v)) placeholders.push(`${r.heading} must be one of: ${r.oneOf.join(', ')}`);
  }
  if (missing.length || placeholders.length) return { ok: false, missing, placeholders };
  const body = [
    ...SECTIONS.map((s) => `${SECTION_HEADING[s]}\n${facts[s]!.trim()}`),
    ...required.map((r) => `${r.heading}\n${details[r.key]!.trim()}`),
  ].join('\n\n');
  return { ok: true, subject: `Semester — ${AUDIENCE_LABEL[audience]}`, body };
}
