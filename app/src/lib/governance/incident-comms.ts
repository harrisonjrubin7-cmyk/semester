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
  | 'feature_rollback';

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

export interface AudiencePolicy {
  /** Who must approve before sending. */
  approvers: readonly string[];
  /** Longest gap between updates while the incident is open. */
  updateEveryMinutes: number;
  /** Also notify the institution’s named contact, not just the affected users. */
  notifyInstitution: boolean;
  /** Extra line the message must carry, beyond the seven sections. */
  mustAlsoSay?: string;
}

export const AUDIENCES: Record<Audience, AudiencePolicy> = {
  student_outage: { approvers: ['Incident commander'], updateEveryMinutes: 60, notifyInstitution: true,
    mustAlsoSay: 'If a deadline is affected, say whom to contact for an extension — never promise one.' },
  admin_outage: { approvers: ['Incident commander'], updateEveryMinutes: 60, notifyInstitution: true },
  integration_delay: { approvers: ['Integration owner'], updateEveryMinutes: 240, notifyInstitution: true,
    mustAlsoSay: 'Name the source system and the last successful sync time; stale labels stay visible.' },
  security: { approvers: ['Security owner', 'Legal'], updateEveryMinutes: 60, notifyInstitution: true,
    mustAlsoSay: 'State whether data exposure is not indicated, suspected, confirmed or unknown.' },
  privacy: { approvers: ['Privacy owner', 'Legal'], updateEveryMinutes: 60, notifyInstitution: true,
    mustAlsoSay: 'Say which data classes were involved; FERPA notice obligations are the institution’s to decide with us.' },
  accessibility: { approvers: ['Accessibility lead'], updateEveryMinutes: 240, notifyInstitution: true,
    mustAlsoSay: 'Give an accessible alternative route to complete the task now.' },
  ai_quality: { approvers: ['AI platform lead', 'AI governance chair'], updateEveryMinutes: 240, notifyInstitution: true,
    mustAlsoSay: 'Say which outputs to distrust and whether the AI feature is paused.' },
  marketplace_sponsor: { approvers: ['Trust & Safety lead', 'Legal'], updateEveryMinutes: 240, notifyInstitution: true },
  community_safety: { approvers: ['Trust & Safety lead'], updateEveryMinutes: 60, notifyInstitution: true,
    mustAlsoSay: 'Include the campus crisis contact the institution verified.' },
  scheduled_maintenance: { approvers: ['Operations lead'], updateEveryMinutes: 1440, notifyInstitution: false },
  feature_rollback: { approvers: ['Product owner'], updateEveryMinutes: 1440, notifyInstitution: true,
    mustAlsoSay: 'Say what students see instead and whether any of their work is affected.' },
};

export type Composed =
  | { ok: true; subject: string; body: string }
  | { ok: false; missing: Section[]; placeholders: string[] };

/** Words that turn a notice into speculation or legalese. Refused in the body. */
export const AVOID: readonly string[] = ['we believe', 'probably', 'hereinafter', 'notwithstanding', 'out of an abundance of caution'];

export function compose(audience: Audience, facts: Partial<Record<Section, string>>, extra = ''): Composed {
  const missing = SECTIONS.filter((s) => !(facts[s] ?? '').trim());
  const all = [...SECTIONS.map((s) => facts[s] ?? ''), extra].join('\n');
  const placeholders = [...all.matchAll(/\[[A-Z0-9 _/]+\]/g)].map((m) => m[0]);
  for (const phrase of AVOID) if (all.toLowerCase().includes(phrase)) placeholders.push(`avoid: “${phrase}”`);
  if (AUDIENCES[audience].mustAlsoSay && !extra.trim()) placeholders.push(`required: ${AUDIENCES[audience].mustAlsoSay}`);
  if (missing.length || placeholders.length) return { ok: false, missing, placeholders };
  const body = SECTIONS.map((s) => `${SECTION_HEADING[s]}\n${facts[s]!.trim()}`).join('\n\n') + (extra.trim() ? `\n\n${extra.trim()}` : '');
  return { ok: true, subject: `Semester — ${AUDIENCE_LABEL[audience]}`, body };
}
