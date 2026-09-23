import { useEffect, useState } from 'react';
import type { InstitutionalFixture } from '../data/institutional-preview';

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
  const [fixtures, setFixtures] = useState<readonly InstitutionalFixture[] | null>(null);
  const [institutionId, setInstitutionId] = useState('northstar');
  const [personId, setPersonId] = useState('northstar-student');

  useEffect(() => {
    let active = true;
    void import('../data/institutional-preview').then((module) => {
      if (active) setFixtures(module.INSTITUTIONAL_FIXTURES);
    });
    return () => {
      active = false;
    };
  }, []);

  if (!fixtures) return <aside aria-label="Institutional preview controls">Loading synthetic preview…</aside>;

  const institution = fixtures.find((fixture) => fixture.id === institutionId) ?? fixtures[0];
  const person = institution.people.find((candidate) => candidate.id === personId) ?? institution.people[0];

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
              onChange={(event) => {
                const next = fixtures.find((fixture) => fixture.id === event.target.value) ?? fixtures[0];
                setInstitutionId(next.id);
                setPersonId(next.people[0].id);
              }}
            >
              {fixtures.map((fixture) => (
                <option key={fixture.id} value={fixture.id}>{fixture.name}</option>
              ))}
            </select>
          </label>
          <label>
            Persona{' '}
            <select value={person.id} onChange={(event) => setPersonId(event.target.value)}>
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
