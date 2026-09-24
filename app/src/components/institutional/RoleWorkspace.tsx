import { useState } from 'react';
import { Blueprint } from '../Blueprint';
import { ActionButton, SectionLabel } from '../ui';
import { useFlightPlan } from './FlightPlanContext';
import { useInstitutionalPreview } from './PreviewContext';
import { controlPlaneView } from '../../lib/control-plane';

const TITLES = {
  student: 'Student workspace',
  faculty: 'Faculty workspace',
  teaching_assistant: 'Teaching-assistant workspace',
  advisor: 'Advisor workspace',
  campus_staff: 'Student-success workspace',
  university_admin: 'Administrator workspace',
  moderator: 'Community moderation workspace',
  employer: 'Employer workspace',
  applicant: 'Applicant workspace',
  authorized_payer: 'Authorized payer workspace',
  authorized_family: 'Authorized-family workspace',
  alumni: 'Alumni workspace',
} as const;

type WorkspaceRole = keyof typeof TITLES;

const ROLE_FUNCTIONS: Record<WorkspaceRole, string[]> = {
  student: ['Plan my work', 'Learn and practice', 'Review my evidence'],
  faculty: ['Prepare course materials', 'Prepare assignment drafts', 'Prepare feedback drafts'],
  teaching_assistant: ['Prepare learning activities', 'Prepare office-hours support', 'Review assigned course context'],
  advisor: ['Review consented plans', 'Prepare advising follow-up', 'Explain support signals'],
  campus_staff: ['Review consented service cases', 'Prepare student support', 'Use the scoped directory'],
  university_admin: ['Inspect identity and integrations', 'Stage policy', 'Review audit readiness'],
  moderator: ['Review community reports', 'Prepare moderation notes', 'Escalate a sample case'],
  employer: ['Prepare opportunity drafts', 'Review consented career profiles', 'Plan recruiting follow-up'],
  applicant: ['Track my application preparation', 'Prepare visit questions', 'Review my deadlines'],
  authorized_payer: ['Review shared billing summaries', 'Prepare a payment handoff', 'Review authorization scope'],
  authorized_family: ['Review explicitly shared updates', 'Prepare student-approved questions', 'Review authorization scope'],
  alumni: ['Prepare a mentorship profile', 'Discover alumni events', 'Review career-network preferences'],
};

export function RoleWorkspace() {
  const { institution, person } = useInstitutionalPreview();
  const { workspace, updateWorkspace } = useFlightPlan();
  const [receipt, setReceipt] = useState('');
  const role = person.role;

  const prepareFacultyDraft = (kind: 'assignment' | 'feedback') => {
    updateWorkspace((current) => ({
      ...current,
      messages: [
        ...current.messages,
        {
          id: `${current.tenant}-${kind}-${current.messages.length}`,
          subject: `Sample ${kind} draft`,
          body: `Prepared for review by ${person.name}.`,
          read: true,
          draft: true,
        },
      ],
    }));
    setReceipt(`${kind === 'assignment' ? 'Assignment' : 'Feedback'} draft prepared locally.`);
  };

  const external = role === 'moderator' || role === 'employer' || role === 'authorized_payer'
    || role === 'applicant' || role === 'authorized_family' || role === 'alumni';
  const controlAccess = controlPlaneView({
    tenantId: institution.id,
    viewedTenantId: institution.id,
    previewRole: role,
    featureState: 'preview',
    gatewayStatus: 'sandbox tested',
    // Preview fixture grants make the demonstrations navigable; they are not
    // cryptographically verified tenant capabilities and authorize no write.
    verifiedCapabilities: [],
    approvedSourceCount: 0,
    activeConsentCount: 0,
    auditEventCount: 0,
  });

  return (
    <section aria-label={`${TITLES[role]} for ${institution.name}`} style={{ marginBlock: 'var(--sp-5)' }}>
      <SectionLabel>{TITLES[role]}</SectionLabel>
      <Blueprint plain style={{ padding: 'var(--sp-6)', background: 'var(--app-hero)' }}>
        <strong>{person.name} · Synthetic preview</strong>

        <div style={{ marginBlock: 'var(--sp-4)' }}>
          <strong>Available functions</strong>
          <ul aria-label="Available functions" style={{ marginBlock: 'var(--sp-2) 0' }}>
            {ROLE_FUNCTIONS[role].map((item) => <li key={item}>{item}</li>)}
          </ul>
        </div>

        {role === 'student' && (
          <p>Your sample plan and evidence only. {workspace.tasks.filter((task) => task.status === 'open').length} open sample items are in this context.</p>
        )}

        {role === 'faculty' && (
          <>
            <p>Prepare course materials for review without changing the sample learning system.</p>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))', gap: 'var(--sp-3)' }}>
              <ActionButton onClick={() => prepareFacultyDraft('assignment')}>Prepare assignment draft</ActionButton>
              <ActionButton onClick={() => prepareFacultyDraft('feedback')}>Prepare feedback draft</ActionButton>
            </div>
            <p style={{ color: 'var(--app-dim)' }}>Nothing is published to a learning system.</p>
          </>
        )}

        {role === 'teaching_assistant' && (
          <p>Assigned-course preparation only. No grade or course change is published from this preview.</p>
        )}

        {(role === 'advisor' || role === 'campus_staff') && (
          <div style={{ display: 'grid', gap: 'var(--sp-3)' }}>
            {workspace.cases.map((item) => (
              <div key={item.id} style={{ borderTop: '1px solid var(--app-line)', paddingTop: 'var(--sp-3)' }}>
                <strong>{item.title}</strong>
                {item.consent ? (
                  <div style={{ color: 'var(--app-dim)' }}>Sample consent on file · prepare local follow-up only</div>
                ) : (
                  <div role="status">Locked · sample consent required</div>
                )}
              </div>
            ))}
          </div>
        )}

        {role === 'university_admin' && (
          <>
            <p>Illustrative settings · server enforcement required</p>
            <p>{controlAccess.authorization} Open the Control tab to inspect and stage policy.</p>
            <div style={{ display: 'grid', gap: 'var(--sp-2)' }}>
              {institution.connections.map((connection) => (
                <div key={connection.system}>
                  {connection.system} · {connection.status === 'sandbox-unavailable' ? 'unavailable' : 'sample read-only'}
                  <span style={{ color: 'var(--app-dim)' }}> · {connection.detail}</span>
                </div>
              ))}
            </div>
          </>
        )}

        {external && (
          <p>
            No student academic details are shown. {role === 'moderator' && 'Only sample community reports are in scope.'}
            {role === 'employer' && 'Only consented sample career profiles are in scope.'}
            {role === 'authorized_payer' && 'Only explicitly shared sample billing summaries are in scope.'}
            {role === 'applicant' && 'Only this applicant’s synthetic preparation record is in scope.'}
            {role === 'authorized_family' && 'Only information explicitly shared for this sample relationship is in scope.'}
            {role === 'alumni' && 'Only this alumnus’s sample profile and opted-in network activity are in scope.'}
          </p>
        )}

        {receipt && <p role="status">{receipt} Nothing was published or sent.</p>}
      </Blueprint>
    </section>
  );
}
