/** Engineering crosswalk, not an assessment or a certification. Rev. 4
 * Appendix J family labels in supplied documents are not Rev. 5 families. */
export const CROSSWALK_SOURCES = [
  { label: 'NIST SP 800-53 Rev. 5 and revision notes', url: 'https://csrc.nist.gov/pubs/sp/800/53/r5/upd1/final' },
  { label: '1EdTech LTI and Advantage', url: 'https://www.1edtech.org/standards/lti' },
  { label: '1EdTech LTI migration guide', url: 'https://standards.1edtech.org/lti/guides/migration/migration-guide' },
] as const;
export interface StandardControl {
  id: string; standard: string; owner: string; controls: string[]; purpose: string;
  data: string; boundary: string; code: string[]; tests: string[]; activation: string;
  status: 'Implementation present; operating evidence required';
}
const row = (r: Omit<StandardControl, 'status'>): StandardControl => ({ ...r, status: 'Implementation present; operating evidence required' });
export const STANDARD_CONTROLS: StandardControl[] = [
  row({ id: 'core-launch', standard: 'LTI 1.3 Core', owner: 'Engineering and institution LMS owner',
    controls: ['IA-2', 'IA-5', 'AC-3', 'AC-6', 'SC-8', 'SI-10', 'AU-2'],
    purpose: 'Launch a registered tool within its authorized course context', data: 'Issuer, client, deployment, subject, role and resource-link claims',
    boundary: 'Launch permission does not authorize unrelated campus records. Bind each registration to its institution and environment.',
    code: ['supabase/functions/_shared/ltiverify.ts', 'supabase/functions/_shared/ltigate.ts'],
    tests: ['app/src/lib/ltiverify.test.ts', 'app/src/lib/ltigate.test.ts'],
    activation: 'Named platform registration, approved redirect URLs and deployment IDs; positive and invalid/replayed launch evidence.' }),
  row({ id: 'deep-linking', standard: 'LTI Deep Linking 2.0', owner: 'LMS owner and faculty course owner',
    controls: ['AC-3', 'AC-6', 'CM-3', 'AU-2', 'SI-10'], purpose: 'Place instructor-selected content in an authorized course',
    data: 'Course and content-placement context', boundary: 'Faculty authorization and source policy apply before publishing; approve independently of Core.',
    code: ['supabase/functions/_shared/ltideeplink.ts'], tests: ['app/src/lib/ltideeplink.test.ts'],
    activation: 'Faculty placement, signed return message, course copy and wrong-role tests in the named LMS.' }),
  row({ id: 'nrps', standard: 'LTI NRPS 2.0', owner: 'Institution privacy and LMS owners',
    controls: ['PT-2', 'PT-3', 'AC-3', 'AC-6', 'SI-12', 'AU-2'], purpose: 'Read authorized course membership only where the feature requires it',
    data: 'Approved membership and role fields', boundary: 'Minimize fields; govern cache expiry, deletion and add/drop. Do not expand permissions from a roster.',
    code: ['supabase/functions/_shared/ltimembership.ts'], tests: ['app/src/lib/ltimembership.test.ts'],
    activation: 'Explicit roster-purpose approval and scope; membership lifecycle, expiry and revocation evidence.' }),
  row({ id: 'ags', standard: 'LTI AGS 2.0', owner: 'Institution grading authority and faculty course owner',
    controls: ['AC-3', 'AC-6', 'AU-2', 'AU-12', 'SI-10', 'CM-3', 'PT-3'], purpose: 'Pass back an authorized score for a placed graded activity',
    data: 'Line item, score and progress status', boundary: 'No official writes from Core launch alone. Enable only the approved activity and exact service scope.',
    code: ['supabase/functions/_shared/ltiags.ts'], tests: ['app/src/lib/ltiags.test.ts'],
    activation: 'Institution write authority, instructor enablement, idempotency, reconciliation, correction and rollback evidence.' }),
  row({ id: 'identity', standard: 'SAML / OIDC and SCIM', owner: 'Institution identity owner and security lead',
    controls: ['AC-2', 'AC-3', 'AC-6', 'IA-2', 'IA-5', 'AU-2'], purpose: 'Provide institution-scoped identity and lifecycle access',
    data: 'Approved identity and provisioning attributes', boundary: 'SSO is not permission to access every institutional system.',
    code: ['supabase/migrations/20260928011845_tenant_sso_policy.sql'], tests: ['supabase/ltiidentity.check.sql'],
    activation: 'Institution IdP metadata, MFA and role mapping; provision, role-change and deprovision UAT.' }),
  row({ id: 'canonical-data', standard: 'Edu-API-aligned integration fabric', owner: 'Institution data owner and integration lead',
    controls: ['PT-2', 'PT-3', 'AC-3', 'SI-10', 'SI-12', 'CA-7'], purpose: 'Map only approved source records into a traceable canonical representation',
    data: 'Approved person, course, section, period and enrollment fields', boundary: 'Provenance, classification, purpose, freshness and ownership must accompany imports; official systems retain write authority.',
    code: ['supabase/migrations/20260927170000_integration_control_plane.sql', 'supabase/migrations/20260928040000_integration_quality.sql'],
    tests: ['app/src/lib/integration/lmsmatrix.test.ts'], activation: 'Source-owner approval, field mapping, stale-record rejection and reconciliation with the actual institutional source.' }),
  row({ id: 'optional-consent', standard: 'Optional student personalization and sharing', owner: 'Privacy lead and student',
    controls: ['PT-2', 'PT-3', 'PT-4', 'PT-5', 'SI-12', 'SI-18'], purpose: 'Use or share only the student-selected objects for the stated optional purpose',
    data: 'Selected plans, notes and sharing metadata', boundary: 'Optional use is granular and revocable; do not relabel required institutional processing as consent.',
    code: ['app/src/lib/advisor-shares.ts', 'app/src/lib/cloud.ts'], tests: ['app/src/lib/trust/ferpa-consent.test.ts'],
    activation: 'Named recipient and expiry, grant/revoke UAT, downstream expiry and export/deletion verification.' }),
  row({ id: 'daily-planning', standard: 'Student-owned UDL strategy support', owner: 'Student and product owner',
    controls: ['PT-3', 'PT-5', 'AC-3', 'SI-10', 'SI-12'], purpose: 'Support a chosen goal, first step, fallback, human support and reflection',
    data: 'Student-entered daily plan on the device', boundary: 'Private device storage, account-scoped; excluded from AI context. Export includes private reflections and must be reviewed before sharing.',
    code: ['app/src/lib/daily-rhythm.ts', 'app/src/components/DailyRhythm.tsx'],
    tests: ['app/src/lib/daily-rhythm.test.ts', 'app/src/components/DailyRhythm.test.tsx'],
    activation: 'Deployment and browser accessibility verification. Local tests do not establish WCAG conformance.' }),
];
export function filterControls(query: string, standard = ''): StandardControl[] {
  const terms = query.toLowerCase().trim().split(/\s+/).filter(Boolean);
  return STANDARD_CONTROLS.filter(r => (!standard || r.id === standard) && terms.every(t => JSON.stringify(r).toLowerCase().includes(t)));
}
export function crosswalkExport(rows: readonly StandardControl[]): string {
  return JSON.stringify({ schema: 1, interpretation: 'Engineering mapping; no compliance certification or institutional activation is asserted.', sources: CROSSWALK_SOURCES, controls: rows }, null, 2);
}
