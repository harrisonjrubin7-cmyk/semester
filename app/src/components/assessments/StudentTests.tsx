import { useEffect, useState } from 'react';
import { useStore } from '../../state/store';
import { ServiceError, useAttempts } from '../../lib/attempt';
import { formatDateTime } from '../../lib/locale';
import { loadAttempts, loadTests, startTest, type AttemptRow, type Test } from '../../lib/assessments/client';
import { ActionButton, EmptyState, SectionLabel } from '../ui';
import { Result, Row, RowItem, Rows, Sub, type Said } from '../academic/Form';
import { TakeTest } from './TakeTest';

const at = (iso: string): string => { try { return formatDateTime(iso, { dateStyle: 'medium', timeStyle: 'short' }); } catch { return iso; } };

/** A student's tests for one course and term: what is open, their attempts, and a way to start or resume. */
export function StudentTests({ school, course, term }: { school: string; course: string; term: string }) {
  const { say } = useStore();
  const { attempt } = useAttempts();
  const [tests, setTests] = useState<Test[] | string | null>(null);
  const [attempts, setAttempts] = useState<AttemptRow[]>([]);
  const [reads, setReads] = useState(0);
  // When the list was read: whether a test is open is judged against this, not against a clock read during a render.
  const [now, setNow] = useState(() => Date.now());
  const [said, setSaid] = useState<Record<string, Said | null>>({});
  const [taking, setTaking] = useState<{ attemptId: string; title: string } | null>(null);

  useEffect(() => {
    let live = true;
    (async () => {
      try {
        const t = await loadTests(school, course, term);
        const a = await loadAttempts(t.map((x) => x.id));
        if (live) { setTests(t); setAttempts(a); setNow(Date.now()); }
      } catch (e) { if (live) setTests(e instanceof Error ? e.message : 'The tests could not be read.'); }
    })();
    return () => { live = false; };
  }, [school, course, term, reads]);

  async function start(t: Test) {
    setSaid((s) => ({ ...s, [t.id]: null }));
    try {
      const r = await attempt(`start:${t.id}`, (k) => startTest(t.id, k));
      say(r.resumed ? `Back to ${t.title}.` : `${t.title} started.`);
      setTaking({ attemptId: r.attemptId, title: t.title });
    } catch (e) {
      const text = e instanceof Error ? e.message : 'The test was not started.';
      setSaid((s) => ({ ...s, [t.id]: e instanceof ServiceError && !e.answered ? { tone: 'unknown', text, retry: () => void start(t) } : { tone: 'refused', text } }));
    }
  }

  if (taking) return <TakeTest attemptId={taking.attemptId} title={taking.title} onDone={() => { setTaking(null); setReads((n) => n + 1); }} />;

  const visible = Array.isArray(tests) ? tests.filter((t) => t.status !== 'draft') : [];
  return (
    <section aria-label="Tests">
      <SectionLabel>Tests · {course} · {term}</SectionLabel>
      {tests === null && <p role="status">Reading your tests…</p>}
      {typeof tests === 'string' && <p role="alert">{tests}</p>}
      {Array.isArray(tests) && visible.length === 0 && <EmptyState inline title="No tests" body="Your instructor has not published a test for this course yet." />}
      {visible.length > 0 && (
        <Rows label="Tests">
          {visible.map((t) => {
            const mine = attempts.filter((a) => a.assessmentId === t.id);
            const going = mine.find((a) => a.status === 'in_progress');
            const used = mine.length;
            const open = t.status === 'published' && now >= new Date(t.opensAt).getTime() && now <= new Date(t.closesAt).getTime();
            return (
              <RowItem key={t.id}>
                <div><strong>{t.title}</strong> · {t.status === 'closed' ? 'closed' : open ? 'open' : 'not open'}</div>
                <Sub>{t.minutes} minutes · {t.itemCount} questions · open {at(t.opensAt)} to {at(t.closesAt)} · {used} of {t.attempts} attempt{t.attempts === 1 ? '' : 's'} used</Sub>
                {t.instructions && <p style={{ whiteSpace: 'pre-wrap', margin: 0 }}>{t.instructions}</p>}
                {mine.filter((a) => a.status !== 'in_progress').map((a) => (
                  <Sub key={a.id}>Attempt {a.attempt}: {a.status === 'expired' ? 'time ran out, ' : ''}{a.score ?? 0} of {a.points ?? 0} points{a.needsReview ? ' so far; your essay is not yet read' : ''} · <button type="button" className="btn" onClick={() => setTaking({ attemptId: a.id, title: t.title })}>Open</button></Sub>
                ))}
                <Result said={said[t.id] ?? null} />
                {(going || (open && used < t.attempts)) && (
                  <Row><ActionButton onClick={() => void start(t)}>{going ? 'Resume the test' : 'Start the test'}</ActionButton></Row>
                )}
              </RowItem>
            );
          })}
        </Rows>
      )}
    </section>
  );
}
