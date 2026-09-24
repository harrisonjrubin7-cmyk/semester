import { useState } from 'react';
import { Blueprint } from '../Blueprint';
import { ActionButton, SectionLabel } from '../ui';
import { useFlightPlan } from './FlightPlanContext';
import { useInstitutionalPreview } from './PreviewContext';
import { controlPlaneView } from '../../lib/control-plane';
import { logAction } from '../../lib/flight-plan';
import {
  availableRoleFunctions,
  ROLE_DRAFT_ACTIONS,
  ROLE_WORKSPACE_TITLES,
} from './role-workspace';

export function RoleWorkspace() {
  const { institution, person } = useInstitutionalPreview();
  const { workspace, updateWorkspace } = useFlightPlan();
  const [receipt, setReceipt] = useState('');
  const role = person.role;
  const available = availableRoleFunctions(institution.id, role, person.grants);
  const capabilities = new Set(available.map((item) => item.capability));

  const prepareFacultyDraft = (kind: 'assignment' | 'feedback') => {
    const required = kind === 'assignment' ? 'course:manage' : 'message:course';
    if (!capabilities.has(required)) {
      setReceipt('That function is unavailable because this role has no current scoped grant for it.');
      return;
    }
    updateWorkspace((current) => {
      if (current.role !== role) return current;
      return logAction({
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
      }, `${kind} draft prepared locally`);
    });
    setReceipt(`${kind === 'assignment' ? 'Assignment' : 'Feedback'} draft prepared locally.`);
  };

  const prepareRoleDraft = () => {
    const action = ROLE_DRAFT_ACTIONS[role];
    if (!action || !capabilities.has(action.capability)) {
      setReceipt('That function is unavailable because this role has no current scoped grant for it.');
      return;
    }
    updateWorkspace((current) => {
      if (current.role !== role) return current;
      const consentedCase = (role === 'advisor' || role === 'campus_staff')
        ? current.cases.find((item) => item.consent)
        : undefined;
      const next = {
        ...current,
        messages: [
          ...current.messages,
          {
            id: `${current.tenant}-${role}-draft-${current.messages.length}`,
            subject: action.subject,
            body: consentedCase
              ? `Prepared locally for ${consentedCase.title}. Review and confirm before any follow-up.`
              : `Prepared locally by ${person.name}. Review and confirm before any external action.`,
            read: true,
            draft: true,
          },
        ],
      };
      return logAction(next, `${action.label} prepared locally`);
    });
    setReceipt(`${action.label} prepared locally.`);
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
    <section aria-label={`${ROLE_WORKSPACE_TITLES[role]} for ${institution.name}`} style={{ marginBlock: 'var(--sp-5)' }}>
      <SectionLabel>{ROLE_WORKSPACE_TITLES[role]}</SectionLabel>
      <Blueprint plain style={{ padding: 'var(--sp-6)', background: 'var(--app-hero)' }}>
        <strong>{person.name} · Synthetic preview</strong>

        <div style={{ marginBlock: 'var(--sp-4)' }}>
          <strong>Available functions</strong>
          <p style={{ color: 'var(--app-dim)' }}>
            Shown from this persona’s live synthetic role and institution-scoped grant. Production authorizes every read and action again on the server.
          </p>
          <ul aria-label="Available functions" style={{ marginBlock: 'var(--sp-2) 0' }}>
            {available.map((item) => <li key={`${item.capability}:${item.label}`}>{item.label}</li>)}
          </ul>
          {available.length === 0 && <p role="status">No current scoped grant exposes functions in this workspace.</p>}
        </div>

        {role === 'student' && (
          <p>Your sample plan and evidence only. {workspace.tasks.filter((task) => task.status === 'open').length} open sample items are in this context.</p>
        )}

        {role === 'faculty' && (
          <>
            <p>Prepare course materials for review without changing the sample learning system.</p>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))', gap: 'var(--sp-3)' }}>
              {capabilities.has('course:manage') && (
                <ActionButton onClick={() => prepareFacultyDraft('assignment')}>Prepare assignment draft</ActionButton>
              )}
              {capabilities.has('message:course') && (
                <ActionButton onClick={() => prepareFacultyDraft('feedback')}>Prepare feedback draft</ActionButton>
              )}
            </div>
            <p style={{ color: 'var(--app-dim)' }}>Nothing is published to a learning system.</p>
          </>
        )}

        {role === 'teaching_assistant' && (
          <>
            <p>Assigned-course preparation only. No grade or course change is published from this preview.</p>
            {capabilities.has('office-hours:prepare') && (
              <ActionButton onClick={prepareRoleDraft}>Prepare office-hours support</ActionButton>
            )}
          </>
        )}

        {(role === 'advisor' || role === 'campus_staff') && (
          <div style={{ display: 'grid', gap: 'var(--sp-3)' }}>
            {workspace.cases.map((item) => (
              <div key={item.id} style={{ borderTop: '1px solid var(--app-line)', paddingTop: 'var(--sp-3)' }}>
                {item.consent ? (
                  <><strong>{item.title}</strong><div style={{ color: 'var(--app-dim)' }}>Sample consent on file · prepare local follow-up only</div></>
                ) : (
                  <><strong>Restricted sample case</strong><div role="status">Locked · sample consent required</div></>
                )}
              </div>
            ))}
            {ROLE_DRAFT_ACTIONS[role] && capabilities.has(ROLE_DRAFT_ACTIONS[role]!.capability) && (
              <ActionButton onClick={prepareRoleDraft}>
                {role === 'advisor' ? 'Prepare advising follow-up' : 'Prepare student support'}
              </ActionButton>
            )}
          </div>
        )}

        {role === 'university_admin' && (
          <>
            <p>Illustrative settings · server enforcement required</p>
            <p>{controlAccess.authorization} Open the Control tab to inspect policy readiness.</p>
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

        {role !== 'student' && role !== 'faculty' && role !== 'teaching_assistant'
          && role !== 'advisor' && role !== 'campus_staff' && ROLE_DRAFT_ACTIONS[role]
          && capabilities.has(ROLE_DRAFT_ACTIONS[role]!.capability) && (
          <ActionButton onClick={prepareRoleDraft}>{ROLE_DRAFT_ACTIONS[role]!.label}</ActionButton>
        )}

        {receipt && <p role="status">{receipt} Nothing was published or sent.</p>}
      </Blueprint>
    </section>
  );
}
