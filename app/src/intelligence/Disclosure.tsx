import type { IntelligenceResponse, SourceOrigin } from './contracts';

const ORIGIN_LABEL: Record<SourceOrigin, string> = {
  course: 'Course material',
  institution: 'Institution source',
  student: 'Student-provided source',
  web: 'Web source',
  inference: 'Inference',
};

const modeLabel = (mode: IntelligenceResponse['mode']) =>
  `${mode[0].toUpperCase()}${mode.slice(1)} mode`;

/** The provenance receipt shown under an answer, owned by Semester's UI. */
export function IntelligenceDisclosure({ response }: { response: IntelligenceResponse }) {
  return (
    <div
      aria-label="Semester Intelligence answer details"
      style={{ margin: 'var(--sp-4) 0 var(--sp-5)', fontSize: 'var(--type-xs)' }}
    >
      <div
        style={{
          display: 'flex',
          gap: 'var(--sp-3)',
          flexWrap: 'wrap',
          color: 'var(--app-dim)',
          marginBottom: 'var(--sp-3)',
        }}
      >
        <span>{modeLabel(response.mode)}</span>
        {response.origins.map((origin) => (
          <span key={origin}>· {ORIGIN_LABEL[origin]}</span>
        ))}
      </div>

      {response.evidence.length > 0 && (
        <div aria-label="Sources" style={{ display: 'flex', gap: 'var(--sp-3)', flexWrap: 'wrap' }}>
          {response.evidence.map((item) => (
            <details
              key={item.id}
              className="bare"
              data-evidence-id={item.id}
              style={{
                width: 'auto',
                color: 'var(--app-fg)',
                fontSize: 'var(--type-xs)',
              }}
            >
              <summary tabIndex={0} style={{ cursor: 'pointer', textDecoration: 'underline', textUnderlineOffset: 3 }}>
                {item.title} · {item.locator}
              </summary>
              <p>{item.excerpt || 'No excerpt is available.'}</p>
              <p>Verified {item.verifiedAt}</p>
            </details>
          ))}
        </div>
      )}

      <details style={{ marginTop: 'var(--sp-3)' }}>
        <summary
          tabIndex={0}
          style={{ cursor: 'pointer', color: 'var(--app-dim)', letterSpacing: '0.04em' }}
        >
          Information Semester used
        </summary>
        <ul style={{ margin: 'var(--sp-3) 0 0', paddingLeft: 'var(--sp-7)' }}>
          {response.informationUsed.length > 0 ? (
            response.informationUsed.map((item) => <li key={item}>{item}</li>)
          ) : (
            <li>No student record information was used.</li>
          )}
        </ul>
        {response.uncertainty && <p>Uncertainty: {response.uncertainty}</p>}
        {response.policyReason && <p>Policy: {response.policyReason}</p>}
      </details>
    </div>
  );
}
