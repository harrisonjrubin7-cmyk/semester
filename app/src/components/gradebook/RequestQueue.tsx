import { useEffect, useState } from 'react';
import { useStore } from '../../state/store';
import { EmptyState, Notice, SectionLabel } from '../ui';
import { ConfirmDialog } from '../ConfirmDialog';
import { ActionPreview } from '../unity/ActionPreview';
import { DateField } from '../unity/DateField';
import { LoadingState, PermissionState } from '../unity/States';
import { Table } from '../unity/Table';
import { Field, Result, RowItem, Rows, Row, Stack, Sub, type Said } from '../academic/Form';
import { settled, useAttempts } from '../../lib/attempt';
import { formatDate, formatNumber } from '../../lib/locale';
import {
  decideProblem,
  decideRequest,
  dueSaid,
  historyOf,
  inProgress,
  KIND_SAID,
  loadRequests,
  MAX_NOTE,
  NOT_SET_UP_SAID,
  StaleRequest,
  STATUS_SAID,
  type CourseRequest,
  type LoadedRequests,
  type Outcome,
  type RequestCaps,
} from '../../lib/gradebook/requests';

/**
 * The course's queue of student requests — extensions, excused absences,
 * incompletes — for one course and term, on the instructor's side of the
 * gradebook.
 *
 * Who decides is the migration's (`course_requests:decide`, faculty); a
 * teaching assistant holds `:view` and reads the queue with every decision
 * control absent, and the screen says why. A decision is previewed in
 * `ConfirmDialog` with `ActionPreview` and names the version the instructor
 * read: if a colleague decided first, or the student withdrew, the server
 * refuses and writes nothing, and this says so and offers to reload rather
 * than retrying a decision about something that has changed.
 *
 * Students are named by a short account id, as in `InstructorBook`: the
 * gradebook has no readable roster of names.
 */

const shortId = (id: string) => (id.length > 8 ? `${id.slice(0, 8)}…` : id);

const OUTCOME_SAID: Record<Outcome, string> = { approve: 'Approve', deny: 'Deny', ask: 'Ask the student a question' };

interface Draft {
  outcome: Outcome;
  grantedDue: string;
  note: string;
}

export function RequestQueue({ course, term, caps }: { course: string; term: string; caps: RequestCaps }) {
  const { say } = useStore();
  const { attempt } = useAttempts();
  const [loaded, setLoaded] = useState<LoadedRequests | null | string>(null);
  const [reads, setReads] = useState(0);
  const [drafts, setDrafts] = useState<Record<string, Draft>>({});
  const [reviewing, setReviewing] = useState<CourseRequest | null>(null);
  const [busy, setBusy] = useState(false);
  const [said, setSaid] = useState<Said | null>(null);
  const [stale, setStale] = useState(false);

  useEffect(() => {
    if (!caps.view) return;
    let live = true;
    loadRequests(course, term).then(
      (r) => { if (live) setLoaded(r); },
      (e: unknown) => { if (live) setLoaded(e instanceof Error ? e.message : 'Could not load the requests.'); },
    );
    return () => { live = false; };
  }, [course, term, reads, caps.view]);

  const reload = () => { setStale(false); setReads((n) => n + 1); };

  if (!caps.view) {
    return (
      <>
        <SectionLabel>Student requests</SectionLabel>
        <PermissionState
          title="You cannot read this course’s student requests"
          body={`Your role on ${course} for ${term} grades work but does not include students’ requests for extensions, excused absences or incompletes.`}
          owner="your school’s registrar"
        />
      </>
    );
  }
  if (typeof loaded === 'string') {
    return (
      <>
        <SectionLabel>Student requests</SectionLabel>
        {/* Not ErrorState: its recovery is a primary button, and releasing grades is this screen's one primary action. */}
        <Notice alert>{loaded} Nothing has changed.</Notice>
        <button type="button" className="btn" onClick={reload}>
          Load the requests again
        </button>
      </>
    );
  }
  if (loaded === null) {
    return (
      <>
        <SectionLabel>Student requests</SectionLabel>
        <LoadingState what={`the student requests for ${course}`} bars={[40, 96]} />
      </>
    );
  }
  if (!loaded.available) {
    return (
      <>
        <SectionLabel>Student requests</SectionLabel>
        <Notice>{NOT_SET_UP_SAID} Students will keep asking you by email until it is.</Notice>
      </>
    );
  }

  const waiting = loaded.requests.filter((r) => inProgress(r.status)).sort((a, b) => a.filedAt.localeCompare(b.filedAt));
  const closed = loaded.requests.filter((r) => !inProgress(r.status));
  const titleOf = (id: string | null) => (id ? loaded.items.find((i) => i.id === id)?.title : undefined);
  const what = (r: CourseRequest) => `${KIND_SAID[r.kind]}${titleOf(r.itemId) ? ` · ${titleOf(r.itemId)}` : ''}`;

  const draftOf = (r: CourseRequest): Draft => drafts[r.id] ?? { outcome: 'approve', grantedDue: r.requestedDue ?? '', note: '' };
  const setDraft = (r: CourseRequest, patch: Partial<Draft>) => setDrafts((all) => ({ ...all, [r.id]: { ...draftOf(r), ...patch } }));

  async function decide(r: CourseRequest): Promise<void> {
    const d = draftOf(r);
    setBusy(true);
    setSaid(null);
    setStale(false);
    const run = (key: string) => decideRequest({ requestId: r.id, outcome: d.outcome, grantedDue: d.grantedDue || null, note: d.note.trim(), expect: r.version }, key);
    try {
      const v = await attempt(`decide:${r.id}:${r.version}:${d.outcome}:${d.grantedDue}:${d.note.trim()}`, run);
      const text =
        v.status === 'approved'
          ? `${what(r)} for student ${shortId(r.studentId)} is approved${v.grantedDue ? `, with a new date of ${dueSaid(v.grantedDue)}` : ''}. The student sees it now.`
          : v.status === 'denied'
            ? `${what(r)} for student ${shortId(r.studentId)} is denied. The student reads your note.`
            : `Your question is sent to student ${shortId(r.studentId)}. The request comes back here when they answer.`;
      setSaid({ tone: 'ok', text });
      say(text);
      setDrafts((all) => { const next = { ...all }; delete next[r.id]; return next; });
      setReads((n) => n + 1);
    } catch (e) {
      const text = e instanceof Error ? e.message : 'The decision was not saved.';
      if (e instanceof StaleRequest) setStale(true);
      setSaid(settled(e) ? { tone: 'refused', text } : { tone: 'unknown', text, retry: () => void decide(r) });
    } finally {
      setBusy(false);
      setReviewing(null);
    }
  }

  return (
    <>
      <SectionLabel aside={waiting.length ? `${formatNumber(waiting.length)} waiting` : undefined}>Student requests</SectionLabel>
      <Result said={said} />
      {stale && (
        <Row>
          <button type="button" className="btn" onClick={reload}>
            Reload the requests
          </button>
        </Row>
      )}
      {!caps.decide && <Sub>You can read these requests. The course’s instructor decides them.</Sub>}

      {waiting.length === 0 ? (
        <EmptyState inline title="No requests waiting" body="When a student asks for an extension, an excused absence or an incomplete on this course, it appears here." />
      ) : (
        <Rows label="Requests waiting for a decision">
          {waiting.map((r) => {
            const d = draftOf(r);
            const history = historyOf(loaded.actions, r.id).filter((a) => a.note !== '');
            const problem = decideProblem(r.kind, { outcome: d.outcome, grantedDue: d.grantedDue || null, note: d.note });
            return (
              <RowItem key={r.id}>
                <div>
                  <strong>{what(r)}</strong> · student {shortId(r.studentId)} · {STATUS_SAID[r.status]}
                  <Sub>
                    Asked {formatDate(new Date(r.filedAt), { month: 'short', day: 'numeric' })}
                    {r.requestedDue ? `, for ${dueSaid(r.requestedDue)}` : ''}
                  </Sub>
                  <p>“{r.reason}”</p>
                  {history.map((a) => (
                    <Sub key={a.id}>
                      {a.action === 'info_requested' ? 'You asked' : 'The student answered'}: “{a.note}”
                    </Sub>
                  ))}
                </div>
                {caps.decide && (
                  <Stack label={`Decide the ${KIND_SAID[r.kind].toLowerCase()} request from student ${shortId(r.studentId)}`}>
                    <Field label="Decision">
                      {(ids) => (
                        <select id={ids.id} aria-describedby={ids.hint} className="input" value={d.outcome} onChange={(e) => setDraft(r, { outcome: e.target.value as Outcome })}>
                          <option value="approve">{OUTCOME_SAID.approve}</option>
                          <option value="deny">{OUTCOME_SAID.deny}</option>
                          {r.status === 'open' && <option value="ask">{OUTCOME_SAID.ask}</option>}
                        </select>
                      )}
                    </Field>
                    {d.outcome === 'approve' && r.kind === 'extension' && (
                      <DateField label="New date you are granting" value={d.grantedDue} onChange={(v) => setDraft(r, { grantedDue: v })} required hint="It may differ from the date asked." />
                    )}
                    <Field
                      label={d.outcome === 'ask' ? 'Your question' : 'Note to the student'}
                      hint={d.outcome === 'approve' ? `Optional. The student reads it. Up to ${formatNumber(MAX_NOTE)} characters.` : `The student reads it. Up to ${formatNumber(MAX_NOTE)} characters.`}
                    >
                      {(ids) => (
                        <textarea id={ids.id} aria-describedby={ids.hint} className="input" rows={2} maxLength={MAX_NOTE} value={d.note} onChange={(e) => setDraft(r, { note: e.target.value })} />
                      )}
                    </Field>
                    <div role="status">{(d.note !== '' || d.outcome !== 'approve') && problem && <Sub>{problem}</Sub>}</div>
                    <Row>
                      <button type="button" className="btn" disabled={busy || problem !== null} onClick={() => { setReviewing(r); setSaid(null); }}>
                        Review the decision
                      </button>
                    </Row>
                  </Stack>
                )}
              </RowItem>
            );
          })}
        </Rows>
      )}

      {reviewing && (() => {
        const r = reviewing;
        const d = draftOf(r);
        const says =
          d.outcome === 'approve'
            ? `Approves the request${r.kind === 'extension' ? `, granting ${dueSaid(d.grantedDue)}` : ''}. The student sees the decision at once.${r.kind === 'extension' && r.itemId ? ` ${dueSaid(d.grantedDue)} becomes their due date for ${titleOf(r.itemId) ?? 'the item'}, unless the item’s own date is later.` : ''}`
            : d.outcome === 'deny'
              ? 'Denies the request. The student sees the decision and your note at once.'
              : 'Sends your question to the student. The request waits for their answer, and you can still decide it meanwhile.';
        return (
          <ConfirmDialog
            title={`${OUTCOME_SAID[d.outcome]}: ${what(r)}?`}
            preview={
              <ActionPreview
                subject={`${what(r)} · student ${shortId(r.studentId)}`}
                says={says}
                exactly={d.note.trim() ? `“${d.note.trim()}”` : undefined}
                doesNotChange={
                  r.kind === 'extension' && r.itemId
                    ? 'Grades, the item’s own due date and every other student’s date stay as they are.'
                    : r.kind === 'extension'
                      ? 'This request names no item, so no due date in the gradebook moves; the approved date is recorded on the request.'
                      : 'Grades and due dates do not change; the decision is recorded on this request.'
                }
                recovery={d.outcome === 'ask' ? { kind: 'undo', how: 'Approve or deny it whenever you are ready.' } : { kind: 'none', how: 'A decided request is closed. The student can file a new one.' }}
              />
            }
            confirmLabel={busy ? 'Saving…' : OUTCOME_SAID[d.outcome]}
            onCancel={() => { if (!busy) setReviewing(null); }}
            onConfirm={() => { if (!busy) void decide(r); }}
          />
        );
      })()}

      {closed.length > 0 && (
        <>
          <SectionLabel aside={formatNumber(closed.length)}>Decided and withdrawn</SectionLabel>
          <Table
            caption={`Requests on ${course} in ${term} that are no longer waiting, newest first.`}
            captionHidden
            compact="stack"
            rows={closed}
            rowKey={(r) => r.id}
            empty={null}
            columns={[
              { id: 'what', header: 'Request', rowHeader: true, cell: (r) => what(r) },
              { id: 'student', header: 'Student', cell: (r) => shortId(r.studentId) },
              { id: 'status', header: 'Status', cell: (r) => STATUS_SAID[r.status] },
              {
                id: 'answer',
                header: 'Decision',
                cell: (r) => (
                  <>
                    {r.grantedDue ? `New date: ${dueSaid(r.grantedDue)}` : r.decidedAt ? formatDate(new Date(r.decidedAt), { month: 'short', day: 'numeric' }) : '—'}
                    {r.decisionNote && <Sub>“{r.decisionNote}”</Sub>}
                  </>
                ),
              },
            ]}
          />
        </>
      )}
    </>
  );
}
