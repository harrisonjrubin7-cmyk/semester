/**
 * The academic-record ledger, for a school's registrar staff, on the tables
 * in `20260929210000_academic_record_ledger.sql`.
 *
 * A student's record is found by the school's own identifier and shown as it
 * stood on any date. Each line opens its whole history, and each entry in it
 * answers the brief's eight questions: who, what, why, who approved, when
 * effective, the previous value, the source, and that correcting it keeps the
 * history. Nobody edits a line: a change is proposed with a reason, and the
 * database writes the entry only when someone else approves it — which is why
 * the queue shows an approver their own proposals without an Approve button,
 * and marks the ones that would be a registrar override before anyone presses.
 *
 * The export is the record on a date, headed "Not an official transcript",
 * because issuing one is not something this screen does.
 */
import { useCallback, useEffect, useState } from 'react';
import { cloud } from '../../lib/cloud';
import { download } from '../../lib/deliver';
import { secondLine } from '../../lib/dim';
import { formatDateTime } from '../../lib/locale';
import { recordApi, type RecordApi } from '../../lib/record/api';
import {
  ACTIONS, KINDS, KIND_LABEL, KEY_HINT, SOURCES, SOURCE_LABEL, STUDENT_REF,
  asOf, explain, history, isOverride, proposalProblems,
  toCsv, type LedgerEntry, type Proposal, type RecordAction, type RecordChange, type RecordKind, type RecordSource,
} from '../../lib/record/ledger';
import { ActionButton, EmptyState, Notice, SectionLabel } from '../ui';

export interface RecordLedgerProps {
  tenantId: string;
  viewerId: string | null;
  /** Holds `record:propose`. */
  propose: boolean;
  /** Holds `record:approve`. */
  decide: boolean;
  /** Holds `record:override`. */
  override: boolean;
  /** Holds `record:read` or `record:approve`: may read the ledger itself. */
  read: boolean;
  /** Injected in tests; defaults to Supabase under the viewer's RLS. */
  api?: RecordApi;
  /** Injected in tests; today, as YYYY-MM-DD. */
  today?: string;
}

const quiet = { fontSize: 'var(--type-sm)', ...secondLine(), lineHeight: 'var(--leading-normal)' } as const;
const body = { fontSize: 'var(--type-base)', lineHeight: 'var(--leading-relaxed)' } as const;
const grid = { display: 'grid', gap: 'var(--sp-4)', marginBlock: 'var(--sp-4)' } as const;
const label = { display: 'grid', gap: 'var(--sp-2)', fontSize: 'var(--type-sm)' } as const;
const h3 = { ...body, fontWeight: 600, marginTop: 'var(--sp-5)' } as const;
const cell = { textAlign: 'left', padding: 'var(--sp-2)', borderTop: '1px solid var(--app-line)', fontSize: 'var(--type-sm)', verticalAlign: 'top' } as const;
const errorText = (e: unknown, fallback: string) => (e instanceof Error ? e.message : fallback);
const localToday = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

export function RecordLedger({ tenantId, viewerId, propose, decide, override, read, api, today }: RecordLedgerProps) {
  const [client, setClient] = useState<RecordApi | null>(api ?? null);
  const [message, setMessage] = useState('');
  const [ref, setRef] = useState('');
  const [open, setOpen] = useState<string | null>(null);
  const [pending, setPending] = useState<RecordChange[]>([]);
  const day = today ?? localToday();

  useEffect(() => {
    if (api) return;
    let live = true;
    void cloud().then((db) => {
      if (live) setClient(recordApi(db));
    }, () => {
      if (live) setMessage('The academic record needs a connection to your school’s Semester project.');
    });
    return () => {
      live = false;
    };
  }, [api]);

  const loadPending = useCallback(() => {
    if (!client || !(decide || read)) return Promise.resolve();
    return client.pending(tenantId).then(setPending);
  }, [client, decide, read, tenantId]);

  useEffect(() => {
    if (!client || !(decide || read)) return;
    let live = true;
    client.pending(tenantId).then((p) => {
      if (live) setPending(p);
    }, (e: unknown) => {
      if (live) setMessage(errorText(e, 'Could not load the changes waiting for a decision.'));
    });
    return () => {
      live = false;
    };
  }, [client, decide, read, tenantId]);

  if (!client) return message ? <Notice alert>{message}</Notice> : <p role="status" style={body}>Loading…</p>;

  const name = (id: string | null) => (id === null ? 'A person whose account has since been deleted' : id === viewerId ? 'You' : 'Another staff member');

  return (
    <section aria-label="Academic record">
      <SectionLabel>Academic record</SectionLabel>
      <p style={{ ...quiet, marginBottom: 'var(--sp-4)' }}>
        Your school’s record of enrollment, grades, credits, requirements, transfer credit, standing and degrees. Nothing
        here is edited: a change is proposed with a reason, and it enters the record when someone other than its proposer
        approves it. Correcting a posted grade, standing or degree is a registrar override. This is the record your
        school keeps, not an official transcript.
      </p>
      {message && <Notice alert>{message}</Notice>}

      <form
        aria-label="Find a student’s record"
        style={grid}
        onSubmit={(e) => {
          e.preventDefault();
          if (STUDENT_REF.test(ref.trim())) setOpen(ref.trim());
        }}
      >
        <label style={label}>
          Student identifier, as your student information system has it
          <input className="input" value={ref} placeholder="S0012345" onChange={(e) => setRef(e.target.value)} />
        </label>
        <button type="submit" className="btn btn-secondary btn-block" disabled={!STUDENT_REF.test(ref.trim())}>
          Open the record
        </button>
      </form>

      {open && (
        <StudentRecord
          key={open}
          tenantId={tenantId}
          studentRef={open}
          api={client}
          day={day}
          name={name}
          viewerId={viewerId}
          propose={propose}
          read={read}
          onProposed={() => void loadPending().catch(() => undefined)}
        />
      )}

      {(decide || read) && (
        <Queue
          changes={pending}
          viewerId={viewerId}
          decide={decide}
          override={override}
          api={client}
          onDecided={() => void loadPending().catch(() => undefined)}
        />
      )}
    </section>
  );
}

// ── One student's record ────────────────────────────────────────────────────

function StudentRecord({
  tenantId, studentRef, api, day, name, viewerId, propose, read, onProposed,
}: {
  tenantId: string;
  studentRef: string;
  api: RecordApi;
  day: string;
  name: (id: string | null) => string;
  viewerId: string | null;
  propose: boolean;
  read: boolean;
  onProposed: () => void;
}) {
  const [entries, setEntries] = useState<LedgerEntry[]>([]);
  const [changes, setChanges] = useState<RecordChange[]>([]);
  const [state, setState] = useState<'loading' | 'ready' | 'error'>('loading');
  const [note, setNote] = useState('');
  const [on, setOn] = useState(day);
  const [line, setLine] = useState<string | null>(null);

  const fetch = useCallback(() => api.lookup(tenantId, studentRef), [api, tenantId, studentRef]);
  const reload = () =>
    fetch().then((r) => {
      setEntries(r.entries);
      setChanges(r.changes);
    });

  useEffect(() => {
    let live = true;
    fetch().then((r) => {
      if (!live) return;
      setEntries(r.entries);
      setChanges(r.changes);
      setState('ready');
    }, (e: unknown) => {
      if (!live) return;
      setNote(errorText(e, 'Could not load the record.'));
      setState('error');
    });
    return () => {
      live = false;
    };
  }, [fetch]);

  if (state === 'loading') return <p role="status" style={body}>Loading the record…</p>;
  if (state === 'error') return <Notice alert>{note}</Notice>;

  const lines = asOf(entries, on);
  const mine = changes.filter((c) => c.status === 'proposed' && c.proposed_by === viewerId);
  const picked = line ? lines.find((l) => `${l.kind}:${l.subject_key}` === line) ?? null : null;

  return (
    <section aria-label={`Record of ${studentRef}`}>
      <h3 style={h3}>Record of {studentRef}</h3>
      {!read ? (
        <p style={quiet}>Your account proposes changes to this record; it does not read the record itself.</p>
      ) : (
        <>
          <label style={{ ...label, marginBlock: 'var(--sp-3)' }}>
            As it stood on
            <input className="input" type="date" value={on} onChange={(e) => e.target.value && setOn(e.target.value)} />
          </label>
          {lines.length === 0 ? (
            <EmptyState inline title="Nothing on the record on this date" body="No entry for this student was in effect then." />
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse' }} aria-label={`Record of ${studentRef} as of ${on}`}>
              <thead>
                <tr>
                  <th style={cell}>Kind</th>
                  <th style={cell}>About</th>
                  <th style={cell}>Value</th>
                  <th style={cell}>Effective</th>
                  <th style={cell}><span className="sr-only">History</span></th>
                </tr>
              </thead>
              <tbody>
                {lines.map((l) => {
                  const id = `${l.kind}:${l.subject_key}`;
                  return (
                    <tr key={id}>
                      <td style={cell}>{KIND_LABEL[l.kind]}</td>
                      <td style={cell}>{l.subject_key}</td>
                      <td style={cell}>{l.value}</td>
                      <td style={{ ...cell, whiteSpace: 'nowrap' }}>{l.effective_on}</td>
                      <td style={cell}>
                        <button type="button" className="bare tappable" aria-expanded={line === id} onClick={() => setLine(line === id ? null : id)}>
                          {l.versions === 1 ? 'History' : `History (${l.versions})`}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
          {picked && <History entries={history(entries, picked.kind, picked.subject_key)} name={name} />}
          <ActionButton
            style={{ marginTop: 'var(--sp-4)' }}
            disabled={lines.length === 0}
            onClick={() => download({ name: `record-${studentRef}-${on}.csv`, body: toCsv(studentRef, on, lines), mime: 'text/csv' })}
          >
            Export the record on this date
          </ActionButton>
        </>
      )}

      {mine.length > 0 && (
        <>
          <h3 style={h3}>Your proposals waiting for a decision</h3>
          <ul style={{ listStyle: 'none', padding: 0 }}>
            {mine.map((c) => (
              <li key={c.id} style={{ borderTop: '1px solid var(--app-line)', paddingBlock: 'var(--sp-3)' }}>
                <span style={{ ...body, display: 'block' }}>{summary(c)}</span>
                <button
                  type="button"
                  className="bare tappable"
                  onClick={() => api.withdraw(c.id).then(reload).then(onProposed, (e: unknown) => setNote(errorText(e, 'Could not withdraw the change.')))}
                >
                  Withdraw
                </button>
              </li>
            ))}
          </ul>
        </>
      )}

      {note && <Notice alert>{note}</Notice>}
      {propose && (
        <ProposeForm
          studentRef={studentRef}
          entries={entries}
          day={day}
          onPropose={(p) =>
            api.propose(tenantId, p).then(reload).then(() => {
              setNote('');
              onProposed();
            })
          }
        />
      )}
    </section>
  );
}

function History({ entries, name }: { entries: readonly LedgerEntry[]; name: (id: string | null) => string }) {
  return (
    <section aria-label="History" style={{ marginTop: 'var(--sp-4)' }}>
      <p style={quiet}>
        Every entry this line has had, oldest first. Nothing here is ever edited or removed; a correction is a new entry.
      </p>
      <ol style={{ paddingLeft: 'var(--sp-6)' }}>
        {entries.map((e) => (
          <li key={e.id} style={{ marginBlock: 'var(--sp-3)' }}>
            <p style={{ ...quiet, marginBottom: 'var(--sp-2)' }}>Recorded {formatDateTime(e.recorded_at, { dateStyle: 'medium', timeStyle: 'short' })}</p>
            <dl style={{ display: 'grid', gridTemplateColumns: 'minmax(8em, 40%) 1fr', gap: 'var(--sp-2)', fontSize: 'var(--type-sm)' }}>
              {explain(e, name).map(([q, a]) => (
                <div key={q} style={{ display: 'contents' }}>
                  <dt style={secondLine()}>{q}</dt>
                  <dd style={{ margin: 0 }}>{a}</dd>
                </div>
              ))}
            </dl>
          </li>
        ))}
      </ol>
    </section>
  );
}

function summary(c: RecordChange): string {
  const what = c.action === 'void' ? 'remove' : `set to ${c.value}`;
  return `${c.student_ref} · ${KIND_LABEL[c.kind]}, ${c.subject_key}: ${what}, effective ${c.effective_on}`;
}

function ProposeForm({
  studentRef, entries, day, onPropose,
}: {
  studentRef: string;
  entries: readonly LedgerEntry[];
  day: string;
  onPropose: (p: Proposal) => Promise<void>;
}) {
  const blank: Proposal = { student_ref: studentRef, kind: 'grade', subject_key: '', action: 'set', value: '', effective_on: day, reason: '', source: 'registrar' };
  const [p, setP] = useState<Proposal>(blank);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState('');
  const set = <K extends keyof Proposal>(k: K, v: Proposal[K]) => setP((x) => ({ ...x, [k]: v }));
  const problems = proposalProblems({ ...p, subject_key: p.subject_key.trim() }, entries);
  const overriding = isOverride(entries, { kind: p.kind, subject_key: p.subject_key.trim(), effective_on: p.effective_on });

  return (
    <form
      aria-label="Propose a change"
      style={grid}
      onSubmit={(e) => {
        e.preventDefault();
        if (problems.length) return;
        setBusy(true);
        setNote('');
        onPropose(p)
          .then(() => setP(blank), (err: unknown) => setNote(errorText(err, 'Could not propose the change.')))
          .finally(() => setBusy(false));
      }}
    >
      <h3 style={h3}>Propose a change</h3>
      <label style={label}>
        Kind
        <select className="input" value={p.kind} onChange={(e) => set('kind', e.target.value as RecordKind)}>
          {KINDS.map((k) => <option key={k} value={k}>{KIND_LABEL[k]}</option>)}
        </select>
      </label>
      <label style={label}>
        About ({KEY_HINT[p.kind]})
        <input className="input" value={p.subject_key} onChange={(e) => set('subject_key', e.target.value)} />
      </label>
      <label style={label}>
        Change
        <select className="input" value={p.action} onChange={(e) => {
          const a = e.target.value as RecordAction;
          setP((x) => ({ ...x, action: a, value: a === 'void' ? '' : x.value }));
        }}>
          {ACTIONS.map((a) => <option key={a} value={a}>{a === 'set' ? 'Set a value' : 'Remove it from the record'}</option>)}
        </select>
      </label>
      {p.action === 'set' && (
        <label style={label}>
          Value
          <input className="input" value={p.value} onChange={(e) => set('value', e.target.value)} />
        </label>
      )}
      <label style={label}>
        Effective from
        <input className="input" type="date" value={p.effective_on} onChange={(e) => set('effective_on', e.target.value)} />
      </label>
      <label style={label}>
        Source
        <select className="input" value={p.source} onChange={(e) => set('source', e.target.value as RecordSource)}>
          {SOURCES.map((s) => <option key={s} value={s}>{SOURCE_LABEL[s]}</option>)}
        </select>
      </label>
      <label style={label}>
        Reason (kept with the entry for good)
        <textarea className="input" rows={3} value={p.reason} onChange={(e) => set('reason', e.target.value)} />
      </label>
      {overriding && (
        <p role="status" style={quiet}>
          This corrects a {KIND_LABEL[p.kind].toLowerCase()} already on the record, so only an approver who holds registrar
          override can approve it.
        </p>
      )}
      {p.subject_key.trim() !== '' && problems.length > 0 && (
        <ul style={{ ...quiet, paddingLeft: 'var(--sp-6)' }}>
          {problems.map((m) => <li key={m}>{m}</li>)}
        </ul>
      )}
      {note && <Notice alert>{note}</Notice>}
      <button type="submit" className="btn btn-primary btn-block" disabled={busy || problems.length > 0}>
        {busy ? 'Proposing…' : 'Propose'}
      </button>
    </form>
  );
}

// ── The queue ───────────────────────────────────────────────────────────────

function Queue({
  changes, viewerId, decide, override, api, onDecided,
}: {
  changes: readonly RecordChange[];
  viewerId: string | null;
  decide: boolean;
  override: boolean;
  api: RecordApi;
  onDecided: () => void;
}) {
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const act = (work: Promise<void>) => {
    setBusy(true);
    setNote('');
    work.then(onDecided, (e: unknown) => setNote(errorText(e, 'Could not record the decision.'))).finally(() => setBusy(false));
  };
  return (
    <section aria-label="Changes waiting for a decision" style={{ marginTop: 'var(--sp-6)' }}>
      <h3 style={h3}>Waiting for a decision</h3>
      {!decide && <p style={quiet}>Your account reads these; deciding them needs record approval.</p>}
      {decide && !override && (
        <p style={quiet}>A correction of a grade, standing or degree already on the record needs registrar override, which your account does not hold; the database will refuse those.</p>
      )}
      {note && <Notice alert>{note}</Notice>}
      {changes.length === 0 ? (
        <p style={quiet}>Nothing is waiting.</p>
      ) : (
        <ul style={{ listStyle: 'none', padding: 0 }}>
          {changes.map((c) => {
            const own = c.proposed_by !== null && c.proposed_by === viewerId;
            return (
              <li key={c.id} style={{ borderTop: '1px solid var(--app-line)', paddingBlock: 'var(--sp-3)' }}>
                <span style={{ ...body, display: 'block' }}>{summary(c)}</span>
                <span style={{ ...quiet, display: 'block' }}>
                  {SOURCE_LABEL[c.source]} · {c.reason}
                </span>
                {decide && (own ? (
                  <p style={quiet}>You proposed this, so someone else decides it.</p>
                ) : (
                  <div style={{ display: 'flex', gap: 'var(--sp-4)', marginTop: 'var(--sp-3)' }}>
                    <ActionButton tone="primary" disabled={busy} onClick={() => act(api.decide(c.id, 'approved', ''))}>
                      Approve
                    </ActionButton>
                    <ActionButton disabled={busy} onClick={() => act(api.decide(c.id, 'rejected', ''))}>
                      Reject
                    </ActionButton>
                  </div>
                ))}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
