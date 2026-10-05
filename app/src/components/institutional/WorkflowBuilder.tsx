/**
 * The Workflow Builder: a school defines a process — its steps, who owns each,
 * and the eligibility checks a student must meet — as a draft that a second
 * person publishes as a numbered version (D-1018), on the table in
 * `20260930231000_workflow_builder.sql`.
 *
 * What it shows is what the database will do. The check on a definition is
 * `problems` from `lib/workflow/spec.ts`, which mirrors the database's; Publish
 * is offered only when `publishBlocker` is empty, and if the two ever disagreed
 * the database's refusal is shown in the same sentences.
 *
 * The preview runs `evaluate` from `lib/workflow/engine.ts` on facts typed
 * into the screen: the same deterministic engine a student's answer would come
 * from, so a school sees what a student would be told before publishing. Nothing
 * typed there is stored, and nothing here runs a workflow for a student — a
 * definition is all this screen holds. The first screen says so.
 */
import { useCallback, useEffect, useState } from 'react';
import {
  current, draftOf, history, publishBlocker, workflowApi, type WorkflowApi, type WorkflowVersion,
} from '../../lib/workflow/api';
import { evaluate, headline, walkthrough, type Facts } from '../../lib/workflow/engine';
import {
  FACTS, FACT_KEYS, FACT_LABEL, LIMITS, OPS, OP_LABEL, OWNERS, OWNER_LABEL, STEP_KINDS, STEP_LABEL, WORKFLOWS, WORKFLOW_LABEL,
  problemText, problems,
  type Definition, type FactKey, type Op, type Owner, type Requirement, type Step, type StepKind, type WorkflowKey,
} from '../../lib/workflow/spec';
import { TEMPLATES } from '../../lib/workflow/templates';
import { cloud } from '../../lib/cloud';
import { secondLine } from '../../lib/dim';
import { formatDateTime } from '../../lib/locale';
import { ActionButton, EmptyState, Notice, SectionLabel } from '../ui';

export interface WorkflowBuilderProps {
  tenantId: string;
  /** The signed-in account: whoever drafted a workflow does not publish it. */
  viewerId: string | null;
  /** The account's verified capabilities at this school. */
  holds: readonly string[];
  /** Injected in tests; defaults to Supabase under the viewer's RLS. */
  api?: WorkflowApi;
}

const quiet = { fontSize: 'var(--type-sm)', ...secondLine(), lineHeight: 'var(--leading-normal)' } as const;
const body = { fontSize: 'var(--type-base)', lineHeight: 'var(--leading-relaxed)' } as const;
const grid = { display: 'grid', gap: 'var(--sp-4)', marginBlock: 'var(--sp-4)' } as const;
const label = { display: 'grid', gap: 'var(--sp-2)', fontSize: 'var(--type-sm)' } as const;
const row = { display: 'grid', gap: 'var(--sp-2)', paddingBlock: 'var(--sp-3)', borderTop: '1px solid var(--app-line)' } as const;
const inline = { display: 'flex', gap: 'var(--sp-2)', alignItems: 'center', flexWrap: 'wrap', fontSize: 'var(--type-sm)' } as const;
const errorText = (e: unknown, fallback: string) => (e instanceof Error ? e.message : fallback);
const when = (iso: string) => formatDateTime(iso, { dateStyle: 'medium', timeStyle: 'short' });

/** The next id `prefix1`, `prefix2` … not already taken. */
function freshId(prefix: string, taken: readonly string[]): string {
  let n = taken.length + 1;
  while (taken.includes(`${prefix}${n}`)) n += 1;
  return `${prefix}${n}`;
}

export function WorkflowBuilder({ tenantId, viewerId, holds, api }: WorkflowBuilderProps) {
  const [client, setClient] = useState<WorkflowApi | null>(api ?? null);
  const [rows, setRows] = useState<WorkflowVersion[]>([]);
  const [state, setState] = useState<'loading' | 'ready' | 'error'>('loading');
  const [message, setMessage] = useState('');
  const [picked, setPicked] = useState<WorkflowKey | null>(null);
  // Held here, not in the editor: a save reloads the rows, which starts the editor's form over.
  const [notice, setNotice] = useState('');

  useEffect(() => {
    if (api) return;
    let live = true;
    void cloud().then((db) => {
      if (live) setClient(workflowApi(db));
    }, () => {
      if (live) {
        setMessage('The Workflow Builder needs a connection to your school’s Semester project.');
        setState('error');
      }
    });
    return () => {
      live = false;
    };
  }, [api]);

  const refresh = useCallback(async () => {
    if (!client) return;
    try {
      setRows(await client.list(tenantId));
      setState('ready');
    } catch (e) {
      setMessage(errorText(e, 'Could not load the workflows.'));
      setState('error');
    }
  }, [client, tenantId]);

  useEffect(() => {
    if (!client) return;
    let live = true;
    client.list(tenantId).then((r) => {
      if (!live) return;
      setRows(r);
      setState('ready');
    }, (e: unknown) => {
      if (!live) return;
      setMessage(errorText(e, 'Could not load the workflows.'));
      setState('error');
    });
    return () => {
      live = false;
    };
  }, [client, tenantId]);

  if (state === 'loading') return <p role="status" style={body}>Loading workflows…</p>;
  if (state === 'error' || !client) return <Notice alert>{message || 'Could not load the workflows.'}</Notice>;

  if (picked) {
    return (
      <WorkflowEditor
        // A new version or draft is a new starting point for the form.
        key={`${picked}:${draftOf(rows, picked)?.updated_at ?? 'none'}:${current(rows, picked)?.version ?? 0}`}
        workflow={picked}
        rows={rows}
        tenantId={tenantId}
        viewerId={viewerId}
        holds={holds}
        api={client}
        notice={notice}
        onBack={() => {
          setPicked(null);
          setNotice('');
        }}
        onChanged={async (done) => {
          setNotice(done);
          await refresh();
        }}
      />
    );
  }

  return (
    <section aria-label="Workflow Builder">
      <SectionLabel>Workflow Builder</SectionLabel>
      <p style={{ ...quiet, marginBottom: 'var(--sp-4)' }}>
        Define how a process runs at your school: its steps, who owns each, and the checks a student must meet. A change
        is a draft; a colleague who holds the publish role publishes it as a numbered version, and you cannot publish
        your own.
      </p>
      <Notice>
        This holds the definition of a workflow, not a student going through one: no student, request or answer is stored
        here, and no step writes into an official system. Nothing in the app runs these definitions yet, so students see
        no change. Use the preview in each workflow to see what a student would be told.
      </Notice>
      <ul style={{ listStyle: 'none', padding: 0, marginTop: 'var(--sp-4)' }}>
        {WORKFLOWS.map((w) => {
          const now = current(rows, w);
          const draft = draftOf(rows, w);
          return (
            <li key={w} style={{ borderTop: '1px solid var(--app-line)' }}>
              <button
                type="button"
                className="btn btn-ghost btn-block"
                style={{ justifyContent: 'space-between', textAlign: 'left', paddingBlock: 'var(--sp-4)' }}
                onClick={() => setPicked(w)}
              >
                <span style={body}>{WORKFLOW_LABEL[w]}</span>
                <span style={{ ...quiet, textAlign: 'right' }}>
                  {now ? `Version ${now.version} · ${now.definition.steps.length} steps` : 'Not defined'}
                  {draft ? ' · draft waiting' : ''}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

// ── One workflow ────────────────────────────────────────────────────────────

function WorkflowEditor({
  workflow, rows, tenantId, viewerId, holds, api, notice, onBack, onChanged,
}: {
  workflow: WorkflowKey;
  rows: WorkflowVersion[];
  tenantId: string;
  viewerId: string | null;
  holds: readonly string[];
  api: WorkflowApi;
  notice: string;
  onBack: () => void;
  onChanged: (done: string) => Promise<void>;
}) {
  const now = current(rows, workflow);
  const draft = draftOf(rows, workflow);
  const canDraft = holds.includes('workflow:manage');
  const saved: Definition | null = draft?.definition ?? now?.definition ?? null;
  const [def, setDef] = useState<Definition | null>(saved);
  const [note, setNote] = useState(draft?.note ?? '');
  const [basedOn, setBasedOn] = useState<number | null>(draft?.based_on ?? now?.version ?? null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState(notice);
  const [facts, setFacts] = useState<Facts>({});

  const wrong = def ? problems(def) : [];
  const blocker = draft ? publishBlocker(draft, problems(draft.definition), viewerId, holds) : null;
  const dirty = def !== null && (JSON.stringify(def) !== JSON.stringify(saved) || note !== (draft?.note ?? ''));

  const act = async (what: () => Promise<void>, done: string) => {
    setBusy(true);
    setMessage('');
    try {
      await what();
      setMessage(done);
      await onChanged(done);
    } catch (e) {
      setMessage(errorText(e, 'That did not work.'));
    } finally {
      setBusy(false);
    }
  };

  const edit = (f: (d: Definition) => Definition) => setDef((d) => (d ? f(d) : d));
  const setStep = (i: number, patch: Partial<Step>) =>
    edit((d) => ({ ...d, steps: d.steps.map((s, at) => (at === i ? { ...s, ...patch } : s)) }));
  const setReq = (i: number, patch: Partial<Requirement>) =>
    edit((d) => ({ ...d, requires: (d.requires ?? []).map((r, at) => (at === i ? { ...r, ...patch } : r)) }));
  const move = (i: number, by: -1 | 1) =>
    edit((d) => {
      const steps = [...d.steps];
      const j = i + by;
      if (j < 0 || j >= steps.length) return d;
      [steps[i], steps[j]] = [steps[j], steps[i]];
      return { ...d, steps };
    });

  return (
    <section aria-label={WORKFLOW_LABEL[workflow]}>
      <ActionButton onClick={onBack} style={{ marginBottom: 'var(--sp-4)' }}>All workflows</ActionButton>
      <SectionLabel>{WORKFLOW_LABEL[workflow]}</SectionLabel>
      <p style={{ ...quiet, marginTop: 'var(--sp-2)' }}>
        {now
          ? `In force: version ${now.version}, published ${now.published_at ? when(now.published_at) : ''}.`
          : 'No version published. Nothing is defined for this workflow.'}
        {draft ? ' A draft is waiting.' : ''}
      </p>

      {def === null ? (
        <div style={{ marginBlock: 'var(--sp-5)' }}>
          {canDraft ? (
            <>
              <p style={quiet}>
                Start from the template for this workflow. It is a starting point, not your school’s process: the credit
                numbers and office names in it are placeholders to change.
              </p>
              <ActionButton tone="primary" onClick={() => { setDef(structuredClone(TEMPLATES[workflow])); setBasedOn(null); }}>
                Start from the template
              </ActionButton>
            </>
          ) : (
            <p style={quiet}>Your account can read workflows and cannot draft them.</p>
          )}
        </div>
      ) : (
        <form
          aria-label={`${WORKFLOW_LABEL[workflow]} definition`}
          style={grid}
          onSubmit={(e) => {
            e.preventDefault();
            void act(() => api.saveDraft(tenantId, workflow, def, note, basedOn, draft), 'Draft saved.');
          }}
        >
          <label style={label}>
            Title
            <input className="input" maxLength={LIMITS.title_max} disabled={!canDraft || busy} value={def.title} onChange={(e) => edit((d) => ({ ...d, title: e.target.value }))} />
          </label>

          <div>
            <SectionLabel>Steps</SectionLabel>
            {def.steps.map((s, i) => (
              <div key={s.id} style={row}>
                <div style={inline}>
                  <select className="input" aria-label={`Step ${i + 1} kind`} disabled={!canDraft || busy} value={s.kind} onChange={(e) => setStep(i, { kind: e.target.value as StepKind })}>
                    {STEP_KINDS.map((k) => <option key={k} value={k}>{STEP_LABEL[k]}</option>)}
                  </select>
                  <select className="input" aria-label={`Step ${i + 1} owner`} disabled={!canDraft || busy} value={s.owner} onChange={(e) => setStep(i, { owner: e.target.value as Owner })}>
                    {OWNERS.map((o) => <option key={o} value={o}>{OWNER_LABEL[o]}</option>)}
                  </select>
                  <input
                    className="input" type="number" min={1} max={LIMITS.sla_days_max} aria-label={`Step ${i + 1} days it may wait`}
                    placeholder="Days" disabled={!canDraft || busy} value={s.sla_days ?? ''}
                    onChange={(e) => {
                      const v = e.target.value;
                      edit((d) => ({
                        ...d,
                        steps: d.steps.map((x, at) => {
                          if (at !== i) return x;
                          const { sla_days: _drop, ...rest } = x;
                          return v === '' ? rest : { ...rest, sla_days: Number(v) };
                        }),
                      }));
                    }}
                  />
                </div>
                <input className="input" aria-label={`Step ${i + 1} title`} maxLength={LIMITS.title_max} disabled={!canDraft || busy} value={s.title} onChange={(e) => setStep(i, { title: e.target.value })} />
                {canDraft && (
                  <div style={inline}>
                    <ActionButton disabled={busy || i === 0} onClick={() => move(i, -1)} aria-label={`Move step ${i + 1} up`}>Up</ActionButton>
                    <ActionButton disabled={busy || i === def.steps.length - 1} onClick={() => move(i, 1)} aria-label={`Move step ${i + 1} down`}>Down</ActionButton>
                    <ActionButton disabled={busy || def.steps.length <= 1} onClick={() => edit((d) => ({ ...d, steps: d.steps.filter((_, at) => at !== i) }))} aria-label={`Remove step ${i + 1}`}>Remove</ActionButton>
                  </div>
                )}
              </div>
            ))}
            {canDraft && (
              <ActionButton
                disabled={busy || def.steps.length >= LIMITS.steps_max}
                onClick={() => edit((d) => {
                  const step: Step = { id: freshId('s', d.steps.map((x) => x.id)), kind: 'notify', title: 'New step', owner: 'system' };
                  // Keep the closing step last.
                  const last = d.steps.at(-1);
                  const steps = last?.kind === 'complete' ? [...d.steps.slice(0, -1), step, last] : [...d.steps, step];
                  return { ...d, steps };
                })}
              >
                Add a step
              </ActionButton>
            )}
          </div>

          <div>
            <SectionLabel>What a student must meet</SectionLabel>
            <p style={quiet}>Checks run in this order. Each says what the student is told, and what to do next, when it is not met.</p>
            {(def.requires ?? []).map((r, i) => {
              const spec = FACTS[r.fact];
              return (
                <div key={r.id} style={row}>
                  <div style={inline}>
                    <select
                      className="input" aria-label={`Check ${i + 1} fact`} disabled={!canDraft || busy} value={r.fact}
                      onChange={(e) => {
                        const fact = e.target.value as FactKey;
                        const t = FACTS[fact];
                        setReq(i, t.type === 'bool' ? { fact, op: 'eq', value: true } : { fact, op: 'gte', value: t.min });
                      }}
                    >
                      {FACT_KEYS.map((k) => <option key={k} value={k}>{FACT_LABEL[k]}</option>)}
                    </select>
                    <select className="input" aria-label={`Check ${i + 1} comparison`} disabled={!canDraft || busy} value={r.op} onChange={(e) => setReq(i, { op: e.target.value as Op })}>
                      {(OPS[spec.type] as readonly Op[]).map((o) => <option key={o} value={o}>{OP_LABEL[o]}</option>)}
                    </select>
                    {spec.type === 'bool' ? (
                      <select className="input" aria-label={`Check ${i + 1} value`} disabled={!canDraft || busy} value={r.value === true ? 'yes' : 'no'} onChange={(e) => setReq(i, { value: e.target.value === 'yes' })}>
                        <option value="yes">Yes</option>
                        <option value="no">No</option>
                      </select>
                    ) : (
                      <input
                        className="input" type="number" aria-label={`Check ${i + 1} value`} min={spec.min} max={spec.max} step={1}
                        disabled={!canDraft || busy} value={typeof r.value === 'number' ? r.value : ''}
                        onChange={(e) => setReq(i, { value: e.target.value === '' ? spec.min : Number(e.target.value) })}
                      />
                    )}
                  </div>
                  <input className="input" aria-label={`Check ${i + 1}: what the student is told`} maxLength={LIMITS.explain_max} disabled={!canDraft || busy} value={r.explain} onChange={(e) => setReq(i, { explain: e.target.value })} />
                  <input className="input" aria-label={`Check ${i + 1}: what to do next`} maxLength={LIMITS.next_step_max} disabled={!canDraft || busy} value={r.next_step} onChange={(e) => setReq(i, { next_step: e.target.value })} />
                  {canDraft && (
                    <div style={inline}>
                      <ActionButton disabled={busy} onClick={() => edit((d) => ({ ...d, requires: (d.requires ?? []).filter((_, at) => at !== i) }))} aria-label={`Remove check ${i + 1}`}>Remove</ActionButton>
                    </div>
                  )}
                </div>
              );
            })}
            {canDraft && (
              <ActionButton
                disabled={busy || (def.requires ?? []).length >= LIMITS.requires_max}
                onClick={() => edit((d) => ({
                  ...d,
                  requires: [...(d.requires ?? []), {
                    id: freshId('c', (d.requires ?? []).map((x) => x.id)), fact: 'program_enrolled', op: 'eq', value: true,
                    explain: 'You need to be enrolled in a program.', next_step: 'Ask the registrar to confirm your enrollment.',
                  }],
                }))}
              >
                Add a check
              </ActionButton>
            )}
          </div>

          <label style={label}>
            Office it hands off to <span style={quiet}>(needed when a step hands off)</span>
            <input
              className="input" maxLength={LIMITS.handoff_max} disabled={!canDraft || busy} value={def.handoff ?? ''}
              onChange={(e) => edit((d) => {
                const { handoff: _drop, ...rest } = d;
                return e.target.value === '' ? rest : { ...rest, handoff: e.target.value };
              })}
            />
          </label>
          <label style={label}>
            Note for the reviewer
            <input className="input" maxLength={500} disabled={!canDraft || busy} value={note} placeholder="What changed and why" onChange={(e) => setNote(e.target.value)} />
          </label>

          {wrong.length > 0 && <Notice alert>{wrong.map(problemText).join(' ')}</Notice>}
          {message && <Notice alert={/cannot|not |outside|already|could/i.test(message)}>{message}</Notice>}

          {canDraft ? (
            <div style={{ display: 'flex', gap: 'var(--sp-4)', flexWrap: 'wrap' }}>
              <button type="submit" className="btn btn-primary" disabled={busy || wrong.length > 0 || !dirty}>
                {draft ? 'Save draft' : 'Start a draft'}
              </button>
              {draft && (
                <ActionButton disabled={busy} onClick={() => void act(async () => {
                  await api.discardDraft(draft.id);
                  setDef(now ? structuredClone(now.definition) : null);
                  setNote('');
                  setBasedOn(now?.version ?? null);
                }, 'Draft discarded.')}
                >
                  Discard draft
                </ActionButton>
              )}
            </div>
          ) : (
            <p style={quiet}>Your account can read this workflow and cannot draft changes.</p>
          )}
        </form>
      )}

      {draft && holds.includes('workflow:publish') && (
        <div style={{ marginBlock: 'var(--sp-5)' }}>
          {dirty && <p style={quiet}>Save the draft first: a draft is published as it was reviewed.</p>}
          {blocker && <p style={quiet}>{blocker}</p>}
          <ActionButton tone="primary" disabled={busy || dirty || blocker !== null} onClick={() => void act(() => api.publish(draft), 'Published.')}>
            Publish as version {(now?.version ?? 0) + 1}
          </ActionButton>
        </div>
      )}

      {def !== null && problems(def).length === 0 && <Preview def={def} facts={facts} setFacts={setFacts} />}

      <History workflow={workflow} rows={rows} canDraft={canDraft && !draft} busy={busy} onRestore={(v) => {
        setDef(structuredClone(v.definition));
        setNote(`Back to version ${v.version}`);
        setBasedOn(v.version);
        setMessage(`Version ${v.version} is loaded above. Start a draft to keep it, and a colleague publishes it as the next version.`);
      }}
      />
    </section>
  );
}

// ── What a student would be told ────────────────────────────────────────────

function Preview({ def, facts, setFacts }: { def: Definition; facts: Facts; setFacts: (f: Facts) => void }) {
  const used = [...new Set((def.requires ?? []).map((r) => r.fact))];
  const result = evaluate(def, facts);
  return (
    <div style={{ marginBlock: 'var(--sp-5)' }}>
      <SectionLabel>What a student would be told</SectionLabel>
      <p style={quiet}>Set what is known about an imagined student. Nothing typed here is kept. A fact left as “not known” is never treated as met.</p>
      {used.length > 0 && (
        <div style={{ display: 'grid', gap: 'var(--sp-3)', marginBlock: 'var(--sp-3)' }}>
          {used.map((f) => {
            const spec = FACTS[f];
            const v = facts[f];
            return (
              <label key={f} style={inline}>
                {FACT_LABEL[f]}
                {spec.type === 'bool' ? (
                  <select
                    className="input" value={v === undefined ? 'unknown' : v ? 'yes' : 'no'}
                    onChange={(e) => {
                      const { [f]: _drop, ...rest } = facts;
                      setFacts(e.target.value === 'unknown' ? rest : { ...rest, [f]: e.target.value === 'yes' });
                    }}
                  >
                    <option value="unknown">Not known</option>
                    <option value="yes">Yes</option>
                    <option value="no">No</option>
                  </select>
                ) : (
                  <input
                    className="input" type="number" min={spec.min} max={spec.max} placeholder="Not known" value={typeof v === 'number' ? v : ''}
                    onChange={(e) => {
                      const { [f]: _drop, ...rest } = facts;
                      setFacts(e.target.value === '' ? rest : { ...rest, [f]: Number(e.target.value) });
                    }}
                  />
                )}
              </label>
            );
          })}
        </div>
      )}
      <p role="status" style={body}>{headline(result)}</p>
      <ul style={{ ...quiet, paddingLeft: 'var(--sp-5)' }}>
        {result.checks.filter((c) => c.status !== 'passed').map((c) => (
          <li key={c.id}>{c.explain} <strong>Next:</strong> {c.next_step}</li>
        ))}
      </ul>
      <ol style={{ ...quiet, paddingLeft: 'var(--sp-5)' }}>
        {walkthrough(def).map(({ step, who, note }) => (
          <li key={step.id}>
            {step.title} <span>({OWNER_LABEL[who as Owner]}{step.sla_days ? `, up to ${step.sla_days} days` : ''})</span>{note ? ` — ${note}` : ''}
          </li>
        ))}
      </ol>
    </div>
  );
}

// ── Versions ────────────────────────────────────────────────────────────────

function History({
  workflow, rows, canDraft, busy, onRestore,
}: {
  workflow: WorkflowKey;
  rows: WorkflowVersion[];
  canDraft: boolean;
  busy: boolean;
  onRestore: (v: WorkflowVersion) => void;
}) {
  const versions = history(rows, workflow);
  if (versions.length === 0) {
    return <EmptyState inline title="No versions yet" body="Published versions appear here, newest first, and stay for as long as the school does." />;
  }
  return (
    <div>
      <SectionLabel>Versions</SectionLabel>
      <ul style={{ listStyle: 'none', padding: 0 }}>
        {versions.map((v) => (
          <li key={v.id} style={{ borderTop: '1px solid var(--app-line)', paddingBlock: 'var(--sp-3)' }}>
            <span style={body}>Version {v.version}</span>{' '}
            <span style={quiet}>{v.published_at ? when(v.published_at) : ''}{v.note ? ` · ${v.note}` : ''}</span>
            <p style={quiet}>
              {v.definition.steps.length} steps · {(v.definition.requires ?? []).length} checks
              {v.definition.handoff ? ` · hands off to ${v.definition.handoff}` : ''}
            </p>
            {canDraft && <ActionButton disabled={busy} onClick={() => onRestore(v)}>Start from version {v.version}</ActionButton>}
          </li>
        ))}
      </ul>
    </div>
  );
}
