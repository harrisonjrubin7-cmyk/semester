import { useState } from 'react';
import { download } from '../../lib/deliver';
import {
  audit,
  AUDIT_LABEL,
  bibtex,
  blankEvidence,
  blockers,
  cautions,
  DESIGNS,
  edit,
  reference,
  ris,
  screen,
  searchString,
  SOURCE_KINDS,
  verify,
  type Evidence,
  type Project,
  type Style,
} from '../../lib/toolkit/research';
import { Notice } from '../ui';
import { ConfirmDialog } from '../ConfirmDialog';
import { ActionPreview } from '../unity/ActionPreview';
import { newId, type useToolkit } from './store';

type Library = ReturnType<typeof useToolkit>;

const STEPS = ['Scope question', 'Build search plan', 'Find and screen sources', 'Extract evidence', 'Map themes and disagreements', 'Assess study quality', 'Build synthesis', 'Draft with citations', 'Verify every claim', 'Disclose AI use if required'];

const TEXT_FIELDS: readonly [keyof Evidence, string][] = [
  ['authors', 'Authors (separate with ;)'],
  ['year', 'Year'],
  ['title', 'Title'],
  ['venue', 'Journal, publisher or site'],
  ['doi', 'DOI'],
  ['url', 'Link'],
  ['question', 'Research question of the study'],
  ['sample', 'Sample and setting'],
  ['variables', 'Variables or intervention'],
  ['measures', 'Measures'],
  ['analysis', 'Analysis method'],
  ['finding', 'Key finding'],
  ['uncertainty', 'Effect size or uncertainty'],
  ['limitations', 'Limitations'],
  ['conflicts', 'Conflict of interest'],
  ['relevance', 'Relevance to my claim'],
  ['quote', 'Direct quotation'],
  ['page', 'Page or location'],
];

/**
 * The Research Studio: a project's question and search plan, its evidence
 * matrix, and the audit that links each claim to verified evidence. The
 * student enters every field from the original source; `lib/toolkit/research`
 * decides what counts as verified.
 */
export function ResearchPanel({ library }: { library: Library }) {
  const projects = library.value.research;
  const [openId, setOpenId] = useState<string | null>(projects[0]?.id ?? null);
  const [message, setMessage] = useState('');
  const [style, setStyle] = useState<Style>('apa');
  const [claimText, setClaimText] = useState('');
  const [deleting, setDeleting] = useState(false);
  const project = projects.find((p) => p.id === openId);

  const save = (next: Project) => library.update((s) => ({ ...s, research: s.research.map((p) => (p.id === next.id ? next : p)) }));
  const saveEvidence = (p: Project, e: Evidence) => save({ ...p, evidence: p.evidence.map((x) => (x.id === e.id ? e : x)) });
  const start = () => {
    const p: Project = { id: newId(), question: '', concepts: '', synonyms: '', databases: '', dateRange: '', include: '', exclude: '', evidence: [], claims: [] };
    library.update((s) => ({ ...s, research: [p, ...s.research] }));
    setOpenId(p.id);
  };

  if (!project)
    return (
      <section className="portal-panel" aria-labelledby="rs-title">
        <h3 id="rs-title">Research Studio</h3>
        <ol>
          {STEPS.map((s) => (
            <li key={s}>{s}</li>
          ))}
        </ol>
        <p className="portal-muted">AI summaries can help you find sources. They are never a source themselves: every entry here is checked against the original you open.</p>
        <button className="portal-primary" onClick={start}>
          Start a research project
        </button>
      </section>
    );

  const verifiedCount = project.evidence.filter((e) => e.verified).length;
  const field = (key: keyof Project, label: string, rows = 2) => (
    <label>
      {label}
      <textarea className="input" rows={rows} maxLength={20_000} value={project[key] as string} onChange={(e) => save({ ...project, [key]: e.target.value })} />
    </label>
  );

  return (
    <>
      <section className="portal-panel" aria-labelledby="rs-plan">
        <div className="portal-heading">
          <div>
            <span className="portal-eyebrow">Research project · Private</span>
            <h3 id="rs-plan">{project.question || 'New research question'}</h3>
            <p>
              {project.evidence.length} sources · {verifiedCount} verified against the original
            </p>
          </div>
          {projects.length > 1 && (
            <label>
              Project
              <select className="input" value={project.id} onChange={(e) => setOpenId(e.target.value)}>
                {projects.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.question || 'Untitled'}
                  </option>
                ))}
              </select>
            </label>
          )}
        </div>
        {field('question', '1. Research question')}
        <div className="portal-form-grid">
          {field('concepts', '2. Key concepts, one per line')}
          {field('synonyms', 'Synonyms for each concept, comma-separated, same line order')}
          {field('databases', 'Databases you will search')}
          {field('dateRange', 'Date range')}
          {field('include', 'Include if…')}
          {field('exclude', 'Exclude if…')}
        </div>
        {project.concepts.trim() && (
          <p>
            Search string: <code>{searchString(project.concepts, project.synonyms)}</code>
          </p>
        )}
      </section>

      <section className="portal-panel" aria-labelledby="rs-matrix">
        <h3 id="rs-matrix">3–6. Evidence matrix</h3>
        <button onClick={() => save({ ...project, evidence: [...project.evidence, blankEvidence(newId())] })}>Add a source</button>
        {project.evidence.map((e, n) => {
          const reasons = blockers(e);
          const warn = cautions(e);
          return (
            <details key={e.id} className="toolkit-evidence">
              <summary>
                {n + 1}. {e.title || 'Untitled source'} {e.year && `(${e.year})`} — <span className="portal-tag">{e.verified ? 'Verified' : e.screening === 'exclude' ? 'Excluded' : 'Not verified'}</span>
              </summary>
              <div className="portal-form-grid">
                <label>
                  Kind of source
                  <select className="input" value={e.kind} onChange={(ev) => saveEvidence(project, edit(e, { kind: ev.target.value as Evidence['kind'] }))}>
                    {SOURCE_KINDS.map(([k, label]) => (
                      <option key={k} value={k}>
                        {label}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Study design
                  <select className="input" value={e.design} onChange={(ev) => saveEvidence(project, edit(e, { design: ev.target.value as Evidence['design'] }))}>
                    {DESIGNS.map(([d, label]) => (
                      <option key={d} value={d}>
                        {label}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Sample size (n)
                  <input
                    className="input"
                    type="number"
                    min={0}
                    value={e.n ?? ''}
                    onChange={(ev) => saveEvidence(project, edit(e, { n: ev.target.value === '' ? undefined : Math.max(0, Number(ev.target.value) || 0) }))}
                  />
                </label>
                {TEXT_FIELDS.map(([key, label]) => (
                  <label key={key}>
                    {label}
                    <input className="input" maxLength={5000} value={e[key] as string} onChange={(ev) => saveEvidence(project, edit(e, { [key]: ev.target.value }))} />
                  </label>
                ))}
              </div>
              <label>
                Passage from the original, pasted to check the quotation
                <textarea className="input" rows={3} maxLength={40_000} value={e.excerpt} onChange={(ev) => saveEvidence(project, edit(e, { excerpt: ev.target.value }))} />
              </label>
              <div className="portal-form-grid">
                <label>
                  Screening
                  <select
                    className="input"
                    value={e.screening}
                    onChange={(ev) => {
                      const r = screen(e, ev.target.value as Evidence['screening'], e.screeningReason);
                      if (r.ok) saveEvidence(project, r.evidence);
                      else setMessage(r.reason);
                    }}
                  >
                    <option value="unscreened">Not screened</option>
                    <option value="keep">Keep</option>
                    <option value="maybe">Maybe</option>
                    <option value="exclude">Exclude</option>
                  </select>
                </label>
                <label>
                  Screening reason
                  <input className="input" maxLength={2000} value={e.screeningReason} onChange={(ev) => saveEvidence(project, edit(e, { screeningReason: ev.target.value }))} />
                </label>
              </div>
              <label className="portal-check">
                <input type="checkbox" checked={e.originalOpened} onChange={(ev) => saveEvidence(project, edit(e, { originalOpened: ev.target.checked }))} />I opened and read the original source myself
              </label>
              {warn.length > 0 && (
                <ul aria-label="Study quality notes">
                  {warn.map((w) => (
                    <li key={w}>{w}</li>
                  ))}
                </ul>
              )}
              {!e.verified && reasons.length > 0 && (
                <ul aria-label="Before this can be verified">
                  {reasons.map((r) => (
                    <li key={r}>{r}</li>
                  ))}
                </ul>
              )}
              <div className="portal-actions">
                {!e.verified && (
                  <button
                    onClick={() => {
                      const r = verify(e);
                      if (r.ok) saveEvidence(project, r.evidence);
                      setMessage(r.ok ? 'Marked verified.' : r.reasons[0]);
                    }}
                  >
                    Mark verified
                  </button>
                )}
                <button
                  onClick={() =>
                    save({
                      ...project,
                      evidence: project.evidence.filter((x) => x.id !== e.id),
                      claims: project.claims.map((c) => ({ ...c, evidence: c.evidence.filter((id) => id !== e.id) })),
                    })
                  }
                >
                  Remove source
                </button>
              </div>
            </details>
          );
        })}
      </section>

      <section className="portal-panel" aria-labelledby="rs-claims">
        <h3 id="rs-claims">7–9. Claims and citation audit</h3>
        <label>
          A claim you want to make
          <input className="input" maxLength={2000} value={claimText} onChange={(e) => setClaimText(e.target.value)} />
        </label>
        <button
          disabled={!claimText.trim()}
          onClick={() => {
            save({ ...project, claims: [...project.claims, { id: newId(), text: claimText.trim(), evidence: [] }] });
            setClaimText('');
          }}
        >
          Add claim
        </button>
        {project.claims.map((c) => {
          const a = audit(c, project.evidence);
          return (
            <fieldset key={c.id}>
              <legend>
                {c.text} — <span className="portal-tag">{AUDIT_LABEL[a.status]}</span>
              </legend>
              <p className="portal-muted">{a.note}</p>
              {project.evidence.map((e) => (
                <label key={e.id} className="portal-check">
                  <input
                    type="checkbox"
                    checked={c.evidence.includes(e.id)}
                    onChange={(ev) =>
                      save({
                        ...project,
                        claims: project.claims.map((x) => (x.id === c.id ? { ...x, evidence: ev.target.checked ? [...x.evidence, e.id] : x.evidence.filter((id) => id !== e.id) } : x)),
                      })
                    }
                  />
                  Supported by {e.title || 'untitled source'}
                  {e.page ? ` (${e.page})` : ''}
                </label>
              ))}
              <button onClick={() => save({ ...project, claims: project.claims.filter((x) => x.id !== c.id) })}>Remove claim</button>
            </fieldset>
          );
        })}
      </section>

      <section className="portal-panel" aria-labelledby="rs-export">
        <h3 id="rs-export">References</h3>
        <p className="portal-muted">Formatted from exactly what you entered. Missing details show as missing — check each against the style guide before you submit.</p>
        <label>
          Style
          <select className="input" value={style} onChange={(e) => setStyle(e.target.value as Style)}>
            <option value="apa">APA</option>
            <option value="mla">MLA</option>
            <option value="chicago">Chicago (author-date)</option>
          </select>
        </label>
        <ul>
          {project.evidence
            .filter((e) => e.kind !== 'ai-summary' && e.screening !== 'exclude')
            .map((e) => (
              <li key={e.id}>
                {reference(e, style)} {!e.verified && <span className="portal-tag">Not verified</span>}
              </li>
            ))}
        </ul>
        <div className="portal-actions">
          <button onClick={() => download({ name: 'references.ris', mime: 'application/x-research-info-systems', body: ris(project.evidence.filter((e) => e.screening !== 'exclude')) })}>Download RIS</button>
          <button onClick={() => download({ name: 'references.bib', mime: 'application/x-bibtex', body: bibtex(project.evidence.filter((e) => e.screening !== 'exclude')) })}>Download BibTeX</button>
          <button
            onClick={() => setDeleting(true)}
          >
            Delete project
          </button>
          <button onClick={start}>Start another project</button>
        </div>
      </section>
      {deleting ? (
        <ConfirmDialog
          title="Delete research project?"
          preview={(
            <ActionPreview
              subject={project.question || 'Untitled research project'}
              says="Deletes this project, its evidence matrix, claims and search plan from this device."
              doesNotChange="Original sources and files outside Semester stay where they are."
              recovery={{ kind: 'none' }}
            />
          )}
          confirmLabel="Delete it"
          onCancel={() => setDeleting(false)}
          onConfirm={() => {
            library.update((s) => ({ ...s, research: s.research.filter((p) => p.id !== project.id) }));
            setDeleting(false);
            setOpenId(null);
          }}
        />
      ) : null}
      {message && <Notice>{message}</Notice>}
    </>
  );
}
