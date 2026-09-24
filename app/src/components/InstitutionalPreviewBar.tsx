import { useInstitutionalPreview } from './institutional/PreviewContext';

const barStyle = {
  position: 'fixed',
  inset: 'auto 12px 12px',
  zIndex: 120,
  paddingBlock: '10px',
  paddingInline: '12px',
  border: '1px solid var(--app-line)',
  borderRadius: 'var(--radius-lg)',
  background: 'var(--app-bg)',
  color: 'var(--app-fg)',
  boxShadow: 'var(--shadow-lg)',
} as const;

export function InstitutionalPreviewBar() {
  const { fixtures, institution, person, selectInstitution, selectPerson } = useInstitutionalPreview();

  return (
    <aside aria-label="Institutional preview controls" style={barStyle}>
      <details>
        <summary>
          <strong>Synthetic preview</strong> · {institution.name} · {person.name} · Sandbox
        </summary>
        <div>
          <label>
            Institution{' '}
            <select
              value={institution.id}
              onChange={(event) => selectInstitution(event.target.value)}
            >
              {fixtures.map((fixture) => (
                <option key={fixture.id} value={fixture.id}>{fixture.name}</option>
              ))}
            </select>
          </label>
          <label>
            Persona{' '}
            <select value={person.id} onChange={(event) => selectPerson(event.target.value)}>
              {institution.people.map((candidate) => (
                <option key={candidate.id} value={candidate.id}>
                  {candidate.name} — {candidate.role.replaceAll('_', ' ')}
                </option>
              ))}
            </select>
          </label>
          <ul>
            {institution.connections.map((connection) => (
              <li key={connection.system}>
                {connection.system}: {connection.status.replaceAll('-', ' ')} — {connection.detail}
              </li>
            ))}
          </ul>
        </div>
      </details>
    </aside>
  );
}
