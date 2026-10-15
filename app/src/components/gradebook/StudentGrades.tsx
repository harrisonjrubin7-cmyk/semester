import { useEffect, useMemo, useRef, useState } from 'react';
import { useStore } from '../../state/store';
import { ActionButton, EmptyState, Notice, SectionLabel } from '../ui';
import { SourceBadge } from '../SourceBadge';
import { Table } from '../unity/Table';
import { Field, Result, Row, Stack, Sub, type Said } from '../academic/Form';
import { settled, useAttempts } from '../../lib/attempt';
import { formatDate } from '../../lib/locale';
import { studentView } from '../../lib/gradebook/views';
import { asGradebook, fileRegrade, loadBook, type LoadedBook } from '../../lib/gradebook/client';
import type { Mark } from '../../lib/gradebook/model';

/**
 * A student's own released grades for one course, and asking for one to be
 * looked at again.
 *
 * Row-level security returns this student's released rows and nobody
 * else's, and `studentView` takes no other student's id — so there is no
 * way for this component to show a draft or a classmate. The course total is
 * worked out here from released grades only, and is labelled Estimated,
 * because it is Semester's arithmetic and not a grade anyone recorded.
 *
 * This is not the Grades tab (`screens/Grades.tsx`), which is the student's
 * own "what do I need on the final" over numbers they typed. It links there
 * rather than repeating it.
 */

const MARK_SAID: Record<Mark, string> = { late: 'Late', excused: 'Excused', incomplete: 'Incomplete', missing: 'Missing' };

export function StudentGrades({ course, term, me }: { course: string; term: string; me: string }) {
  const { say, dispatch } = useStore();
  const { attempt } = useAttempts();
  const [book, setBook] = useState<LoadedBook | null | string>(null);
  const [readAt, setReadAt] = useState<number | null>(null);
  const [reads, setReads] = useState(0);
  const [asking, setAsking] = useState<string | null>(null);
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [said, setSaid] = useState<Said | null>(null);
  const formHead = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    let live = true;
    loadBook(course, term).then(
      (b) => { if (live) { setBook(b); setReadAt(Date.now()); } },
      (e: unknown) => { if (live) setBook(e instanceof Error ? e.message : 'Could not load your grades.'); },
    );
    return () => { live = false; };
  }, [course, term, reads]);

  useEffect(() => {
    if (asking) formHead.current?.focus();
  }, [asking]);

  const view = useMemo(() => (book && typeof book === 'object' ? studentView(asGradebook(book), { id: me, capabilities: [] }) : null), [book, me]);

  async function send(itemId: string, title: string, text: string): Promise<void> {
      setBusy(true);
      setSaid(null);
      try {
        await attempt(`regrade:${itemId}:${text}`, (key) => fileRegrade(itemId, text, key));
        const done = `Your regrade request for ${title} is sent. Your instructor’s answer will appear here.`;
        setSaid({ tone: 'ok', text: done });
        say(done);
        setAsking(null);
        setReason('');
        setReads((n) => n + 1);
      } catch (e) {
        const msg = e instanceof Error ? e.message : 'The request was not sent.';
        setSaid(settled(e) ? { tone: 'refused', text: msg } : { tone: 'unknown', text: msg, retry: () => void send(itemId, title, text) });
      } finally {
        setBusy(false);
      }
  }

  if (typeof book === 'string') {
    return (
      <>
        <Notice alert>{book} Nothing has changed. Try again in a moment.</Notice>
        <button type="button" className="btn" onClick={() => setReads((n) => n + 1)}>
          Load again
        </button>
      </>
    );
  }
  if (book === null || view === null) return <p role="status">Loading your grades for {course}…</p>;

  const openOn = new Set(view.regrades.filter((r) => !r.resolution).map((r) => r.itemId));
  const toGrades = () => {
    dispatch({ type: 'setCoursesTab', tab: 'grades' });
    dispatch({ type: 'go', screen: 'courses' });
  };

  return (
    <>
      <Result said={said} />
      {view.lines.length === 0 ? (
        <EmptyState
          inline
          title="No grades released yet"
          body={`Your instructor has not released any ${course} grades for ${term}. Grades appear here once they do.`}
          action={{ label: 'Work out what you need', onClick: toGrades }}
        />
      ) : (
        <>
          <SectionLabel aside={<SourceBadge label="estimated" at={readAt} />}>Course total so far</SectionLabel>
          <p>
            {view.final.reason} Worked out by
            Semester from released grades only; your instructor’s final grade is the one that counts.
          </p>
          <SectionLabel aside={<SourceBadge label="institution_verified" at={readAt} />}>Released grades</SectionLabel>
          <Table
            caption={`Your released grades in ${course}, ${term}.`}
            captionHidden
            rows={view.lines}
            rowKey={(l) => l.itemId}
            // The empty case is the whole block's, drawn above, so this table is never empty.
            empty={null}
            columns={[
              { id: 'item', header: 'Item', rowHeader: true, cell: (l) => l.title },
              {
                id: 'grade',
                header: 'Grade',
                cell: (l) => (
                  <>
                    {l.score === null ? '—' : `${l.score} of ${l.pointsPossible}`}
                    {l.mark ? ` · ${MARK_SAID[l.mark]}` : ''}
                    {l.comment && <Sub>{l.comment}</Sub>}
                  </>
                ),
              },
              { id: 'released', header: 'Released', cell: (l) => formatDate(new Date(l.releasedAt), { month: 'short', day: 'numeric' }) },
              {
                id: 'regrade',
                header: 'Regrade',
                cell: (l) =>
                  openOn.has(l.itemId) ? (
                    'Asked — waiting for an answer'
                  ) : (
                    <button type="button" className="btn" disabled={busy} onClick={() => { setAsking(l.itemId); setSaid(null); }}>
                      Ask about {l.title}
                    </button>
                  ),
              },
            ]}
          />
        </>
      )}

      {asking && (() => {
        const l = view.lines.find((x) => x.itemId === asking);
        if (!l) return null;
        return (
          <section aria-labelledby="regrade-head">
            <h3 id="regrade-head" ref={formHead} tabIndex={-1}>
              Ask for {l.title} to be looked at again
            </h3>
            <Stack>
              <Field label="What should be looked at" hint="Your instructor reads this. Say which part, and why.">
                {(ids) => (
                  <textarea id={ids.id} aria-describedby={ids.hint} className="input" rows={4} maxLength={2000} value={reason} onChange={(e) => setReason(e.target.value)} />
                )}
              </Field>
              <Row>
                <ActionButton tone="primary" disabled={busy || !reason.trim()} style={{ width: 'auto', flex: '1 1 auto' }} onClick={() => void send(l.itemId, l.title, reason.trim())}>
                  Send the regrade request
                </ActionButton>
                <button type="button" className="btn" disabled={busy} onClick={() => setAsking(null)}>
                  Cancel
                </button>
              </Row>
            </Stack>
          </section>
        );
      })()}

      {view.regrades.length > 0 && (
        <>
          <SectionLabel>Your regrade requests</SectionLabel>
          <ul>
            {view.regrades.map((r) => {
              const title = view.lines.find((l) => l.itemId === r.itemId)?.title ?? 'An item';
              return (
                <li key={r.id}>
                  <strong>{title}</strong>: {r.resolution ? (r.resolution.outcome === 'changed' ? 'Changed. ' : 'The grade stands. ') + r.resolution.note : 'Waiting for your instructor.'}
                </li>
              );
            })}
          </ul>
        </>
      )}

      <Row>
        <button type="button" className="btn" onClick={toGrades}>
          Work out what you need on the final
        </button>
      </Row>
    </>
  );
}
