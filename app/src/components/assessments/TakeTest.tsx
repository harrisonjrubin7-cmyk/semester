import { useEffect, useRef, useState } from 'react';
import { useStore } from '../../state/store';
import { ServiceError, useAttempts } from '../../lib/attempt';
import { answered, clock, finishTest, loadReview, loadSheet, saveAnswer, type Answer, type Finished, type Review, type Sheet, type TakeItem } from '../../lib/assessments/client';
import { ActionButton, Notice } from '../ui';
import { Field, Result, Row, Sub, type Said } from '../academic/Form';

/**
 * One attempt, on a clock the server holds.
 *
 * The countdown on screen is a courtesy: it starts from the seconds the server
 * says are left and decides nothing. When it reaches zero the screen asks the
 * server, which finishes the attempt with what was saved. An answer is saved as
 * it is chosen, so a lost connection or a closed tab costs nothing already
 * saved, and starting the test again on any device returns this attempt. Nothing
 * on this screen watches the student: no focus, window or camera signal is read.
 */
export function TakeTest({ attemptId, title, onDone }: { attemptId: string; title: string; onDone: () => void }) {
  const { say } = useStore();
  const { attempt } = useAttempts();
  const [sheet, setSheet] = useState<Sheet | string | null>(null);
  const [left, setLeft] = useState(0);
  const [answers, setAnswers] = useState<Record<string, Answer>>({});
  const [said, setSaid] = useState<Said | null>(null);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<Finished | null>(null);
  const [review, setReview] = useState<Review | string | null>(null);
  const [reads, setReads] = useState(0);
  const ended = useRef(false);

  useEffect(() => {
    let live = true;
    loadSheet(attemptId).then(
      (s) => { if (!live) return; setSheet(s); setLeft(s.remainingSeconds); setAnswers(s.answers); if (s.status !== 'in_progress') ended.current = true; },
      (e: unknown) => { if (live) setSheet(e instanceof Error ? e.message : 'The test could not be loaded.'); },
    );
    return () => { live = false; };
  }, [attemptId, reads]);

  // The courtesy countdown. At zero it asks the server, which decides.
  useEffect(() => {
    if (typeof sheet === 'string' || !sheet || sheet.status !== 'in_progress') return;
    const t = setInterval(() => setLeft((n) => Math.max(0, n - 1)), 1000);
    return () => clearInterval(t);
  }, [sheet]);
  useEffect(() => {
    if (left === 0 && sheet && typeof sheet !== 'string' && sheet.status === 'in_progress' && !ended.current) {
      ended.current = true;
      setReads((n) => n + 1);
    }
  }, [left, sheet]);

  async function save(item: TakeItem, a: Answer) {
    setAnswers((was) => ({ ...was, [item.id]: a }));
    if (!answered(item.kind, a)) return;
    try {
      const r = await saveAnswer(attemptId, item.id, a);
      if (!r.ok) { setSaid({ tone: 'refused', text: 'Time is up. Your saved answers were submitted.' }); ended.current = true; setReads((n) => n + 1); }
      else setSaid(null);
    } catch (e) {
      setSaid({ tone: e instanceof ServiceError && e.answered ? 'refused' : 'unknown', text: e instanceof Error ? e.message : 'That answer was not saved.' });
    }
  }

  async function finish() {
    setBusy(true);
    try {
      const r = await attempt(`finish:${attemptId}`, (k) => finishTest(attemptId, k));
      ended.current = true;
      setResult(r);
      say(r.status === 'expired' ? 'Time was up; your saved answers were submitted.' : 'Submitted.');
    } catch (e) {
      setSaid({ tone: e instanceof ServiceError && !e.answered ? 'unknown' : 'refused', text: e instanceof Error ? e.message : 'The test was not submitted.', retry: e instanceof ServiceError && !e.answered ? () => void finish() : undefined });
    } finally { setBusy(false); }
  }

  if (sheet === null) return <p role="status">Loading the test…</p>;
  if (typeof sheet === 'string') return <Notice alert>{sheet}</Notice>;

  const finished = result ?? (sheet.status !== 'in_progress' ? { status: sheet.status, score: sheet.score ?? 0, points: sheet.points ?? 0, needsReview: sheet.needsReview } as Finished : null);
  if (finished) {
    return (
      <section aria-label={`${title}, finished`}>
        <h3>{title}</h3>
        <Notice>
          {finished.status === 'expired' ? 'Time ran out; what you had saved was submitted. ' : 'Submitted. '}
          You scored {finished.score} of {finished.points} points on the questions marked by their key.
          {finished.needsReview ? ' Your instructor still has to read your essay answers.' : ''} This is a score on the test, not your grade.
        </Notice>
        <Row>
          <ActionButton onClick={() => void loadReview(attemptId).then(setReview, (e: unknown) => setReview(e instanceof Error ? e.message : 'The review could not be loaded.'))}>See your answers</ActionButton>
          <ActionButton tone="ghost" onClick={onDone}>Back to the tests</ActionButton>
        </Row>
        {typeof review === 'string' && <p role="alert">{review}</p>}
        {review && typeof review !== 'string' && (
          <>
            <Sub>{review.shown ? 'Your instructor is showing which answers were right.' : 'Which answers were right is not shown for this test.'}</Sub>
            <ol>
              {review.items.map((i) => (
                <li key={i.id}>
                  <div>{i.stem}</div>
                  <Sub>Your answer: {summary(i.kind, i.options, i.answer)}{review.shown && i.correct != null ? ` — ${i.correct ? 'correct' : 'not correct'}` : ''}{review.shown && i.key ? ` (key: ${keyWords(i.kind, i.options, i.key)})` : ''}</Sub>
                </li>
              ))}
            </ol>
          </>
        )}
      </section>
    );
  }

  const count = sheet.items.filter((i) => answered(i.kind, answers[i.id])).length;
  return (
    <section aria-label={title}>
      <h3>{title}</h3>
      <p role="timer" aria-live="off" style={{ fontSize: 'var(--type-xl)' }}>Time left: <strong>{clock(left)}</strong></p>
      <Sub>The server keeps the clock. Your answers are saved as you choose them. {count} of {sheet.items.length} answered.</Sub>
      <Result said={said} />
      <ol style={{ display: 'grid', gap: 'var(--sp-6)' }}>
        {sheet.items.map((item) => (
          <li key={item.id}>
            <Field label={`${item.stem} (${item.points} point${item.points === 1 ? '' : 's'})`}>
              {(ids) => <Control ids={ids.id} item={item} value={answers[item.id]} onChange={(a) => void save(item, a)} />}
            </Field>
          </li>
        ))}
      </ol>
      <ActionButton tone="primary" disabled={busy} onClick={() => void finish()}>Submit the test</ActionButton>
    </section>
  );
}

function Control({ ids, item, value, onChange }: { ids: string; item: TakeItem; value: Answer | undefined; onChange: (a: Answer) => void }) {
  if (item.kind === 'multiple_choice') {
    return (
      <div role="radiogroup" id={ids}>
        {item.options.map((o) => (
          <label key={o.id} style={{ display: 'block' }}>
            <input type="radio" name={`q-${item.id}`} checked={value?.choice === o.id} onChange={() => onChange({ choice: o.id })} /> {o.text}
          </label>
        ))}
      </div>
    );
  }
  if (item.kind === 'multiple_response') {
    const picked = (Array.isArray(value?.choices) ? value?.choices : []) as string[];
    return (
      <div role="group" id={ids}>
        {item.options.map((o) => (
          <label key={o.id} style={{ display: 'block' }}>
            <input type="checkbox" checked={picked.includes(o.id)} onChange={(e) => onChange({ choices: e.target.checked ? [...picked, o.id] : picked.filter((p) => p !== o.id) })} /> {o.text}
          </label>
        ))}
      </div>
    );
  }
  if (item.kind === 'true_false') {
    return (
      <div role="radiogroup" id={ids}>
        {[true, false].map((b) => (
          <label key={String(b)} style={{ display: 'block' }}>
            <input type="radio" name={`q-${item.id}`} checked={value?.value === b} onChange={() => onChange({ value: b })} /> {b ? 'True' : 'False'}
          </label>
        ))}
      </div>
    );
  }
  if (item.kind === 'numeric') {
    return <input id={ids} className="input" inputMode="decimal" defaultValue={typeof value?.value === 'number' ? String(value.value) : ''} onBlur={(e) => { const n = Number(e.target.value); if (e.target.value.trim() !== '' && Number.isFinite(n)) onChange({ value: n }); }} />;
  }
  if (item.kind === 'short_answer') {
    return <input id={ids} className="input" maxLength={2000} defaultValue={typeof value?.text === 'string' ? value.text : ''} onBlur={(e) => onChange({ text: e.target.value })} />;
  }
  return <textarea id={ids} className="input" rows={8} maxLength={20000} defaultValue={typeof value?.text === 'string' ? value.text : ''} onBlur={(e) => onChange({ text: e.target.value })} />;
}

function summary(kind: TakeItem['kind'], options: TakeItem['options'], a: Answer | null): string {
  if (!a) return 'no answer';
  const label = (id: unknown) => options.find((o) => o.id === id)?.text ?? String(id);
  if (kind === 'multiple_choice') return label(a.choice);
  if (kind === 'multiple_response') return (Array.isArray(a.choices) ? a.choices : []).map(label).join(', ') || 'no answer';
  if (kind === 'true_false') return a.value === true ? 'True' : a.value === false ? 'False' : 'no answer';
  if (kind === 'numeric') return String(a.value ?? 'no answer');
  return String(a.text ?? 'no answer');
}

function keyWords(kind: TakeItem['kind'], options: TakeItem['options'], key: Record<string, unknown>): string {
  const label = (id: unknown) => options.find((o) => o.id === id)?.text ?? String(id);
  if (kind === 'multiple_choice') return label(key.correct);
  if (kind === 'multiple_response') return ((key.correct as unknown[]) ?? []).map(label).join(', ');
  if (kind === 'true_false') return key.correct === true ? 'True' : 'False';
  if (kind === 'numeric') return `${key.value}${key.tolerance ? ` ± ${key.tolerance}` : ''}`;
  if (kind === 'short_answer') return ((key.accepted as unknown[]) ?? []).join(' / ');
  return 'marked by your instructor';
}
