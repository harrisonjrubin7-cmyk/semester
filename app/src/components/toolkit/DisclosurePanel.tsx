import { download } from '../../lib/deliver';
import { TIERS, type Tier } from '../../lib/toolkit/classification';
import { ATTESTATION, declarationGaps, declarationText } from '../../lib/toolkit/disclosure';
import { USES, type Use } from '../../lib/toolkit/policy';
import type { useToolkit } from './store';

/**
 * The AI-use declaration form. Written by the student, kept on this device,
 * and out only when they download or copy it — see `lib/toolkit/disclosure`.
 */
export function DisclosurePanel({ library, course }: { library: ReturnType<typeof useToolkit>; course: string }) {
  const d = { ...library.value.declaration, course: library.value.declaration.course || course };
  const set = (patch: Partial<typeof d>) => library.update((s) => ({ ...s, declaration: { ...d, ...patch } }));
  const gaps = declarationGaps(d);
  const text = (key: keyof typeof d, label: string) => (
    <label>
      {label}
      <input className="input" maxLength={5000} value={d[key] as string} onChange={(e) => set({ [key]: e.target.value })} />
    </label>
  );
  return (
    <section className="portal-panel" aria-labelledby="dc-title">
      <h3 id="dc-title">AI-use declaration</h3>
      <p className="portal-muted">Yours to attach to your work. It stays on this device until you copy or download it, and nothing in Semester reads it to score or flag you.</p>
      <div className="portal-form-grid">
        {text('assignment', 'Assignment')}
        {text('course', 'Course')}
        {text('tool', 'AI tool')}
        {text('version', 'Model or version, if known')}
        {text('dates', 'Dates used')}
        {text('purpose', 'Purpose, in your words')}
        {text('interaction', 'How you used it (a summary, not the whole chat)')}
        {text('outputUsed', 'Which parts of your work used its output')}
        {text('sourcesChecked', 'Sources you checked its output against')}
        {text('verified', 'Calculations, code or tests you verified')}
        {text('edits', 'Edits you made')}
        {text('limitations', 'Limitations you noticed')}
        <label>
          Kind of material you gave it
          <select className="input" value={d.inputTier} onChange={(e) => set({ inputTier: e.target.value as Tier })}>
            {TIERS.filter((t) => ['T0', 'T1', 'T2'].includes(t.tier)).map((t) => (
              <option key={t.tier} value={t.tier}>
                {t.name}
              </option>
            ))}
          </select>
        </label>
      </div>
      <fieldset>
        <legend>What you used it for</legend>
        {USES.filter(([u]) => u !== 'final-answers').map(([u, label]) => (
          <label key={u} className="portal-check">
            <input type="checkbox" checked={d.uses.includes(u)} onChange={(e) => set({ uses: e.target.checked ? [...d.uses, u] : d.uses.filter((x: Use) => x !== u) })} />
            {label}
          </label>
        ))}
      </fieldset>
      <label className="portal-check">
        <input type="checkbox" checked={d.attested} onChange={(e) => set({ attested: e.target.checked })} />
        {ATTESTATION}
      </label>
      {gaps.length > 0 && (
        <ul aria-label="Still to complete">
          {gaps.map((g) => (
            <li key={g}>{g}</li>
          ))}
        </ul>
      )}
      <details>
        <summary>Preview</summary>
        <pre>{declarationText(d)}</pre>
      </details>
      <div className="portal-actions">
        <button disabled={gaps.length > 0} onClick={() => download({ name: 'AI-use declaration.txt', mime: 'text/plain', body: declarationText(d) })}>
          Download declaration
        </button>
        <button disabled={gaps.length > 0} onClick={() => void navigator.clipboard?.writeText(declarationText(d))}>
          Copy declaration
        </button>
      </div>
    </section>
  );
}
