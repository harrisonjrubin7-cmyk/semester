import { useEffect, useMemo, useRef, useState } from 'react';
import { useStore } from '../../state/store';
import { ActionButton, EmptyState, Notice, SectionLabel } from '../ui';
import { ConfirmDialog } from '../ConfirmDialog';
import { ActionPreview } from '../unity/ActionPreview';
import { DateField } from '../unity/DateField';
import { ErrorState, LoadingState, PermissionState } from '../unity/States';
import { Table } from '../unity/Table';
import { Field, Result, Row, Stack, Sub, type Said } from '../academic/Form';
import { settled, useAttempts } from '../../lib/attempt';
import { formatDate, formatNumber } from '../../lib/locale';
import {
  dueSaid,
  fileProblem,
  fileRequest,
  inProgress,
  KIND_SAID,
  KINDS,
  loadRequests,
  MAX_NOTE,
  NOT_SET_UP_SAID,
  openQuestion,
  respondToRequest,
  StaleRequest,
  STATUS_SAID,
  withdrawRequest,
  type CourseRequest,
  type LoadedRequests,
  type RequestCaps,
  type RequestKind,
} from '../../lib/gradebook/requests';

/**
 * A student asks their instructor for an extension, an excused absence or an
 * incomplete on one course, and sees each request's status and answer.
 *
 * The request is the institution's record, not a message: it goes through
 * `course_request_file` and the instructor answers it on their side of the
 * gradebook (`RequestQueue`). Sending is previewed in `ConfirmDialog` with
 * `ActionPreview`, the pattern every consequential write here uses, and goes
 * through `useAttempts`, so a lost answer is retried with the same key and
 * cannot file twice. Withdrawing and answering a question name the version
 * the student read; if the instructor decided in the meantime the server says
 * so, and the screen offers to reload rather than guessing.
 *
 * Not `lib/mail.ts`'s extension email, which drafts a message on this device
 * and records nothing.
 */
export function AskInstructor({ course, term, caps }: { course: string; term: string; caps: RequestCaps }) {
  const { say } = useStore();
  const { attempt } = useAttempts();
  const [loaded, setLoaded] = useState<LoadedRequests | null | string>(null);
  const [reads, setReads] = useState(0);
  const [asking, setAsking] = useState(false);
  const [kind, setKind] = useState<RequestKind>('extension');
  const [itemId, setItemId] = useState('');
  const [due, setDue] = useState('');
  const [reason, setReason] = useState('');
  const [reviewing, setReviewing] = useState(false);
  const [withdrawing, setWithdrawing] = useState<CourseRequest | null>(null);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [said, setSaid] = useState<Said | null>(null);
  const [stale, setStale] = useState(false);
  const formHead = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    let live = true;
    loadRequests(course, term).then(
      (r) => { if (live) setLoaded(r); },
      (e: unknown) => { if (live) setLoaded(e instanceof Error ? e.message : 'Could not load your requests.'); },
    );
    return () => { live = false; };
  }, [course, term, reads]);

  useEffect(() => {
    if (asking) formHead.current?.focus();
  }, [asking]);

  const mine = useMemo(() => (loaded && typeof loaded === 'object' ? loaded.requests : []), [loaded]);
  const titleOf = (id: string | null) => (id && loaded && typeof loaded === 'object' ? loaded.items.find((i) => i.id === id)?.title : undefined);
  const reload = () => { setStale(false); setReads((n) => n + 1); };

  /** One write through its attempt; a stale version offers a reload instead of a retry. */
  async function write<T>(what: string, run: (key: string) => Promise<T>, done: (v: T) => string): Promise<boolean> {
    setBusy(true);
    setSaid(null);
    setStale(false);
    try {
      const v = await attempt(what, run);
      const text = done(v);
      setSaid({ tone: 'ok', text });
      say(text);
      setReads((n) => n + 1);
      return true;
    } catch (e) {
      const text = e instanceof Error ? e.message : 'That was not saved.';
      if (e instanceof StaleRequest) setStale(true);
      setSaid(settled(e) ? { tone: 'refused', text } : { tone: 'unknown', text, retry: () => void write(what, run, done) });
      return false;
    } finally {
      setBusy(false);
    }
  }

  if (typeof loaded === 'string') {
    return (
      <>
        <SectionLabel>Ask your instructor</SectionLabel>
        <ErrorState title="Your requests did not load" body={`${loaded} Nothing you asked has changed.`} recover={{ label: 'Load again', run: reload }} />
      </>
    );
  }
  if (loaded === null) {
    return (
      <>
        <SectionLabel>Ask your instructor</SectionLabel>
        <LoadingState what="your requests to your instructor" bars={[40, 96]} />
      </>
    );
  }
  if (!loaded.available) {
    return (
      <>
        <SectionLabel>Ask your instructor</SectionLabel>
        <Notice>{NOT_SET_UP_SAID} Ask the way your instructor has told you to — by email or in office hours.</Notice>
      </>
    );
  }

  const trimmed = reason.trim();
  const problem = fileProblem({ kind, requestedDue: due || null, reason });
  const item = loaded.items.find((i) => i.id === itemId) ?? null;
  const subject = `${KIND_SAID[kind]}${item ? ` · ${item.title}` : ''} · ${course}`;

  const send = async () => {
    const ok = await write(
      `file:${course}:${term}:${kind}:${itemId}:${due}:${trimmed}`,
      (key) => fileRequest({ course, term, kind, itemId: itemId || null, requestedDue: kind === 'extension' ? due : null, reason: trimmed }, key),
      () => `Your request for ${KIND_SAID[kind].toLowerCase()} is sent to your ${course} instructor. Their answer will appear below.`,
    );
    setReviewing(false);
    if (ok) {
      setAsking(false);
      setReason('');
      setDue('');
      setItemId('');
    }
  };

  return (
    <>
      <SectionLabel aside={mine.length ? `${formatNumber(mine.length)} ${mine.length === 1 ? 'request' : 'requests'}` : undefined}>Ask your instructor</SectionLabel>
      <Result said={said} />
      {stale && (
        <Row>
          <button type="button" className="btn" onClick={reload}>
            Reload your requests
          </button>
        </Row>
      )}

      {!caps.create ? (
        <PermissionState
          title="You cannot file requests on this course"
          body={`Your school has not given your account a student role on ${course} for ${term} that can ask the instructor for an extension, an excused absence or an incomplete.`}
          owner="your school’s registrar"
        />
      ) : !asking ? (
        <Row>
          <ActionButton tone="primary" style={{ width: 'auto', flex: '1 1 auto' }} onClick={() => { setAsking(true); setSaid(null); }}>
            Ask for an extension, an excused absence or an incomplete
          </ActionButton>
        </Row>
      ) : (
        <section aria-labelledby="ask-head">
          <h3 id="ask-head" ref={formHead} tabIndex={-1}>
            Ask your {course} instructor
          </h3>
          <Stack>
            <Field label="What you are asking for">
              {(ids) => (
                <select id={ids.id} aria-describedby={ids.hint} className="input" value={kind} onChange={(e) => setKind(e.target.value as RequestKind)}>
                  {KINDS.map((k) => (
                    <option key={k} value={k}>
                      {KIND_SAID[k]}
                    </option>
                  ))}
                </select>
              )}
            </Field>
            <Field label="Assignment" hint="Optional. Leave it on the whole course if the request is not about one assignment.">
              {(ids) => (
                <select id={ids.id} aria-describedby={ids.hint} className="input" value={itemId} onChange={(e) => setItemId(e.target.value)}>
                  <option value="">The whole course</option>
                  {loaded.items.map((i) => (
                    <option key={i.id} value={i.id}>
                      {i.title}
                    </option>
                  ))}
                </select>
              )}
            </Field>
            {kind === 'extension' && (
              <DateField label="New date you are asking for" value={due} onChange={setDue} required hint="Your instructor may grant a different date." />
            )}
            <Field label="Why" hint={`Your instructor reads this, up to ${formatNumber(MAX_NOTE)} characters. Other students cannot.`}>
              {(ids) => (
                <textarea id={ids.id} aria-describedby={ids.hint} className="input" rows={4} maxLength={MAX_NOTE} value={reason} onChange={(e) => setReason(e.target.value)} />
              )}
            </Field>
            {/* Always present, so a reader is already listening when the reason appears. */}
            <div role="status">{(reason !== '' || due !== '') && problem && <Sub>{problem}</Sub>}</div>
            <Row>
              <ActionButton tone="primary" disabled={busy || problem !== null} style={{ width: 'auto', flex: '1 1 auto' }} onClick={() => setReviewing(true)}>
                Review and send
              </ActionButton>
              <button type="button" className="btn" disabled={busy} onClick={() => setAsking(false)}>
                Cancel
              </button>
            </Row>
          </Stack>
        </section>
      )}

      {reviewing && (
        <ConfirmDialog
          title={`Send this request to your ${course} instructor?`}
          preview={
            <ActionPreview
              subject={subject}
              says={`Files a request your ${course} instructors read and answer. Teaching assistants on the course can read it too; other students cannot.`}
              exactly={
                <>
                  {kind === 'extension' && <>Asking for {dueSaid(due)}. </>}“{trimmed.slice(0, 160)}{trimmed.length > 160 ? '…' : ''}”
                </>
              }
              doesNotChange="Nothing about your grades or deadlines changes until your instructor approves it. An approved extension is recorded here; check your course’s own deadlines as your instructor tells you."
              recovery={{ kind: 'undo', how: 'You can withdraw it until your instructor decides.' }}
            />
          }
          confirmLabel={busy ? 'Sending…' : 'Send the request'}
          onCancel={() => { if (!busy) setReviewing(false); }}
          onConfirm={() => { if (!busy) void send(); }}
        />
      )}

      {withdrawing && (
        <ConfirmDialog
          title="Withdraw this request?"
          preview={
            <ActionPreview
              subject={`${KIND_SAID[withdrawing.kind]} · ${course}`}
              says="Withdraws the request. Your instructor sees that you withdrew it and cannot decide it."
              doesNotChange="Your reason and what was said stay in the request’s history."
              recovery={{ kind: 'none', how: 'You can file a new request afterwards.' }}
            />
          }
          confirmLabel={busy ? 'Withdrawing…' : 'Withdraw the request'}
          onCancel={() => { if (!busy) setWithdrawing(null); }}
          onConfirm={() => {
            if (busy) return;
            const r = withdrawing;
            void write(`withdraw:${r.id}:${r.version}`, (key) => withdrawRequest(r.id, r.version, key), () => 'Your request is withdrawn.').then(() => setWithdrawing(null));
          }}
        />
      )}

      {mine.length === 0 ? (
        caps.create && <EmptyState inline title="No requests yet" body={`When you ask your ${course} instructor for something here, its status and their answer appear in this list.`} />
      ) : (
        <Table
          caption={`Your requests to your ${course} instructor in ${term}, newest first.`}
          captionHidden
          compact="stack"
          rows={mine}
          rowKey={(r) => r.id}
          empty={null}
          columns={[
            {
              id: 'what',
              header: 'Request',
              rowHeader: true,
              cell: (r) => (
                <>
                  {KIND_SAID[r.kind]}
                  {titleOf(r.itemId) ? ` · ${titleOf(r.itemId)}` : ''}
                  <Sub>Asked {formatDate(new Date(r.filedAt), { month: 'short', day: 'numeric' })}{r.requestedDue ? ` for ${dueSaid(r.requestedDue)}` : ''}</Sub>
                </>
              ),
            },
            { id: 'status', header: 'Status', cell: (r) => STATUS_SAID[r.status] },
            {
              id: 'answer',
              header: 'Answer',
              cell: (r) => <Answer r={r} question={openQuestion(r, loaded.actions)} />,
            },
            {
              id: 'act',
              header: 'What you can do',
              cell: (r) => {
                if (!inProgress(r.status)) return '—';
                const q = openQuestion(r, loaded.actions);
                const draft = answers[r.id] ?? '';
                return (
                  <Stack label={`Your ${KIND_SAID[r.kind].toLowerCase()} request`}>
                    {q !== null && (
                      <>
                        <Field label="Your answer" hint="Your instructor reads this.">
                          {(ids) => (
                            <textarea id={ids.id} aria-describedby={ids.hint} className="input" rows={2} maxLength={MAX_NOTE} value={draft} onChange={(e) => setAnswers((a) => ({ ...a, [r.id]: e.target.value }))} />
                          )}
                        </Field>
                        <button
                          type="button"
                          className="btn"
                          disabled={busy || draft.trim() === ''}
                          onClick={() =>
                            void write(
                              `respond:${r.id}:${r.version}:${draft.trim()}`,
                              (key) => respondToRequest(r.id, draft.trim(), r.version, key),
                              () => 'Your answer is sent. The request is back with your instructor.',
                            ).then((ok) => { if (ok) setAnswers((a) => ({ ...a, [r.id]: '' })); })
                          }
                        >
                          Send your answer
                        </button>
                      </>
                    )}
                    <button type="button" className="btn" disabled={busy} onClick={() => { setWithdrawing(r); setSaid(null); }}>
                      Withdraw
                    </button>
                  </Stack>
                );
              },
            },
          ]}
        />
      )}
    </>
  );
}

function Answer({ r, question }: { r: CourseRequest; question: string | null }) {
  if (r.status === 'approved') {
    return (
      <>
        {r.grantedDue ? `New date: ${dueSaid(r.grantedDue)}` : 'Approved'}
        {r.decisionNote && <Sub>“{r.decisionNote}”</Sub>}
      </>
    );
  }
  if (r.status === 'denied') return <>“{r.decisionNote}”</>;
  if (question !== null) return <>Your instructor asks: “{question}”</>;
  return <>—</>;
}
