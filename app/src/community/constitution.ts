/**
 * A student organization's constitution as a guided, versioned form rather
 * than a PDF nobody opens.
 *
 * The eleven sections and their fields are the blueprint's template. A
 * constitution is adopted only when every required field is written and the
 * officers — and the advisor, where the institution requires one — have
 * acknowledged it; it changes only through `amend`, which keeps the version
 * it replaced. Nothing here is stored: the shape is what the organization's
 * document archive will hold, and `constitution.test.ts` is what holds it.
 *
 * Two fields are required by rule rather than by the template. The
 * no-emergency-service notice and the disciplinary-authority boundary cannot
 * be left blank or written away, because they are the two sentences that
 * keep an organization from promising what neither it nor Semester can do.
 */
import { NOT_AN_EMERGENCY_SERVICE } from './governance';

export interface Field {
  id: string;
  label: string;
  required: boolean;
}

export interface Section {
  n: number;
  title: string;
  fields: readonly Field[];
}

const f = (id: string, label: string, required = true): Field => ({ id, label, required });

export const SECTIONS: readonly Section[] = [
  { n: 1, title: 'Organization identity', fields: [f('name', 'Organization name'), f('short_name', 'Short name or acronym', false), f('campus', 'Institution or campus'), f('type', 'Organization type'), f('recognition_status', 'Recognition status'), f('effective', 'Academic year or effective date'), f('primary_officer', 'Primary officer'), f('advisor', 'Faculty or staff advisor, if required', false), f('page', 'Official Semester organization page', false)] },
  { n: 2, title: 'Mission and purpose', fields: [f('mission', 'Purpose, the students served, and intended activities')] },
  { n: 3, title: 'Membership', fields: [f('eligibility', 'Eligibility'), f('how_to_join', 'How students join'), f('member_rights', 'Member rights'), f('member_responsibilities', 'Member responsibilities'), f('dues', 'Dues or costs, if any', false), f('access_commitment', 'Accessibility and participation commitment'), f('nondiscrimination', 'Non-discrimination and respectful-community commitment'), f('removal', 'Member removal or suspension process'), f('member_appeal', 'Appeal or review process')] },
  { n: 4, title: 'Governance and officer roles', fields: [f('officers', 'Required officers'), f('duties', 'Officer duties'), f('terms', 'Term lengths'), f('officer_eligibility', 'Eligibility requirements'), f('election', 'Election or appointment process'), f('vacancy', 'Vacancy process'), f('officer_removal', 'Removal process'), f('advisor_role', 'Advisor role and limits'), f('transition', 'Officer transition requirements')] },
  { n: 5, title: 'Meetings and decisions', fields: [f('schedule', 'Regular meeting schedule'), f('notice', 'Notice requirements'), f('quorum', 'Quorum'), f('voting_eligibility', 'Voting eligibility'), f('threshold', 'Voting threshold'), f('remote', 'Remote or hybrid participation'), f('records', 'Meeting notes and records'), f('conflicts', 'Conflict-of-interest handling')] },
  { n: 6, title: 'Events and activities', fields: [f('event_approval', 'Event approval process'), f('event_access', 'Accessibility planning'), f('travel', 'Travel and transportation rules'), f('fundraising', 'Financial and fundraising requirements'), f('facilities', 'Use of campus facilities'), f('risk', 'Risk-management and training requirements'), f('incident_route', 'Emergency and incident-reporting route'), f('vendors', 'External speaker and vendor process')] },
  { n: 7, title: 'Finance and assets', fields: [f('funding', 'Funding sources'), f('budget', 'Budget approval'), f('spenders', 'Authorized spenders'), f('reimbursement', 'Reimbursement process'), f('retention', 'Records retention'), f('inventory', 'Asset inventory'), f('sponsorship', 'Fundraising and sponsorship disclosure'), f('finance_handoff', 'Financial handoff at officer transition')] },
  { n: 8, title: 'Conduct, safety and privacy', fields: [f('conduct_ack', 'Code-of-conduct acknowledgement'), f('anti_harassment', 'Anti-harassment and anti-discrimination commitment'), f('digital_rules', 'Digital community rules'), f('media_consent', 'Photo, video and media consent'), f('member_data', 'Member-data handling'), f('reporting', 'Reporting and escalation route'), f('discipline_boundary', 'Disciplinary authority boundary'), f('no_emergency', 'No-emergency-service notice')] },
  { n: 9, title: 'Digital tools and communications', fields: [f('channels', 'Official channels'), f('officer_access', 'Officer access rules'), f('social_ownership', 'Social-media account ownership'), f('workspace_permissions', 'Semester workspace permissions'), f('messaging', 'Member messaging rules'), f('external_disclosure', 'External-platform disclosure'), f('content_ownership', 'Content ownership and archival')] },
  { n: 10, title: 'Amendments, renewal and dissolution', fields: [f('amendment', 'Amendment process'), f('renewal', 'Annual review and renewal'), f('dissolution', 'Dissolution process'), f('assets_on_dissolution', 'Disposition of remaining funds and assets'), f('archive', 'Records and archive retention'), f('notification', 'Member notification requirements')] },
  { n: 11, title: 'Acknowledgements', fields: [f('officer_signatures', 'Officer signatures'), f('advisor_ack', 'Advisor acknowledgement', false), f('institution_approval', 'Institutional approval, when applicable', false), f('date', 'Date')] },
];

export const FIELDS: readonly Field[] = SECTIONS.flatMap((s) => s.fields);
export const REQUIRED: readonly string[] = FIELDS.filter((x) => x.required).map((x) => x.id);

/** The disciplinary boundary an organization writes in, whatever else it says. */
export const DISCIPLINE_BOUNDARY =
  'The organization may decide its own membership under this constitution. It does not judge disciplinary facts, replace campus safety, student affairs or emergency systems, or impose sanctions beyond its own membership.';

export interface Acknowledgement {
  by: string;
  seat: 'officer' | 'advisor' | 'institution';
  on: string;
}

export interface Constitution {
  organization: string;
  version: number;
  fields: Readonly<Record<string, string>>;
  acknowledgements: readonly Acknowledgement[];
  /** Every earlier version, oldest first, with why it changed. */
  history: readonly { version: number; fields: Readonly<Record<string, string>>; amendedBy: string; reason: string; on: string }[];
}

export function draft(organization: string, fields: Record<string, string> = {}): Constitution {
  return {
    organization,
    version: 1,
    fields: { no_emergency: NOT_AN_EMERGENCY_SERVICE, discipline_boundary: DISCIPLINE_BOUNDARY, ...fields },
    acknowledgements: [],
    history: [],
  };
}

/** Required fields still blank, in template order. */
export function missing(c: Constitution): string[] {
  return REQUIRED.filter((id) => !(c.fields[id]?.trim()));
}

/** Fields the template does not have. A constitution carries no field the form did not ask for. */
export function unknownFields(c: Constitution): string[] {
  const known = new Set(FIELDS.map((x) => x.id));
  return Object.keys(c.fields).filter((k) => !known.has(k));
}

export interface AdoptionVerdict {
  ready: boolean;
  problems: string[];
}

/**
 * Whether this version can be adopted: every required field written, the
 * two boundary sentences present as given, at least two officers signed,
 * and the advisor's acknowledgement when the institution requires an advisor.
 */
export function readyToAdopt(c: Constitution, opts: { advisorRequired: boolean }): AdoptionVerdict {
  const problems: string[] = [];
  const blank = missing(c);
  if (blank.length) problems.push(`${blank.length} required field(s) blank: ${blank.join(', ')}`);
  const unknown = unknownFields(c);
  if (unknown.length) problems.push(`fields the template does not have: ${unknown.join(', ')}`);
  if (!c.fields.no_emergency?.includes('not an emergency service')) problems.push('the no-emergency-service notice was changed');
  if (!c.fields.discipline_boundary?.includes('does not judge disciplinary facts')) problems.push('the disciplinary boundary was changed');
  const officers = new Set(c.acknowledgements.filter((a) => a.seat === 'officer').map((a) => a.by));
  if (officers.size < 2) problems.push('at least two officers must sign');
  if (opts.advisorRequired && !c.acknowledgements.some((a) => a.seat === 'advisor')) problems.push('the advisor has not acknowledged it');
  return { ready: problems.length === 0, problems };
}

export function acknowledge(c: Constitution, a: Acknowledgement): Constitution {
  if (c.acknowledgements.some((x) => x.by === a.by && x.seat === a.seat)) return c;
  return { ...c, acknowledgements: [...c.acknowledgements, a] };
}

/**
 * A new version. Acknowledgements do not carry over — what was signed was the
 * old text — and the old version is kept whole, with the reason it changed.
 */
export function amend(c: Constitution, changes: Record<string, string>, by: string, reason: string, on: string): Constitution {
  if (reason.trim().length < 12) throw new Error('an amendment says why');
  if (Object.keys(changes).length === 0) throw new Error('an amendment changes something');
  return {
    ...c,
    version: c.version + 1,
    fields: { ...c.fields, ...changes },
    acknowledgements: [],
    history: [...c.history, { version: c.version, fields: c.fields, amendedBy: by, reason: reason.trim(), on }],
  };
}
