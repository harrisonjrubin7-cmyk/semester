// Trust Center content lives in Neon so it can change without a code release.
// Seeded once from the statements reviewed on 22 Oct 2026; ON CONFLICT keeps later edits intact.
type C = [string, string, string, string];
const ROWS: C[] = [
  ['security', 'Isolation between institutions', 'Verified in test', 'Every queue and search is limited to the caller’s institution. Checked on 22 Oct 2026 with an automated probe against a second test institution.'],
  ['security', 'Role-based access, deny by default', 'Verified in test', 'Every server action checks an active membership and role first.'],
  ['security', 'Two-person approval for consequential changes', 'Verified in test', 'Overrides, hold releases and role changes need a second person. Nobody approves their own request.'],
  ['security', 'Audit log of sensitive actions', 'Verified in test', 'Decisions, grade changes, shares and every view of shared records are logged. The log is not yet tamper-evident.'],
  ['security', 'University single sign-on (SAML)', 'Not yet in place', 'Sign-in today is email link or Google.'],
  ['security', 'Higher-education security questionnaire (HECVAT Full)', 'Not yet in place', ''],
  ['security', 'Independent penetration test', 'Not yet in place', ''],
  ['security', 'Cyber liability and E&O insurance', 'Not yet in place', ''],
  ['security', 'Incident response plan', 'In progress', 'Runbooks are drafted; a tabletop exercise has not been run.'],
  ['security', 'Backup restore drill', 'Not yet in place', ''],
  ['privacy', 'You decide what is shared', 'Verified in test', 'Family and advisor shares name the person, the categories and an end date, and can be revoked at any time.'],
  ['privacy', 'Access history', 'Verified in test', 'Students see who looked at what they shared, and when.'],
  ['privacy', 'Data export and deletion request', 'Verified in test', 'Students can export their records and request deletion; official records follow institution retention.'],
  ['privacy', 'Data processing / FERPA addendum', 'Not yet in place', 'Draft under counsel review; not signed.'],
  ['ai', 'Course AI rules enforced before anything is read', 'Verified in test', 'A course set to “AI not allowed” blocks the question; “outlining only” limits answers to an outline. Unit tests, 22 Oct 2026.'],
  ['ai', 'Student records never reach an AI provider', 'Verified in test', 'Only public catalog text is sent. Grades, holds, enrollments and the student’s own notes stay inside Semester. Unit tests, 22 Oct 2026.'],
  ['ai', 'Cited, labelled answers', 'Verified in test', 'Answers cite numbered sources, state confidence and limits, and are labelled AI-assisted.'],
  ['ai', 'No decisions by AI', 'Verified in test', 'The assistant cannot register, grade, approve, move money or grant access.'],
  ['accessibility', 'Target: WCAG 2.2 AA', 'In progress', 'A design requirement, not a conformance claim. Keyboard access, labels, visible focus and reduced motion are built in; colour is never the only signal.'],
  ['accessibility', 'Accessibility conformance report (ACR / VPAT)', 'Not yet in place', ''],
  ['accessibility', 'Independent accessibility audit', 'Not yet in place', ''],
];
const SUBS: [string, string][] = [
  ['Zite (Fillout)', 'Application hosting, database, sign-in and email delivery for this deployment'],
  ['OpenAI', 'Ask Semester answers. Receives public catalog text only, never student records'],
  ['Neon', 'Managed Postgres for controlled writes and inbound site requests'],
];
const q = (s: string) => `'${s.replace(/'/g, "''")}'`;

export const TRUST_MIGRATION = [
  `CREATE TABLE IF NOT EXISTS site_trust_controls (
    section TEXT NOT NULL CHECK (section IN ('security','privacy','ai','accessibility')),
    control TEXT NOT NULL,
    status TEXT NOT NULL CHECK (status IN ('In place','Verified in test','In progress','Not yet in place')),
    detail TEXT NOT NULL DEFAULT '',
    sort INT NOT NULL DEFAULT 0,
    reviewed_on DATE NOT NULL DEFAULT '2026-10-22',
    PRIMARY KEY (section, control))`,
  `CREATE TABLE IF NOT EXISTS site_subprocessors (name TEXT PRIMARY KEY, purpose TEXT NOT NULL, added_on DATE NOT NULL DEFAULT '2026-10-22', active BOOLEAN NOT NULL DEFAULT true)`,
  `INSERT INTO site_trust_controls (section, control, status, detail, sort) VALUES ${ROWS.map((r, i) => `(${r.map(q).join(',')},${i})`).join(',')} ON CONFLICT DO NOTHING`,
  `INSERT INTO site_subprocessors (name, purpose) VALUES ${SUBS.map((s) => `(${s.map(q).join(',')})`).join(',')} ON CONFLICT DO NOTHING`,
];
