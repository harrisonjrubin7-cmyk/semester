import { useState } from 'react';
import { secondLine } from '../lib/dim';
import { eraseDevice } from '../lib/erase';
import { useInstitutionalPreview } from './institutional/PreviewContext';

/*
 * The label a demo build wears, and nothing more.
 *
 * It used to be a panel that opened with "Synthetic preview · Northstar
 * University · Avery Student · Sandbox" and a list of adapter states, which
 * read as a test console sitting on top of the product. What it has to say is
 * one thing — this is a sample university, none of it is a real student's
 * record, and nothing done here is sent to Semester — so the closed state says
 * that and only that. Institution, persona, the source list and a reset are
 * one click away for the person running the demo.
 *
 * There is no Hide. The disclosure is the reason the bar exists, and a visitor
 * who has been handed the demo link should never be able to lose it. Whatever
 * a visitor changes stays in this browser (the demo build has no account
 * service), and the reset takes it back to how the sample started: it erases
 * the device the way the app's own Erase does, then reloads. This file holds
 * no storage of its own (the test forbids it).
 *
 * The demo is deployed at /demo/ on the same origin as the real app, so the two
 * share their browser storage, and a reset that erased without asking
 * could take a real student's coursework with it. It asks first, in words that
 * say so. Giving the demo its own storage namespace is the real fix, and is
 * not done here.
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
  flexDirection: 'column',
  gap: '4px',
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
  const [resetting, setResetting] = useState(false);
  const [asking, setAsking] = useState(false);

  const reset = async () => {
    setResetting(true);
    try {
      await eraseDevice();
    } catch {
      // Part of the erase refused (a browser with storage off, say). What is left is what the
      // browser would not let go, and the reload is still the honest way to start again.
    }
    location.reload();
  };

  return (
    <aside aria-label="Demo environment" style={barStyle}>
      <details>
        <summary>
          <strong>Demo environment</strong> · Sample university · Fictional data
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
          Who you are in this sample{' '}
          <select value={person.id} onChange={(event) => selectPerson(event.target.value)}>
            {institution.people.map((candidate) => (
              <option key={candidate.id} value={candidate.id}>
                {candidate.name} — {candidate.role.replaceAll('_', ' ')}
              </option>
            ))}
          </select>
        </label>
        <p style={{ marginBlockStart: '6px', marginBlockEnd: 0 }}>
          There are {institution.people.length} roles to try. Registrar, gift-officer and K-12 parent views are planned and are not in this sample.
        </p>
        <p style={{ marginBlockEnd: 0 }}>Data sources</p>
        <ul style={{ marginBlock: '4px 0', paddingInlineStart: '18px' }}>
          {institution.connections.map((connection) => (
            <li key={connection.system}>
              {connection.system}: {SOURCE_STATE[connection.status]}
            </li>
          ))}
        </ul>
        <p style={{ marginBlockStart: '8px', marginBlockEnd: 0 }}>
          Changes you make stay in this browser. Reset starts the sample again from the beginning.
        </p>
        {asking ? (
          <div role="alert" style={{ marginBlockStart: '6px' }}>
            <p style={{ marginBlock: 0 }}>
              This clears everything Semester has saved in this browser at this address, including your own courses and files if you also use the real app here, and disconnects any account you connected there.
            </p>
            <button type="button" className="bare" disabled={resetting} onClick={() => void reset()} style={{ marginBlockStart: '6px', textDecoration: 'underline', cursor: 'pointer' }}>
              {resetting ? 'Resetting…' : 'Yes, erase and start the sample again'}
            </button>{' '}
            <button type="button" className="bare" disabled={resetting} onClick={() => setAsking(false)} style={{ textDecoration: 'underline', cursor: 'pointer' }}>
              Keep what is here
            </button>
          </div>
        ) : (
          <button type="button" className="bare" onClick={() => setAsking(true)} style={{ marginBlockStart: '6px', textDecoration: 'underline', cursor: 'pointer' }}>
            Reset the sample
          </button>
        )}
      </details>
      <p style={{ margin: 0, fontSize: '0.75rem', ...secondLine() }}>Nothing you do here is sent to Semester.</p>
    </aside>
  );
}
