import { useState } from 'react';
import type { Screen } from '../../lib/types';
import { download } from '../../lib/deliver';
import { safeName } from '../../lib/export';
import { show } from '../../lib/stats';
import { gate, TIERS, type Tier } from '../../lib/toolkit/classification';
import {
  addTransform,
  altText,
  clean,
  describeColumn,
  fits,
  importCsv,
  interpretationGaps,
  methodsFor,
  methodsWriteUp,
  toCsv,
  type Comparison,
  type DataProject,
  type Interpretation,
  type Outcome,
  type TransformKind,
} from '../../lib/toolkit/data';
import { permits, resolve, type PolicySource } from '../../lib/toolkit/policy';
import { FilePick, Notice } from '../ui';
import { ConfirmDialog } from '../ConfirmDialog';
import { ActionPreview } from '../unity/ActionPreview';
import { newId, type useToolkitData } from './store';

type DataLibrary = ReturnType<typeof useToolkitData>;

const INTERPRETATION: readonly [keyof Interpretation, string][] = [
  ['shows', 'What the data shows (descriptive result)'],
  ['method', 'What test or model was used, and its assumptions'],
  ['uncertainty', 'What the uncertainty is'],
  ['conclude', 'What we can reasonably conclude'],
  ['cannotConclude', 'What we cannot conclude'],
];

/**
 * The Data Studio: classify, import, understand, clean, describe, choose a
 * method and write a bounded conclusion. Every number is computed by
 * `lib/stats.ts`; nothing here is sent anywhere.
 */
export function DataPanel({ library, uploadOn, layers, now, onOpen }: { library: DataLibrary; uploadOn: boolean; layers: (PolicySource | undefined)[]; now: Date; onOpen: (s: Screen) => void }) {
  const projects = library.value;
  const [openId, setOpenId] = useState<string | null>(projects[0]?.id ?? null);
  const [tier, setTier] = useState<Tier | ''>('');
  const [name, setName] = useState('');
  const [paste, setPaste] = useState('');
  const [message, setMessage] = useState('');
  const [col, setCol] = useState('');
  const [outcome, setOutcome] = useState<Outcome>('number');
  const [comparison, setComparison] = useState<Comparison>('two-groups');
  const [paired, setPaired] = useState(false);
  const [step, setStep] = useState<{ kind: TransformKind; column: string; from: string; to: string; note: string }>({ kind: 'drop-missing', column: '', from: '', to: '', note: '' });
  const [deleting, setDeleting] = useState(false);
  const project = projects.find((p) => p.id === openId);
  const save = (p: DataProject) => library.update((all) => all.map((x) => (x.id === p.id ? p : x)));
  const aiAllowed = permits(resolve('data-cleaning', layers).state);

  const importText = (text: string, label: string) => {
    const r = importCsv(newId(), label, text, tier || undefined, now);
    if (!r.ok) {
      setMessage(`${r.reason}${r.route ? ` ${r.route}` : ''}`);
      return;
    }
    // Measured as it will be stored, so the refusal names the real reason
    // instead of surfacing as a generic write failure.
    if (!fits([r.project, ...projects])) {
      setMessage('Not enough room on this device for another dataset. Delete one you have finished with, or import a smaller extract.');
      return;
    }
    // A write the library refused has not happened. Saying "Imported" anyway
    // is how a student works an evening on data that is gone on reload.
    if (!library.update((all) => [r.project, ...all])) {
      setMessage('The dataset could not be saved on this device, so it has not been imported. See the notice above.');
      return;
    }
    setOpenId(r.project.id);
    setPaste('');
    setMessage(`Imported ${r.project.name}. The original is kept exactly as imported.`);
  };

  const guide = (
    <section className="portal-panel" aria-labelledby="ds-methods">
      <h3 id="ds-methods">Choosing a method</h3>
      <p className="portal-muted">These are candidates, not a verdict. Which fits depends on how the data was collected and what your course has taught.</p>
      <div className="portal-form-grid">
        <label>
          Outcome
          <select className="input" value={outcome} onChange={(e) => setOutcome(e.target.value as Outcome)}>
            <option value="number">A number (a score, a time)</option>
            <option value="category">A category (yes/no, a group)</option>
          </select>
        </label>
        <label>
          Comparison
          <select className="input" value={comparison} onChange={(e) => setComparison(e.target.value as Comparison)}>
            <option value="one-group">One group against a value</option>
            <option value="two-groups">Two groups</option>
            <option value="three-plus-groups">Three or more groups</option>
            <option value="relationship">A relationship between two variables</option>
          </select>
        </label>
      </div>
      <label className="portal-check">
        <input type="checkbox" checked={paired} onChange={(e) => setPaired(e.target.checked)} />
        The same people or units are measured more than once
      </label>
      <ul>
        {methodsFor(outcome, comparison, paired).map((m) => (
          <li key={m.name}>
            <strong>{m.name}</strong> — {m.when}. Assumes: {m.assumptions.join('; ')}. If those fail: {m.ifAssumptionsFail}.
          </li>
        ))}
      </ul>
    </section>
  );

  return (
    <>
      {library.error ? (
        <Notice alert>
          {library.error}{' '}
          <button onClick={() => download({ name: 'Semester data studio recovery.json', body: library.recovery(), mime: 'application/json' })}>
            Download recovery copy
          </button>
        </Notice>
      ) : null}
      <section className="portal-panel" aria-labelledby="ds-import">
        <h3 id="ds-import">1. Import</h3>
        {!uploadOn ? (
          <p className="portal-muted">Data import is switched off here. The method guide below still works without data.</p>
        ) : (
          <>
            <fieldset>
              <legend>What kind of data is this? (required before import)</legend>
              {TIERS.map((t) => (
                <label key={t.tier} className="portal-check">
                  <input type="radio" name="tier" checked={tier === t.tier} onChange={() => setTier(t.tier)} />
                  {t.name} — {t.examples}
                </label>
              ))}
            </fieldset>
            {tier && !gate(tier, 'store', false).allowed && <p className="portal-warning">{gate(tier, 'store', false).reason} {(gate(tier, 'store', false) as { route?: string }).route}</p>}
            <label>
              Dataset name
              <input className="input" maxLength={300} value={name} onChange={(e) => setName(e.target.value)} />
            </label>
            <FilePick multiple={false} accept=".csv,.tsv,.txt" onPick={(files) => void files[0]?.text().then((t) => importText(t, name || files[0].name))}>
              Import a CSV file
            </FilePick>
            <details>
              <summary>Paste CSV instead</summary>
              <label>
                CSV text
                <textarea className="input" rows={5} maxLength={2_000_000} value={paste} onChange={(e) => setPaste(e.target.value)} />
              </label>
              <button disabled={!paste.trim()} onClick={() => importText(paste, name)}>
                Import pasted data
              </button>
            </details>
            <p className="portal-muted">
              {tier && !gate(tier, 'ai', true).allowed
                ? 'AI help is not available for this kind of data, whatever the course allows. The studio sends nothing either way.'
                : aiAllowed
                  ? 'AI help with cleaning is allowed for this course — the studio itself sends nothing.'
                  : 'This course has not allowed AI help with data cleaning. The studio sends nothing either way.'}
            </p>
          </>
        )}
        {projects.length > 0 && (
          <label>
            Dataset
            <select className="input" value={project?.id ?? ''} onChange={(e) => setOpenId(e.target.value)}>
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </label>
        )}
      </section>

      {project && <ProjectView project={project} save={save} col={col} setCol={setCol} step={step} setStep={setStep} setMessage={setMessage} onOpen={onOpen} onDelete={() => setDeleting(true)} />}
      {project && deleting ? (
        <ConfirmDialog
          title="Delete dataset?"
          preview={(
            <ActionPreview
              subject={project.name}
              says="Deletes this dataset, its cleaning log and interpretation notes from this device."
              doesNotChange="The original file outside Semester stays where it is."
              recovery={{ kind: 'none' }}
            />
          )}
          confirmLabel="Delete it"
          onCancel={() => setDeleting(false)}
          onConfirm={() => {
            library.update((all) => all.filter((p) => p.id !== project.id));
            setDeleting(false);
            setOpenId(null);
          }}
        />
      ) : null}
      {guide}
      {message && <Notice>{message}</Notice>}
    </>
  );
}

function ProjectView({
  project,
  save,
  col,
  setCol,
  step,
  setStep,
  setMessage,
  onOpen,
  onDelete,
}: {
  project: DataProject;
  save: (p: DataProject) => void;
  col: string;
  setCol: (c: string) => void;
  step: { kind: TransformKind; column: string; from: string; to: string; note: string };
  setStep: (s: { kind: TransformKind; column: string; from: string; to: string; note: string }) => void;
  setMessage: (m: string) => void;
  onOpen: (s: Screen) => void;
  onDelete: () => void;
}) {
  const table = clean(project);
  const d = col ? describeColumn(table, col) : null;
  const gaps = interpretationGaps(project);
  // The tier was only asked about storing at import. Leaving the device is a
  // separate question, and an education record's answer is no.
  const leaving = gate(project.tier, 'export', false);
  const file = safeName(project.name, 'dataset');
  return (
    <>
      <section className="portal-panel" aria-labelledby="ds-dict">
        <h3 id="ds-dict">2. Understand — data dictionary</h3>
        <p className="portal-muted">Types are suggestions until you confirm them.</p>
        <div className="portal-table-scroll">
          <table>
            <caption>Variables in {project.name}</caption>
            <thead>
              <tr>
                <th scope="col">Variable</th>
                <th scope="col">Type</th>
                <th scope="col">Unit</th>
                <th scope="col">Valid values</th>
                <th scope="col">Confirmed</th>
              </tr>
            </thead>
            <tbody>
              {project.dictionary.map((c, i) => {
                const set = (patch: Partial<typeof c>) => save({ ...project, dictionary: project.dictionary.map((x, j) => (j === i ? { ...x, ...patch } : x)) });
                return (
                  <tr key={c.name}>
                    <th scope="row">{c.name}</th>
                    <td>
                      <select aria-label={`Type of ${c.name}`} value={c.type} onChange={(e) => set({ type: e.target.value as typeof c.type, confirmed: false })}>
                        <option value="number">Number</option>
                        <option value="category">Category</option>
                        <option value="text">Text</option>
                        <option value="date">Date</option>
                      </select>
                    </td>
                    <td>
                      <input aria-label={`Unit of ${c.name}`} maxLength={200} value={c.unit} onChange={(e) => set({ unit: e.target.value })} />
                    </td>
                    <td>
                      <input aria-label={`Valid values of ${c.name}`} maxLength={2000} value={c.valid} onChange={(e) => set({ valid: e.target.value })} />
                    </td>
                    <td>
                      <input type="checkbox" aria-label={`Confirm ${c.name}`} checked={c.confirmed} onChange={(e) => set({ confirmed: e.target.checked })} />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      <section className="portal-panel" aria-labelledby="ds-clean">
        <h3 id="ds-clean">Clean — every step logged, the original untouched</h3>
        <div className="portal-form-grid">
          <label>
            Step
            <select className="input" value={step.kind} onChange={(e) => setStep({ ...step, kind: e.target.value as TransformKind })}>
              <option value="drop-missing">Drop rows missing this variable</option>
              <option value="drop-duplicates">Drop exact duplicate rows</option>
              <option value="trim">Trim spaces</option>
              <option value="recode">Recode a value</option>
              <option value="exclude-column">Exclude a variable</option>
            </select>
          </label>
          {step.kind !== 'drop-duplicates' && (
            <label>
              Variable
              <select className="input" value={step.column} onChange={(e) => setStep({ ...step, column: e.target.value })}>
                <option value="">Choose…</option>
                {project.dictionary.map((c) => (
                  <option key={c.name}>{c.name}</option>
                ))}
              </select>
            </label>
          )}
          {step.kind === 'recode' && (
            <>
              <label>
                From
                <input className="input" value={step.from} onChange={(e) => setStep({ ...step, from: e.target.value })} />
              </label>
              <label>
                To
                <input className="input" value={step.to} onChange={(e) => setStep({ ...step, to: e.target.value })} />
              </label>
            </>
          )}
          <label>
            Why (required)
            <input className="input" maxLength={5000} value={step.note} onChange={(e) => setStep({ ...step, note: e.target.value })} />
          </label>
        </div>
        <button
          onClick={() => {
            const r = addTransform(project, { id: newId(), ...step });
            if (r.ok) {
              save(r.project);
              setStep({ ...step, note: '', from: '', to: '' });
            }
            setMessage(r.ok ? 'Step added to the log.' : r.reason);
          }}
        >
          Add step
        </button>
        <ol>
          {project.transforms.map((t) => (
            <li key={t.id}>
              {t.kind}
              {t.column ? ` · ${t.column}` : ''}
              {t.kind === 'recode' ? ` · “${t.from}” → “${t.to}”` : ''} — {t.note}{' '}
              <button onClick={() => save({ ...project, transforms: project.transforms.filter((x) => x.id !== t.id) })}>Undo step</button>
            </li>
          ))}
        </ol>
        <p className="portal-muted">{table.rows.length} rows after cleaning.</p>
      </section>

      <section className="portal-panel" aria-labelledby="ds-describe">
        <h3 id="ds-describe">3. Analyze — describe a variable</h3>
        <label>
          Variable
          <select className="input" value={col} onChange={(e) => setCol(e.target.value)}>
            <option value="">Choose…</option>
            {table.headers.map((h) => (
              <option key={h}>{h}</option>
            ))}
          </select>
        </label>
        {d && (
          <>
            <p>
              <strong>Description for a chart of this variable:</strong> {altText(d)}
            </p>
            <div className="portal-table-scroll">
              <table>
                <caption>{d.column}: the numbers behind any chart</caption>
                <tbody>
                  {d.numeric
                    ? (['n', 'missing', 'mean', 'sd', 'min', 'q1', 'median', 'q3', 'max'] as const).map((k) => (
                        <tr key={k}>
                          <th scope="row">{k}</th>
                          <td>{show(d.numeric![k])}</td>
                        </tr>
                      ))
                    : d.counts.map((c) => (
                        <tr key={c.value}>
                          <th scope="row">{c.value}</th>
                          <td>{c.count}</td>
                        </tr>
                      ))}
                </tbody>
              </table>
            </div>
            <button onClick={() => onOpen('analyse')}>Chart and model it in Analyse data</button>
          </>
        )}
      </section>

      <section className="portal-panel" aria-labelledby="ds-explain">
        <h3 id="ds-explain">4. Explain</h3>
        <label className="portal-check">
          <input type="checkbox" checked={project.randomized} onChange={(e) => save({ ...project, randomized: e.target.checked })} />
          This data comes from a randomized experiment
        </label>
        {INTERPRETATION.map(([key, label]) => (
          <label key={key}>
            {label}
            <textarea className="input" rows={2} maxLength={20_000} value={project.interpretation[key]} onChange={(e) => save({ ...project, interpretation: { ...project.interpretation, [key]: e.target.value } })} />
          </label>
        ))}
        {gaps.length > 0 && (
          <ul aria-label="Before this can be exported">
            {gaps.map((g) => (
              <li key={g}>{g}</li>
            ))}
          </ul>
        )}
        {!leaving.allowed && (
          <p className="portal-warning" role="status">
            {leaving.reason} {'route' in leaving ? leaving.route : ''}
          </p>
        )}
        <div className="portal-actions">
          {leaving.allowed && (
            <>
              <button disabled={gaps.length > 0} onClick={() => download({ name: `${file}-methods-and-results.txt`, mime: 'text/plain', body: methodsWriteUp(project) })}>
                5. Export methods and results
              </button>
              <button onClick={() => download({ name: `${file}-cleaned.csv`, mime: 'text/csv', body: toCsv(table) })}>
                Export cleaned CSV
              </button>
            </>
          )}
          <button onClick={onDelete}>Delete dataset</button>
        </div>
      </section>
    </>
  );
}
