import { useState } from 'react';
import { askToOpen } from '../../lib/learningintent';
import { download } from '../../lib/deliver';
import { card, type PolicySource } from '../../lib/toolkit/policy';
import { DISCLAIMER, interpret } from '../../lib/toolkit/rubric';
import { completeStage, MIN_NOTE, newWorkspace, progress, reopenStage, submissionChecklist, TEMPLATE_IDS, TEMPLATES, type TemplateId, type Workspace } from '../../lib/toolkit/templates';
import { Notice } from '../ui';
import { ContextBar } from '../unity/ContextBar';
import { newId, type useToolkit } from './store';

type Library = ReturnType<typeof useToolkit>;

/**
 * Assignment workspaces: a template's stages, the student's note for each,
 * and the checks before submission. A stage is marked done only once its note
 * is written — `completeStage` refuses otherwise, and the button says why.
 */
export function AssignmentPanel({
  library,
  courseCode,
  layers,
  initialTemplate,
  now,
  onLeave,
}: {
  library: Library;
  courseCode: string;
  layers: (PolicySource | undefined)[];
  /** Preselects the type; the caller keys this panel on it, so a new choice remounts rather than syncing state in an effect. */
  initialTemplate: TemplateId | null;
  now: Date;
  /** Leave the toolkit for the Study screen it sits inside — the toolkit is a mode of Study, not a screen, so this closes it. */
  onLeave: () => void;
}) {
  const workspaces = library.value.workspaces;
  const [openId, setOpenId] = useState<string | null>(null);
  const [kind, setKind] = useState<TemplateId>(initialTemplate ?? 'essay');
  const [title, setTitle] = useState('');
  const [message, setMessage] = useState('');

  const save = (ws: Workspace) => library.update((s) => ({ ...s, workspaces: s.workspaces.map((w) => (w.id === ws.id ? ws : w)) }));
  const create = () => {
    const ws = newWorkspace(newId(), kind, title, courseCode, now);
    library.update((s) => ({ ...s, workspaces: [ws, ...s.workspaces] }));
    setOpenId(ws.id);
    setTitle('');
  };
  const open = workspaces.find((w) => w.id === openId);

  if (open) {
    const t = TEMPLATES[open.template];
    const p = progress(open);
    const policy = card(layers);
    return (
      <section className="portal-panel" aria-label={`${open.title} workspace`}>
        {/* Where this is, what it is, whose it is and that it is saved — the
            shared bar. Provenance used to be its own heading further down; it
            is the bar's Source & details now, which is where every other
            workspace says it. "Private" is the drawer's visibility, "Only you". */}
        <ContextBar
          heading={3}
          context={`${open.courseCode || 'Independent project'} · ${t.name}`}
          title={open.title}
          statuses={['yours']}
          save="saved"
          source={{
            title: open.title,
            origin: 'yours',
            limitations: 'Everything in this workspace is your own writing. The toolkit generated none of it.',
          }}
          secondary={{ label: '← All workspaces', run: () => setOpenId(null) }}
        />
        <p>
          {p.done} of {p.total} stages done{p.next ? ` · Next: ${p.next.label}` : ''}
        </p>
        <progress max={p.total} value={p.done} aria-label="Stages done" />
        <label>
          Assignment instructions (paste them from the course)
          <textarea className="input" rows={4} maxLength={20_000} value={open.prompt} onChange={(e) => save({ ...open, prompt: e.target.value })} />
        </label>
        <label>
          Your learning goal
          <input className="input" maxLength={2000} value={open.goal} onChange={(e) => save({ ...open, goal: e.target.value })} />
        </label>
        <ol className="toolkit-stages">
          {t.stages.map((stage) => {
            const done = open.done.includes(stage.id);
            const note = open.notes[stage.id] ?? '';
            return (
              <li key={stage.id}>
                <h4>
                  {stage.label} {done && <span className="portal-tag">Done</span>}
                </h4>
                <p className="portal-muted">{stage.prompt}</p>
                <label>
                  Your note for {stage.label}
                  <textarea className="input" rows={3} maxLength={20_000} value={note} onChange={(e) => save({ ...open, notes: { ...open.notes, [stage.id]: e.target.value } })} />
                </label>
                {done ? (
                  <button onClick={() => save(reopenStage(open, stage.id))}>Reopen {stage.label}</button>
                ) : (
                  <button
                    aria-describedby={note.trim().length < MIN_NOTE ? `need-${stage.id}` : undefined}
                    onClick={() => {
                      const r = completeStage(open, stage.id);
                      if (r.ok) save(r.workspace);
                      setMessage(r.ok ? `${stage.label} marked done.` : r.reason);
                    }}
                  >
                    Mark {stage.label} done
                  </button>
                )}
                {!done && note.trim().length < MIN_NOTE && (
                  <p id={`need-${stage.id}`} className="portal-muted">
                    Write a short note in your own words first.
                  </p>
                )}
              </li>
            );
          })}
        </ol>
        {message && <Notice>{message}</Notice>}
        <h4>Before you submit</h4>
        <ul>
          {submissionChecklist({ disclosureNeeded: policy.disclose.length > 0, hasRubric: false, hasSources: open.template === 'research_paper' || open.template === 'annotated_bibliography' }).map((c) => (
            <li key={c}>{c}</li>
          ))}
        </ul>
        <label>
          Reflection: what would you do differently next time?
          <textarea className="input" rows={3} maxLength={20_000} value={open.reflection} onChange={(e) => save({ ...open, reflection: e.target.value })} />
        </label>
        <div className="portal-actions">
          <button
            onClick={() =>
              download({
                name: `${open.title}.md`,
                mime: 'text/markdown',
                body: [`# ${open.title}`, open.prompt && `## Instructions\n${open.prompt}`, ...t.stages.map((s) => `## ${s.label}\n${open.notes[s.id] ?? ''}`), open.reflection && `## Reflection\n${open.reflection}`].filter(Boolean).join('\n\n'),
              })
            }
          >
            Download my notes
          </button>
          <button
            onClick={() => {
              askToOpen({ panel: 'feedback', work: open.title, courseCode: open.courseCode });
              onLeave();
            }}
          >
            File the feedback I received
          </button>
          <button
            onClick={() => {
              if (!window.confirm(`Delete “${open.title}” from this device? This cannot be undone.`)) return;
              library.update((s) => ({ ...s, workspaces: s.workspaces.filter((w) => w.id !== open.id) }));
              setOpenId(null);
            }}
          >
            Delete workspace
          </button>
        </div>
      </section>
    );
  }

  return (
    <section className="portal-panel" aria-labelledby="ws-list">
      <h3 id="ws-list">Assignment workspaces</h3>
      <p className="portal-muted">Each workspace breaks an assignment into stages. You write each stage; nothing is filled in for you.</p>
      <div className="portal-form-grid">
        <label>
          Type
          <select className="input" value={kind} onChange={(e) => setKind(e.target.value as TemplateId)}>
            {TEMPLATE_IDS.map((id) => (
              <option key={id} value={id}>
                {TEMPLATES[id].name}
              </option>
            ))}
          </select>
        </label>
        <label>
          Title
          <input className="input" maxLength={300} value={title} onChange={(e) => setTitle(e.target.value)} placeholder={TEMPLATES[kind].name} />
        </label>
      </div>
      <p className="portal-muted">Stages: {TEMPLATES[kind].stages.map((s) => s.label).join(' → ')}</p>
      <div className="portal-actions">
        <button className="portal-primary" onClick={create}>
          Start a {TEMPLATES[kind].name.toLowerCase()} workspace
        </button>
      </div>
      {workspaces.length > 0 && (
        <ul>
          {workspaces.map((w) => {
            const p = progress(w);
            return (
              <li key={w.id}>
                <button onClick={() => setOpenId(w.id)}>
                  {w.title} — {p.done}/{p.total} stages
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

export function RubricPanel() {
  const [text, setText] = useState('');
  const [ticked, setTicked] = useState<Record<string, boolean>>({});
  const criteria = interpret(text);
  return (
    <section className="portal-panel" aria-labelledby="rubric-title">
      <h3 id="rubric-title">Rubric self-check</h3>
      <p className="portal-warning">{DISCLAIMER}</p>
      <label>
        Paste the rubric from your course
        <textarea className="input" rows={6} maxLength={40_000} value={text} onChange={(e) => setText(e.target.value)} placeholder={'Evidence and Analysis — 30 points\nMakes a clear claim. Supports it with credible evidence.'} />
      </label>
      {criteria.map((c) => (
        <fieldset key={c.name}>
          <legend>
            {c.name}
            {c.points !== undefined ? ` — worth ${c.points} points` : ''}
          </legend>
          {c.checks.length ? (
            c.checks.map((check) => {
              const key = `${c.name}:${check}`;
              return (
                <label key={key} className="portal-check">
                  <input type="checkbox" checked={!!ticked[key]} onChange={(e) => setTicked((t) => ({ ...t, [key]: e.target.checked }))} />
                  My work does this: {check}
                </label>
              );
            })
          ) : (
            <p className="portal-muted">No descriptors under this criterion. Ask your instructor what it looks for.</p>
          )}
          {c.source && (
            <details>
              <summary>The rubric’s own words</summary>
              <p>{c.source}</p>
            </details>
          )}
        </fieldset>
      ))}
    </section>
  );
}
