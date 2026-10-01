import { incomingCapture } from '../lib/productivity-arrival';
import { ProductivityBrowserCapture } from './ProductivityBrowserCapture';
import { ProductivitySourceCheck } from './ProductivitySourceCheck';
import { ProductivityCloud } from './ProductivityCloud';
import { ProductivityPreparation } from './ProductivityPreparation';
import { packetPiece } from '../lib/productivity-tools';
import { sendTo } from '../lib/deliver';
import { writable } from '../lib/connect';
import { GoTo } from './JourneyKit';
import '../styles/productivity.css';
import { useEffect, useState, type ReactNode } from 'react';
import { useStore } from '../state/store';
import { useDeviceLibrary } from '../lib/device-library';
import { download } from '../lib/deliver';
import { safeUrl } from '../lib/apply';
import { SectionLabel, Notice, FilePick } from './ui';
import {
  EMPTY_PRODUCTIVITY,
  FITS,
  IMPORTANCE,
  TRIAGE,
  TEMPLATES,
  advisorPacket,
  id,
  newDecision,
  newOption,
  readProductivity,
  readiness,
  supportedFit,
  withAssumption,
  currentEvidence,
  type Assumption,
  type Capture,
  type Decision,
  type Evidence,
} from '../lib/productivity';

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="productivity-field">
      <span>{label}</span>
      {children}
    </label>
  );
}
function Link({ url }: { url: string }) {
  const safe = /^https?:\/\//i.test(url) ? safeUrl(url) : '';
  return safe ? (
    <a href={safe} target="_blank" rel="noreferrer">
      View source / official route
    </a>
  ) : null;
}
const emptyCapture = (): Capture => ({
  id: id(),
  title: '',
  kind: 'Idea',
  source: '',
  reason: '',
  context: '',
  next: '',
  due: '',
  status: 'Saved for later',
  authorized: false,
});
export function ProductivityWorkspace() {
  const { account } = useStore();
  return (
    <Workspace key={account?.id || 'device'} who={account?.id || 'device'} />
  );
}
function Workspace({ who }: { who: string }) {
  const lib = useDeviceLibrary(
    `semester.productivity.v1:${who}`,
    readProductivity,
    EMPTY_PRODUCTIVITY,
  );
  const [tab, setTab] = useState(incomingCapture() ? 'Connections' : 'Decide');
  const [selected, setSelected] = useState('');
  const [capture, setCapture] = useState(emptyCapture);
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState('All');
  const [template, setTemplate] = useState('Advisor agenda');
  const [notice, setNotice] = useState('');
  const [preview, setPreview] = useState('');
  const [pending, setPending] = useState<Assumption | null>(null);
  const [until, setUntil] = useState<number | null>(null);
  const [seconds, setSeconds] = useState(25 * 60);
  const [focusGoal, setFocusGoal] = useState('');
  const d = lib.value.decisions.find((x) => x.id === selected);
  const save = (change: Parameters<typeof lib.update>[0]) => {
    const ok = lib.update(change);
    setNotice(
      ok
        ? 'Saved privately on this device.'
        : 'Could not save. Export a recovery copy if storage is damaged.',
    );
    return ok;
  };
  const patch = (change: Partial<Decision>) =>
    d &&
    save((old) => ({
      ...old,
      decisions: old.decisions.map((x) =>
        x.id === d.id ? { ...x, ...change } : x,
      ),
    }));
  useEffect(() => {
    if (until === null) return;
    const tick = () => {
      const left = Math.max(0, Math.ceil((until - Date.now()) / 1000));
      setSeconds(left);
      if (!left) {
        setUntil(null);
        setNotice(
          'Focus session finished. Record progress or choose your next step.',
        );
      }
    };
    tick();
    const timer = setInterval(tick, 1000);
    return () => clearInterval(timer);
  }, [until]);
  const exportText = (name: string, body: string) =>
    download({ name, body, mime: 'text/plain' });
  const draft = () => {
    const body =
      TEMPLATES[template] +
      (d ? `\n\nDecision context:\n${advisorPacket(d)}` : '');
    save((old) => ({
      ...old,
      drafts: [
        ...old.drafts,
        { id: id(), title: template, body, status: 'Prepared' },
      ],
    }));
  };
  const journal = () =>
    d &&
    save((old) => ({
      ...old,
      journal: [
        ...old.journal,
        {
          id: id(),
          at: new Date().toISOString(),
          decision: structuredClone(d),
        },
      ],
    }));
  const assumptionInput = pending && (
    <div className="productivity-card">
      <SectionLabel>Preview assumption change</SectionLabel>
      <p>
        Before:{' '}
        {d?.assumptions.find((a) => a.id === pending.id)?.value ||
          'No assumption'}
      </p>
      <p>After: {pending.value}</p>
      <p>
        Review these linked impacts:{' '}
        {pending.impacts ||
          'All recorded fit evidence will need a source check after this change.'}
      </p>
      <button
        type="button"
        onClick={() => {
          if (d) patch(withAssumption(d, pending));
          setPending(null);
        }}
      >
        Save to this scenario
      </button>
      <button
        type="button"
        disabled={pending.owner === 'institution'}
        onClick={() => {
          save((old) => ({
            ...old,
            preferences: [
              ...old.preferences.filter((a) => a.label !== pending.label),
              { ...pending, owner: 'student' },
            ],
          }));
          setPending(null);
        }}
      >
        Save as preference
      </button>
      <button type="button" onClick={() => setPending(null)}>
        Undo preview
      </button>
    </div>
  );
  return (
    <div className="productivity-workspace">
      <p>
        Capture, compare, prepare and reflect. Your work is private on this
        device. Use Backup to review and save a cloud copy across devices.
        Planning here submits nothing to your institution.
      </p>
      <nav aria-label="Productivity workspace">
        {[
          'Decide',
          'Capture',
          'Inbox',
          'Prepare',
          'Knowledge',
          'Focus',
          'Reset',
          'Backup',
          'Connections',
        ].map((t) => (
          <button
            type="button"
            key={t}
            aria-pressed={tab === t}
            onClick={() => setTab(t)}
          >
            {t}
          </button>
        ))}
      </nav>
      {(lib.error || notice) && <Notice>{lib.error || notice}</Notice>}
      {tab === 'Decide' && (
        <>
          <SectionLabel>Decision workspace</SectionLabel>
          <button
            type="button"
            onClick={() => {
              const next = newDecision('New decision');
              if (
                save((old) => ({ ...old, decisions: [...old.decisions, next] }))
              )
                setSelected(next.id);
            }}
          >
            New decision
          </button>
          <Field label="Saved decisions">
            <select
              aria-label="Saved decisions"
              className="input"
              value={selected}
              onChange={(e) => setSelected(e.target.value)}
            >
              <option value="">Choose a decision</option>
              {lib.value.decisions.map((x) => (
                <option key={x.id} value={x.id}>
                  {x.title}
                </option>
              ))}
            </select>
          </Field>
          {!d && (
            <p>
              Compare courses, majors, opportunities, housing, support resources
              or recovery plans. Start with your goal and up to three options.
            </p>
          )}
          {d && (
            <>
              <Field label="Decision">
                <input
                  aria-label="Decision"
                  className="input"
                  value={d.title}
                  onChange={(e) => patch({ title: e.target.value })}
                />
              </Field>
              <Field label="Goal">
                <textarea
                  aria-label="Goal"
                  className="input"
                  value={d.goal}
                  onChange={(e) => patch({ goal: e.target.value })}
                />
              </Field>
              <SectionLabel>What matters to you</SectionLabel>
              {d.criteria.map((c) => (
                <Field key={c.id} label={c.label}>
                  <select
                    aria-label={c.label}
                    className="input"
                    value={c.weight}
                    onChange={(e) =>
                      patch({
                        criteria: d.criteria.map((x) =>
                          x.id === c.id
                            ? { ...x, weight: Number(e.target.value) }
                            : x,
                        ),
                      })
                    }
                  >
                    {IMPORTANCE.map((label, n) => (
                      <option key={label} value={n}>
                        {label}
                      </option>
                    ))}
                  </select>
                </Field>
              ))}
              <button
                type="button"
                onClick={() =>
                  patch({
                    criteria: [
                      ...d.criteria,
                      { id: id(), label: 'Personal constraint', weight: 2 },
                    ],
                  })
                }
              >
                Add criterion
              </button>
              {d.criteria.map((c) => (
                <Field key={c.id} label="Name your criterion">
                  <input
                    aria-label="Name your criterion"
                    className="input"
                    value={c.label}
                    onChange={(e) =>
                      patch({
                        criteria: d.criteria.map((x) =>
                          x.id === c.id ? { ...x, label: e.target.value } : x,
                        ),
                      })
                    }
                  />
                </Field>
              ))}
              <SectionLabel>Options and tradeoffs</SectionLabel>
              <p>
                Importance maps to 0–3. Strong fit = 1, moderate = 0.5, weak =
                0. Unknown evidence is excluded, never counted as poor fit.
                Coverage shows how much of your selected criteria is known.
                Values are planning aids; they do not establish eligibility or
                availability.
              </p>
              <button
                type="button"
                disabled={d.options.length >= 3}
                onClick={() =>
                  patch({
                    options: [
                      ...d.options,
                      newOption(`Option ${d.options.length + 1}`),
                    ],
                  })
                }
              >
                Add option ({d.options.length}/3)
              </button>
              <div className="productivity-options">
                {d.options.map((o) => {
                  const result = supportedFit(o, d.criteria);
                  const optionPatch = (change: Partial<typeof o>) =>
                    patch({
                      options: d.options.map((x) =>
                        x.id === o.id ? { ...x, ...change } : x,
                      ),
                    });
                  return (
                    <article className="productivity-card" key={o.id}>
                      <Field label="Option title">
                        <input
                          aria-label="Option title"
                          className="input"
                          value={o.title}
                          onChange={(e) =>
                            optionPatch({ title: e.target.value })
                          }
                        />
                      </Field>
                      <p>
                        Supported fit:{' '}
                        {result.fit === null
                          ? 'Needs review'
                          : `${Math.round(result.fit * 100)}%`}
                        . Evidence coverage: {Math.round(result.coverage * 100)}
                        %. {result.unknown} criteria need review.
                      </p>
                      {d.criteria
                        .filter((c) => c.weight > 0)
                        .map((c) => {
                          const evidence = o.fits[c.id] || {
                            fit: 'unknown',
                            explanation: '',
                            source: '',
                            checked: '',
                          };
                          const edit = (p: Partial<Evidence>) =>
                            optionPatch({
                              fits: {
                                ...o.fits,
                                [c.id]: { ...evidence, ...p },
                              },
                            });
                          return (
                            <fieldset key={c.id}>
                              <legend>{c.label}</legend>
                              <p>
                                {currentEvidence(evidence)
                                  ? 'Source checked within 30 days'
                                  : 'Missing, outdated or uncertain evidence: needs review'}
                              </p>
                              <Field label="Fit">
                                <select
                                  aria-label="Fit"
                                  className="input"
                                  value={evidence.fit}
                                  onChange={(e) =>
                                    edit({
                                      fit: e.target.value as Evidence['fit'],
                                    })
                                  }
                                >
                                  {FITS.map((f) => (
                                    <option key={f}>{f}</option>
                                  ))}
                                </select>
                              </Field>
                              <Field label="Evidence / explanation">
                                <textarea
                                  aria-label="Evidence / explanation"
                                  className="input"
                                  value={evidence.explanation}
                                  onChange={(e) =>
                                    edit({ explanation: e.target.value })
                                  }
                                />
                              </Field>
                              <Field label="Source URL or owner">
                                <input
                                  aria-label="Source URL or owner"
                                  className="input"
                                  value={evidence.source}
                                  onChange={(e) =>
                                    edit({ source: e.target.value })
                                  }
                                />
                              </Field>
                              <Link url={evidence.source} />
                              <Field label="Last checked">
                                <input
                                  aria-label="Last checked"
                                  className="input"
                                  type="date"
                                  value={evidence.checked}
                                  onChange={(e) =>
                                    edit({ checked: e.target.value })
                                  }
                                />
                              </Field>
                            </fieldset>
                          );
                        })}
                      <Field label="Official route / owner">
                        <input
                          aria-label="Official route / owner"
                          className="input"
                          value={o.official}
                          onChange={(e) =>
                            optionPatch({ official: e.target.value })
                          }
                        />
                      </Field>
                      <Link url={o.official} />
                      <button
                        type="button"
                        onClick={() =>
                          patch({
                            options: d.options.filter((x) => x.id !== o.id),
                          })
                        }
                      >
                        Remove option
                      </button>
                    </article>
                  );
                })}
              </div>
              <SectionLabel>Assumptions</SectionLabel>
              <p>
                Institution-owned facts are read-only. If a source may be wrong,
                flag it for review and contact its owner. Changes preview their
                recorded impact links before saving.
              </p>
              {d.assumptions.map((a) => (
                <article className="productivity-card" key={a.id}>
                  <strong>{a.label}</strong>
                  <p>
                    {a.value} · {a.owner} ·{' '}
                    {a.review ? 'Needs review' : 'Recorded'}
                  </p>
                  <p>{a.source || 'Source not recorded'}</p>
                  <Link url={a.source} />
                  <p>Impacts: {a.impacts || 'Not recorded'}</p>
                  <button
                    type="button"
                    disabled={a.owner === 'institution'}
                    onClick={() => setPending({ ...a })}
                  >
                    Edit assumption
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      patch({
                        assumptions: d.assumptions.map((x) =>
                          x.id === a.id ? { ...x, review: !x.review } : x,
                        ),
                      })
                    }
                  >
                    Toggle review flag
                  </button>
                  <button
                    type="button"
                    disabled={a.owner === 'institution'}
                    onClick={() =>
                      patch({
                        assumptions: d.assumptions.filter((x) => x.id !== a.id),
                      })
                    }
                  >
                    Remove assumption
                  </button>
                </article>
              ))}
              <button
                type="button"
                onClick={() =>
                  setPending({
                    id: id(),
                    label: '',
                    value: '',
                    owner: 'student',
                    source: '',
                    impacts: '',
                    review: false,
                  })
                }
              >
                Add assumption / constraint
              </button>
              <button
                type="button"
                onClick={() =>
                  patch({
                    assumptions: [
                      ...d.assumptions.filter((a) => a.owner === 'institution'),
                      ...lib.value.preferences.map((a) => ({ ...a, id: id() })),
                    ],
                  })
                }
              >
                Reset to saved preferences
              </button>
              {pending && (
                <>
                  <Field label="Assumption name">
                    <input
                      aria-label="Assumption name"
                      className="input"
                      value={pending.label}
                      onChange={(e) =>
                        setPending({ ...pending, label: e.target.value })
                      }
                    />
                  </Field>
                  <Field label="Value">
                    <input
                      aria-label="Value"
                      className="input"
                      value={pending.value}
                      onChange={(e) =>
                        setPending({ ...pending, value: e.target.value })
                      }
                    />
                  </Field>
                  <Field label="Ownership">
                    <select
                      aria-label="Ownership"
                      className="input"
                      value={pending.owner}
                      onChange={(e) =>
                        setPending({
                          ...pending,
                          owner: e.target.value as Assumption['owner'],
                        })
                      }
                    >
                      {['student', 'estimate', 'AI', 'scenario'].map((x) => (
                        <option key={x}>{x}</option>
                      ))}
                    </select>
                  </Field>
                  <Field label="Source">
                    <input
                      aria-label="Source"
                      className="input"
                      value={pending.source}
                      onChange={(e) =>
                        setPending({ ...pending, source: e.target.value })
                      }
                    />
                  </Field>
                  <Field label="Affected options / plans">
                    <input
                      aria-label="Affected options / plans"
                      className="input"
                      value={pending.impacts}
                      onChange={(e) =>
                        setPending({ ...pending, impacts: e.target.value })
                      }
                    />
                  </Field>
                  {assumptionInput}
                </>
              )}
              <Field label="Known unknowns / questions for official owner">
                <textarea
                  aria-label="Known unknowns / questions for official owner"
                  className="input"
                  value={d.questions}
                  onChange={(e) => patch({ questions: e.target.value })}
                />
              </Field>
              <Field label="Decision window / revisit on">
                <input
                  aria-label="Decision window / revisit on"
                  className="input"
                  type="date"
                  value={d.revisit}
                  onChange={(e) => patch({ revisit: e.target.value })}
                />
              </Field>
              <SectionLabel>
                Decision readiness: {readiness(d).state}
              </SectionLabel>
              <ul>
                {readiness(d).checks.map((c) => (
                  <li key={c.label}>
                    {c.done ? 'Complete' : 'Needs review'}: {c.label}
                  </li>
                ))}
              </ul>
              {d.options.length < 2 && (
                <p>
                  You have compared fewer than two options. Consider an
                  alternative or backup.
                </p>
              )}
              <Field label="Private reflection">
                <textarea
                  aria-label="Private reflection"
                  className="input"
                  value={d.reflection}
                  onChange={(e) => patch({ reflection: e.target.value })}
                />
              </Field>
              <button type="button" onClick={journal}>
                Save scenario snapshot
              </button>
              <button
                type="button"
                onClick={() => {
                  if (journal()) patch({ decided: true });
                }}
              >
                Record my decision
              </button>
              <button
                type="button"
                onClick={() => patch({ paused: !d.paused })}
              >
                {d.paused ? 'Resume' : 'Pause'}
              </button>
              <button
                type="button"
                onClick={() => setPreview(advisorPacket(d))}
              >
                Preview advisor packet
              </button>
              <button
                type="button"
                onClick={() => {
                  save((old) => ({
                    ...old,
                    decisions: old.decisions.filter((x) => x.id !== d.id),
                  }));
                  setSelected('');
                }}
              >
                Delete decision
              </button>
            </>
          )}
          <SectionLabel>Private scenario history</SectionLabel>
          {lib.value.journal.map((s) => (
            <article className="productivity-card" key={s.id}>
              <strong>{s.decision.title}</strong>
              <p>{s.at}</p>
              <button
                type="button"
                onClick={() => setPreview(advisorPacket(s.decision))}
              >
                View snapshot
              </button>
              <button
                type="button"
                onClick={() => {
                  const copy = {
                    ...structuredClone(s.decision),
                    id: id(),
                    decided: false,
                  };
                  if (
                    save((old) => ({
                      ...old,
                      decisions: [...old.decisions, copy],
                    }))
                  )
                    setSelected(copy.id);
                }}
              >
                Revisit as new scenario
              </button>
              <button
                type="button"
                onClick={() =>
                  save((old) => ({
                    ...old,
                    journal: old.journal.filter((x) => x.id !== s.id),
                  }))
                }
              >
                Delete snapshot
              </button>
            </article>
          ))}
        </>
      )}
      {tab === 'Capture' && (
        <>
          <SectionLabel>Capture for later</SectionLabel>
          {(
            ['title', 'source', 'reason', 'context', 'next', 'due'] as const
          ).map((key) => (
            <Field
              key={key}
              label={
                {
                  title: 'What is this?',
                  source: 'Where did it come from?',
                  reason: 'Why did I save it?',
                  context: 'Related course / goal',
                  next: 'Suggested next action',
                  due: 'Due date, if known',
                }[key]
              }
            >
              <input
                aria-label={key}
                className="input"
                type={key === 'due' ? 'date' : 'text'}
                value={capture[key]}
                onChange={(e) =>
                  setCapture({ ...capture, [key]: e.target.value })
                }
              />
            </Field>
          ))}
          <Field label="Type">
            <select
              aria-label="Type"
              className="input"
              value={capture.kind}
              onChange={(e) => setCapture({ ...capture, kind: e.target.value })}
            >
              {[
                'Course',
                'Web link',
                'Source excerpt',
                'Assignment',
                'Office/service',
                'Opportunity',
                'Question',
                'File reference',
                'Event',
                'Idea',
                'Email draft',
                'Meeting follow-up',
              ].map((x) => (
                <option key={x}>{x}</option>
              ))}
            </select>
          </Field>
          <p>
            Private. A file reference saves context; upload documents through
            Semester Files.
          </p>
          <button
            type="button"
            disabled={!capture.title.trim()}
            onClick={() => {
              if (
                save((old) => ({
                  ...old,
                  captures: [...old.captures, capture],
                }))
              ) {
                setCapture(emptyCapture());
                setTab('Inbox');
              }
            }}
          >
            Save to academic inbox
          </button>
        </>
      )}
      {(tab === 'Inbox' || tab === 'Knowledge') && (
        <>
          <SectionLabel>
            {tab === 'Knowledge' ? 'My knowledge' : 'Academic inbox and triage'}
          </SectionLabel>
          <Field label="Search your saved context">
            <input
              aria-label="Search your saved context"
              className="input"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </Field>
          <Field label="Status">
            <select
              aria-label="Status"
              className="input"
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
            >
              {['All', ...TRIAGE].map((x) => (
                <option key={x}>{x}</option>
              ))}
            </select>
          </Field>
          <p>
            Search is local text search. Only items you explicitly authorize may
            be included in a prepared source summary.
          </p>
          {lib.value.captures
            .filter(
              (c) =>
                (filter === 'All' || filter === c.status) &&
                JSON.stringify(c).toLowerCase().includes(query.toLowerCase()),
            )
            .map((c) => (
              <article className="productivity-card" key={c.id}>
                <strong>{c.title}</strong>
                <p>
                  {c.kind} · {c.context} · {c.due || 'No deadline'}
                </p>
                <p>{c.reason}</p>
                <p>Next: {c.next || 'Choose a next action'}</p>
                <p>Source: {c.source || 'Not recorded'}</p>
                <Link url={c.source} />
                <Field label="Triage">
                  <select
                    aria-label="Triage"
                    className="input"
                    value={c.status}
                    onChange={(e) =>
                      save((old) => ({
                        ...old,
                        captures: old.captures.map((x) =>
                          x.id === c.id
                            ? {
                                ...x,
                                status: e.target.value as Capture['status'],
                              }
                            : x,
                        ),
                      }))
                    }
                  >
                    {TRIAGE.map((x) => (
                      <option key={x}>{x}</option>
                    ))}
                  </select>
                </Field>
                <label>
                  <input
                    type="checkbox"
                    checked={c.authorized}
                    onChange={(e) =>
                      save((old) => ({
                        ...old,
                        captures: old.captures.map((x) =>
                          x.id === c.id
                            ? { ...x, authorized: e.target.checked }
                            : x,
                        ),
                      }))
                    }
                  />{' '}
                  Include in my source summaries
                </label>
                <button
                  type="button"
                  onClick={() =>
                    save((old) => ({
                      ...old,
                      captures: old.captures.filter((x) => x.id !== c.id),
                    }))
                  }
                >
                  Delete
                </button>
              </article>
            ))}
          <button
            type="button"
            onClick={() =>
              setPreview(
                lib.value.captures
                  .filter((c) => c.authorized)
                  .map(
                    (c) =>
                      `${c.title}\n${c.reason}\nSource: ${c.source}\nNext: ${c.next}`,
                  )
                  .join('\n\n') ||
                  'No items authorized. Choose individual items first.',
              )
            }
          >
            Preview authorized source summary
          </button>
        </>
      )}
      {tab === 'Prepare' && (
        <>
          <SectionLabel>Templates and delegation queue</SectionLabel>
          <nav aria-label="Connected preparation tools">
            <GoTo screen="calendar">Save work time</GoTo>
            <GoTo screen="connect">Calendar and document connections</GoTo>
            <GoTo screen="support">Find official support</GoTo>
            <GoTo screen="opportunities">Explore explicit interests</GoTo>
          </nav>
          <p>
            Prepared drafts use editable templates and your selected decision
            context. Review before exporting or sharing. No message is sent
            automatically.
          </p>
          <Field label="Prepare a draft">
            <select
              aria-label="Prepare a draft"
              className="input"
              value={template}
              onChange={(e) => setTemplate(e.target.value)}
            >
              {Object.keys(TEMPLATES).map((x) => (
                <option key={x}>{x}</option>
              ))}
            </select>
          </Field>
          <button type="button" onClick={draft}>
            Prepare for me
          </button>
          {lib.value.drafts.map((x) => (
            <article className="productivity-card" key={x.id}>
              <strong>
                {x.title} · {x.status}
              </strong>
              <Field label="Editable draft">
                <textarea
                  aria-label="Editable draft"
                  className="input"
                  rows={12}
                  value={x.body}
                  onChange={(e) =>
                    save((old) => ({
                      ...old,
                      drafts: old.drafts.map((r) =>
                        r.id === x.id ? { ...r, body: e.target.value } : r,
                      ),
                    }))
                  }
                />
              </Field>
              <button
                type="button"
                onClick={() =>
                  save((old) => ({
                    ...old,
                    drafts: old.drafts.map((r) =>
                      r.id === x.id ? { ...r, status: 'Saved' } : r,
                    ),
                  }))
                }
              >
                Save draft
              </button>
              <button type="button" onClick={() => setPreview(x.body)}>
                Preview export
              </button>
              <button
                type="button"
                onClick={() =>
                  save((old) => ({
                    ...old,
                    drafts: old.drafts.filter((r) => r.id !== x.id),
                  }))
                }
              >
                Discard
              </button>
            </article>
          ))}
        </>
      )}
      {tab === 'Focus' && (
        <>
          <SectionLabel>Focus on one next step</SectionLabel>
          <Field label="Course, action and session goal">
            <textarea
              aria-label="Course, action and session goal"
              className="input"
              value={focusGoal}
              onChange={(e) => setFocusGoal(e.target.value)}
            />
          </Field>
          <p role="timer">
            {Math.floor(seconds / 60)}:{String(seconds % 60).padStart(2, '0')}
          </p>
          <button
            type="button"
            disabled={!focusGoal.trim() || until !== null}
            onClick={() => setUntil(Date.now() + seconds * 1000)}
          >
            Start focus session
          </button>
          <button type="button" onClick={() => setUntil(null)}>
            Pause / continue later
          </button>
          <button
            type="button"
            onClick={() => {
              setUntil(null);
              setSeconds(25 * 60);
            }}
          >
            Reset to 25 minutes
          </button>
          <button
            type="button"
            disabled={!focusGoal.trim()}
            onClick={() => {
              const c = {
                ...emptyCapture(),
                title: focusGoal,
                kind: 'Focus progress',
                next: 'Record progress or ask for help',
              };
              save((old) => ({ ...old, captures: [...old.captures, c] }));
            }}
          >
            Record progress / need help
          </button>
          <p>
            The timer runs only while this workspace is open. Record progress
            before leaving.
          </p>
        </>
      )}
      {tab === 'Reset' && (
        <>
          <SectionLabel>Weekly reset: one question at a time</SectionLabel>
          <p>What is one thing you want to move forward this week?</p>
          <button type="button" onClick={() => setTab('Capture')}>
            Capture a next action
          </button>
          <button type="button" onClick={() => setTab('Inbox')}>
            Sort saved context
          </button>
          <button type="button" onClick={() => setTab('Decide')}>
            Compare options
          </button>
          <button type="button" onClick={() => setTab('Prepare')}>
            Prepare a meeting or study plan
          </button>
          <SectionLabel>Friction to resolve</SectionLabel>
          {lib.value.decisions
            .filter((x) => readiness(x).state !== 'Decided and saved')
            .map((x) => (
              <p key={x.id}>
                <button
                  type="button"
                  onClick={() => {
                    setSelected(x.id);
                    setTab('Decide');
                  }}
                >
                  {x.title}: {readiness(x).state}
                  {x.revisit ? ` · revisit ${x.revisit}` : ''}
                </button>
              </p>
            ))}
          {lib.value.captures
            .filter(
              (c) =>
                c.status === 'Needs action' ||
                c.status === 'Waiting on someone',
            )
            .map((c) => (
              <p key={c.id}>
                {c.title}: {c.next || 'Choose next action'}
              </p>
            ))}
        </>
      )}
      {tab === 'Connections' && (
        <>
          <ProductivityPreparation value={lib.value} decision={d} save={save} />
          <ProductivitySourceCheck />
          <ProductivityBrowserCapture save={save} />
        </>
      )}
      {tab === 'Backup' && (
        <>
          <SectionLabel>Export and deletion controls</SectionLabel>
          <ProductivityCloud who={who} value={lib.value} replace={save} />
          <button
            type="button"
            onClick={() =>
              download({
                name: 'semester-productivity.json',
                body: JSON.stringify(lib.value, null, 2),
                mime: 'application/json',
              })
            }
          >
            Export private backup
          </button>
          <Field label="Restore backup (merges by ID; existing items are preserved)">
            <FilePick
              accept=".json,application/json"
              onPick={async (files) => {
                const file = files[0];
                if (!file) return;
                try {
                  if (file.size > 3_000_000)
                    throw new Error('Backup exceeds workspace limit');
                  const incoming = readProductivity(
                    JSON.parse(await file.text()),
                  );
                  save((old) => {
                    const merge = <T extends { id: string }>(
                      a: T[],
                      b: T[],
                    ) => [
                      ...a,
                      ...b.filter((x) => !a.some((y) => y.id === x.id)),
                    ];
                    return {
                      ...old,
                      decisions: merge(old.decisions, incoming.decisions),
                      captures: merge(old.captures, incoming.captures),
                      drafts: merge(old.drafts, incoming.drafts),
                      journal: merge(old.journal, incoming.journal),
                      preferences: merge(old.preferences, incoming.preferences),
                    };
                  });
                } catch {
                  setNotice(
                    'Backup is invalid or too large. Existing data was preserved.',
                  );
                }
              }}
            >
              Restore private backup
            </FilePick>
          </Field>
          {lib.error && (
            <button
              type="button"
              onClick={() =>
                exportText('productivity-recovery.txt', lib.recovery())
              }
            >
              Export recovery copy
            </button>
          )}
          <p>
            Use each item’s Delete control to remove saved work. Cloud deletion
            keeps your device copy. Institution counts require explicit consent
            and an authorized administrator.
          </p>
        </>
      )}
      {preview && (
        <section className="productivity-card" aria-label="Export preview">
          <SectionLabel>Review before export</SectionLabel>
          <textarea
            aria-label="Reviewed export content"
            className="input"
            rows={16}
            value={preview}
            onChange={(e) => setPreview(e.target.value)}
          />
          <p>
            This packet includes only the displayed content. Private reflections
            and journal history are excluded unless you add them.
          </p>
          <button
            type="button"
            onClick={() => exportText('semester-prepared-packet.txt', preview)}
          >
            Export reviewed packet
          </button>
          {(['pdf', 'docx'] as const).map((format) => (
            <button
              type="button"
              key={format}
              onClick={() =>
                void packetPiece(preview, format)
                  .then(download)
                  .catch((e) => setNotice(e.message))
              }
            >
              Export reviewed {format.toUpperCase()}
            </button>
          ))}
          {writable().map((provider) => (
            <button
              type="button"
              key={provider}
              onClick={() =>
                void packetPiece(preview, 'docx')
                  .then((piece) => sendTo(provider, piece))
                  .then(() =>
                    setNotice(`Reviewed packet saved to ${provider}.`),
                  )
                  .catch((e) => setNotice(e.message))
              }
            >
              Save reviewed DOCX to {provider}
            </button>
          ))}
          <button type="button" onClick={() => setPreview('')}>
            Close preview
          </button>
        </section>
      )}
    </div>
  );
}
