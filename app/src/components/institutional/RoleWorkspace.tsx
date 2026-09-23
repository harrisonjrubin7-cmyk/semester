import { useState } from 'react';
import { Blueprint } from '../Blueprint';
import { ActionButton, SectionLabel } from '../ui';
import { useFlightPlan } from './FlightPlanContext';
import { useInstitutionalPreview } from './PreviewContext';

const TITLES = {
  student: 'Student workspace',
  faculty: 'Faculty workspace',
  advisor: 'Advisor workspace',
  campus_staff: 'Student-success workspace',
  university_admin: 'Administrator workspace',
  moderator: 'Community moderation workspace',
  employer: 'Employer workspace',
  authorized_payer: 'Authorized payer workspace',
} as const;

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

  const external = role === 'moderator' || role === 'employer' || role === 'authorized_payer';

  return (
    <section aria-label={`${TITLES[role]} for ${institution.name}`} style={{ marginBlock: 'var(--sp-5)' }}>
      <SectionLabel>{TITLES[role]}</SectionLabel>
      <Blueprint plain style={{ padding: 'var(--sp-6)', background: 'var(--app-hero)' }}>
        <strong>{person.name} · Synthetic preview</strong>

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
          </p>
        )}

        {receipt && <p role="status">{receipt} Nothing was published or sent.</p>}
      </Blueprint>
    </section>
  );
}
