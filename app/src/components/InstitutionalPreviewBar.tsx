import { useState } from 'react';
import { useInstitutionalPreview } from './institutional/PreviewContext';

/*
 * The label a demo build wears, and nothing more.
 *
 * It used to be a panel that opened with "Synthetic preview · Northstar
 * University · Avery Student · Sandbox" and a list of adapter states, which
 * read as a test console sitting on top of the product. What it has to say is
 * one thing — this is a demo and none of it is a real student's record — so
 * the closed state says that and only that. Institution, persona and the
 * source list are one click away for the person running the demo.
 *
 * Hide is for this page load only. The disclosure is the reason the bar
 * exists, so nothing remembers the choice: a reload brings the label back.
 * That is also why there is no storage here (the test forbids it).
 */
const barStyle = {
  position: 'fixed',
  insetInline: 'auto 12px',
  insetBlockEnd: '12px',
  maxInlineSize: 'min(420px, calc(100vw - 24px))',
  zIndex: 120,
  paddingBlock: '6px',
  paddingInline: '10px',
  border: '1px solid var(--app-line)',
  borderRadius: 'var(--radius-lg)',
  background: 'var(--app-bg)',
  color: 'var(--app-fg)',
  boxShadow: 'var(--shadow-lg)',
  fontSize: '0.8125rem',
  display: 'flex',
  alignItems: 'flex-start',
  gap: '12px',
} as const;

// Typed through the context rather than by importing the fixture module:
// institutional-preview.test.ts holds production source to one import of it.
type SourceStatus = ReturnType<typeof useInstitutionalPreview>['institution']['connections'][number]['status'];

const fieldStyle = { display: 'block', marginBlockStart: '6px' } as const;

const SOURCE_STATE: Record<SourceStatus, string> = {
  'sandbox-connected': 'demo data',
  'sandbox-read-only': 'demo data, read-only',
  'sandbox-unavailable': 'not connected',
};

export function InstitutionalPreviewBar() {
  const { fixtures, institution, person, selectInstitution, selectPerson } = useInstitutionalPreview();
  const [hidden, setHidden] = useState(false);
  if (hidden) return null;

  return (
    <aside aria-label="Demo environment" style={barStyle}>
      <details>
        <summary style={{ whiteSpace: 'nowrap' }}>
          <strong>Demo environment</strong> · No real student data
        </summary>
        <p>
          {institution.name} · {person.name} · {person.role.replaceAll('_', ' ')}
        </p>
        <label style={fieldStyle}>
          Change institution{' '}
          <select value={institution.id} onChange={(event) => selectInstitution(event.target.value)}>
            {fixtures.map((fixture) => (
              <option key={fixture.id} value={fixture.id}>{fixture.name}</option>
            ))}
          </select>
        </label>
        <label style={fieldStyle}>
          Change persona{' '}
          <select value={person.id} onChange={(event) => selectPerson(event.target.value)}>
            {institution.people.map((candidate) => (
              <option key={candidate.id} value={candidate.id}>
                {candidate.name} — {candidate.role.replaceAll('_', ' ')}
              </option>
            ))}
          </select>
        </label>
        <p style={{ marginBlockEnd: 0 }}>Data sources</p>
        <ul style={{ marginBlock: '4px 0', paddingInlineStart: '18px' }}>
          {institution.connections.map((connection) => (
            <li key={connection.system}>
              {connection.system}: {SOURCE_STATE[connection.status]}
            </li>
          ))}
        </ul>
      </details>
      <button type="button" className="bare" onClick={() => setHidden(true)}>
        Hide
      </button>
    </aside>
  );
}
