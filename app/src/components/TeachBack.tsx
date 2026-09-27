import { useEffect, useRef, useState } from 'react';
import { ask } from '../lib/claude';
import { citationLocation, type StudySource } from '../lib/studystudio';
import { MAX_EXPLANATION, TEACH_BACK_SYSTEM, parseTeachBack, teachBackPrompt, type TeachBack as Result, type TeachPoint } from '../lib/teachback';

/**
 * Teach it back, inside the Study Studio.
 *
 * It uses the Studio's own source selection and its own gates: `ready` is
 * false unless an AI connection is configured, the course allows AI (or the
 * student confirmed it does), and the student has ticked the Studio's consent
 * to send the selected text. The button then names the one extra thing that
 * goes — the explanation typed here. See `lib/teachback.ts` for what the
 * reply may and may not say.
 */
export function TeachBack({ courseId, sources, ready }: { courseId: string; sources: StudySource[]; ready: boolean }) {
  const [topic, setTopic] = useState('');
  const [explanation, setExplanation] = useState('');
  const [result, setResult] = useState<Result | null>(null);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('');
  const abort = useRef<AbortController | null>(null);
  useEffect(() => () => abort.current?.abort(), []);

  const check = async () => {
    if (busy || !ready) return;
    let prompt: string;
    try {
      prompt = teachBackPrompt(topic, explanation, sources);
    } catch (e) {
      setNotice((e as Error).message);
      return;
    }
    setBusy(true);
    setNotice('');
    abort.current = new AbortController();
    try {
      const reply = await ask({
        about: 'teach-back',
        system: TEACH_BACK_SYSTEM,
        messages: [{ role: 'user', content: prompt }],
        maxTokens: 4000,
        courseId,
        signal: abort.current.signal,
      });
      setResult(parseTeachBack(reply, sources, explanation));
    } catch (e) {
      setNotice(e instanceof Error && e.name === 'AbortError' ? 'Canceled. Nothing was checked.' : (e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const source = (id: string) => sources.find((s) => s.id === id);
  const points = (title: string, list: TeachPoint[], said?: boolean) =>
    list.length > 0 && (
      <>
        <h4>{title}</h4>
        <ul className="teachback-list">
          {list.map((p, i) => (
            <li key={`${p.sourceId}-${i}`}>
              <strong>{p.point}</strong>
              {said && 'said' in p && <p>You wrote: “{String(p.said)}”</p>}
              <blockquote>
                “{p.quote}”<small> — {source(p.sourceId)?.title} · {citationLocation(source(p.sourceId), p.at)}</small>
              </blockquote>
            </li>
          ))}
        </ul>
      </>
    );

  return (
    <section className="portal-panel" aria-labelledby="teachback-title">
      <h3 id="teachback-title">Teach it back</h3>
      <p className="portal-muted">
        Explain a topic in your own words, then see what your selected sources say you covered, left out or got the
        other way round. No grade, and no answer written for you. Nothing here is saved.
      </p>
      <div className="teachback-fields">
        <label>
          Topic
          <input value={topic} maxLength={200} onChange={(e) => setTopic(e.target.value)} disabled={busy} />
        </label>
        <label>
          Your explanation
          <textarea rows={6} value={explanation} maxLength={MAX_EXPLANATION} onChange={(e) => setExplanation(e.target.value)} disabled={busy} />
        </label>
      </div>
      <div className="portal-actions">
        <button className="portal-primary" disabled={busy || !ready || !sources.length || !topic.trim() || !explanation.trim()} onClick={() => void check()}>
          {busy ? 'Checking…' : 'Send my explanation and the selected text to check it'}
        </button>
        {busy && (
          <button type="button" onClick={() => abort.current?.abort()}>
            Cancel
          </button>
        )}
      </div>
      {!ready && <p className="portal-muted">Select sources and tick the consent above first.</p>}
      {notice && <p role="status">{notice}</p>}
      {result && (
        <div role="status" className="teachback-result">
          {result.unsupported && !result.covered.length && !result.missing.length ? (
            <p>Your selected sources do not cover this topic, so there is nothing to compare against. Select the material that does.</p>
          ) : (
            <>
              {points('What you covered', result.covered)}
              {points('What the sources say that you left out', result.missing)}
              {points('Where the sources say otherwise', result.conflicts, true)}
              {!result.covered.length && !result.missing.length && !result.conflicts.length && <p>Nothing came back that could be checked against your sources.</p>}
            </>
          )}
          {result.dropped > 0 && (
            <p className="portal-muted">
              {result.dropped} {result.dropped === 1 ? 'point was' : 'points were'} left out because {result.dropped === 1 ? 'its' : 'their'} quotation could not be
              found in your sources or your explanation.
            </p>
          )}
          <p className="portal-muted">Quotations are matched to the text. Whether a point is important is still the model’s reading; check it against the source.</p>
        </div>
      )}
    </section>
  );
}
