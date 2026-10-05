import { KNOWN_LIMITATIONS, KNOWN_LIMITATIONS_AS_OF, REPORT } from '../lib/knownlimitations';

/**
 * Known limitations, on Help.
 *
 * The public site prints the same list at `/known-limitations/`, but the site
 * has no deployment yet and the app does — so the copy a pilot student can
 * actually open is this one. A `<details>` rather than a chapter of the
 * guidebook: the guide describes what each screen does, and this is the list
 * of what none of them does yet, dated, with what to do instead. It opens by
 * keyboard, touch or screen reader with no script of its own.
 */
export function KnownLimitations() {
  return (
    <details data-known-limitations style={{ margin: '0 0 var(--sp-6)' }}>
      <summary style={{ cursor: 'pointer', fontSize: 'var(--type-sm-plus)', lineHeight: 'var(--leading-relaxed)' }}>
        <strong>Known limitations</strong> — what does not work yet, as of {KNOWN_LIMITATIONS_AS_OF}
      </summary>
      <p style={{ fontSize: 'var(--type-sm)', color: 'var(--app-dim)', margin: 'var(--sp-3) 0 var(--sp-4)', lineHeight: 'var(--leading-relaxed)' }}>
        Semester works on this device without an account; everything here is about the edges of that. The same list, with where each item is stated, is at <code>docs/pilot/KNOWN-LIMITATIONS.md</code> in the repository.
      </p>
      <ul style={{ margin: 0, paddingLeft: 'var(--sp-5)', fontSize: 'var(--type-sm)', lineHeight: 'var(--leading-relaxed)' }}>
        {KNOWN_LIMITATIONS.map((l) => (
          <li key={l.id} style={{ marginBottom: 'var(--sp-3)' }}>
            <strong>{l.title}</strong> {l.what} <em>Instead:</em> {l.instead}
          </li>
        ))}
      </ul>
      <p style={{ fontSize: 'var(--type-sm)', margin: 'var(--sp-4) 0 0', lineHeight: 'var(--leading-relaxed)' }}>
        <strong>To report something:</strong> {REPORT.lines[0]} {REPORT.lines[1]}
      </p>
    </details>
  );
}
