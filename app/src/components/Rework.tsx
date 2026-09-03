import { useRef, useState } from 'react';
import { useStore } from '../state/store';
import { Blueprint } from './Blueprint';
import { SectionLabel } from './ui';
import { ask, configured } from '../lib/claude';
import { SYSTEM, brief, readPlan, survey, verdict, type Plan, type Survey } from '../lib/rework';
import type { CourseId, CourseUpdate, Guide } from '../lib/types';

/**
 * Rebuild the guide around everything added since.
 *
 * The merge in `live.ts` already puts new material into every study format at
 * read time. What it cannot do is reorganise: a week-six reading arrives as
 * cards on a unit or as a unit tacked on the end, because a merge has no
 * opinion about where it belongs in a structure written in week one. This
 * does.
 *
 * It never replaces anything without showing the cost first. Answer history is
 * keyed by the text of a question, so a card whose wording changes is one the
 * app has never seen — the streak, the interval and the due date go with the
 * wording. The preview counts exactly that and puts it above the guide, not
 * below, because it is the reason to say no.
 */
export function Rework({
  courseId,
  guide,
  updates,
}: {
  courseId: CourseId;
  guide: Guide;
  updates: CourseUpdate[];
}) {
  const { state, dispatch } = useStore();
  const [plan, setPlan] = useState<Plan | null>(null);
  const [cost, setCost] = useState<Survey | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState('');
  const abort = useRef<AbortController | null>(null);

  const owned = state.courses.find((c) => c.course.id === courseId);

  if (updates.length === 0 || !configured()) return null;

  const run = async () => {
    if (busy) return;
    setBusy(true);
    setError('');
    setDone('');
    setPlan(null);
    setCost(null);
    abort.current = new AbortController();
    try {
      const reply = await ask({
        signal: abort.current.signal,
        maxTokens: 8000,
        think: true,
        system: SYSTEM,
        messages: [{ role: 'user', content: brief(guide, updates) }],
      });
      const next = readPlan(reply, guide);
      setPlan(next);
      setCost(survey(guide, next.guide));
    } catch (e) {
      if (!(e instanceof DOMException && e.name === 'AbortError')) {
        setError(e instanceof Error ? e.message : String(e));
      }
    } finally {
      setBusy(false);
    }
  };

  const keep = () => {
    if (!plan || !owned) return;
    dispatch({ type: 'replaceCourse', module: { ...owned, guide: plan.guide } });
    setPlan(null);
    setCost(null);
    setDone(
      'The guide is rebuilt. Cards, Read, Quiz, Cram and the slides are all using it. The ' +
        'material you added is still listed below and can still be removed.',
    );
  };

  return (
    <>
      <SectionLabel>Rebuild the guide around this</SectionLabel>
      <div style={{ fontSize: 12.5, opacity: 0.65, lineHeight: 1.5, marginBottom: 10 }}>
        Everything you have added already shows up in every study format. This goes further and
        reorganises the guide itself — new material put in the unit it belongs to, units split or
        renamed where they have outgrown themselves, cards written from prose that never became
        questions. Nothing changes until you have seen what it would do.
      </div>

      {!owned && (
        <div style={{ fontSize: 12.5, opacity: 0.6, lineHeight: 1.5, marginBottom: 10 }}>
          This is one of the built-in sample courses, so its guide cannot be replaced. Your own
          courses can be.
        </div>
      )}

      <button
        type="button"
        className="btn btn-secondary btn-block"
        disabled={busy || !owned}
        onClick={() => void run()}
        style={{ height: 44 }}
      >
        {busy ? 'Reworking the guide…' : 'See what it would look like'}
      </button>

      {error ? (
        <div style={{ fontSize: 13, marginTop: 10, color: 'var(--app-warn)', lineHeight: 1.45 }}>
          {error}
        </div>
      ) : null}
      {done ? (
        <div style={{ fontSize: 13, marginTop: 10, opacity: 0.8, lineHeight: 1.5 }}>{done}</div>
      ) : null}

      {plan && cost && (
        <Blueprint style={{ padding: '13px 14px', marginTop: 12 }}>
          <div className="kicker">What it would cost you</div>
          <div
            style={{
              fontSize: 13,
              marginTop: 7,
              lineHeight: 1.55,
              // The one thing worth a colour: something you drilled going away.
              color: cost.reworded + cost.dropped > 0 ? 'var(--app-warn)' : 'inherit',
            }}
          >
            {verdict(cost)}
          </div>

          {cost.examples.length > 0 && (
            <div style={{ fontSize: 11.5, opacity: 0.7, marginTop: 10, lineHeight: 1.5 }}>
              {cost.examples.map((e, i) => (
                <div key={i} style={{ marginBottom: 6 }}>
                  <div style={{ textDecoration: 'line-through', opacity: 0.6 }}>{e.before}</div>
                  {e.after ? <div>→ {e.after}</div> : <div style={{ opacity: 0.6 }}>→ dropped</div>}
                </div>
              ))}
            </div>
          )}

          <div style={{ fontSize: 12, opacity: 0.65, marginTop: 12, lineHeight: 1.5 }}>
            {cost.unitsBefore} units → {cost.unitsAfter}.{' '}
            {plan.guide.units.reduce((n, u) => n + u.cards.length, 0)} cards,{' '}
            {plan.guide.terms.length} terms.
          </div>

          {plan.notes.length > 0 && (
            <ul style={{ fontSize: 12, opacity: 0.75, margin: '10px 0 0', paddingLeft: 18, lineHeight: 1.55 }}>
              {plan.notes.map((n, i) => (
                <li key={i}>{n}</li>
              ))}
            </ul>
          )}

          <div style={{ marginTop: 12 }}>
            {plan.guide.units.map((u, i) => (
              <div key={i} style={{ fontSize: 12.5, opacity: 0.8, padding: '3px 0' }}>
                {u.name} <span style={{ opacity: 0.5 }}>· {u.cards.length}</span>
              </div>
            ))}
          </div>

          <div style={{ display: 'flex', gap: 8, marginTop: 14 }}>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => {
                setPlan(null);
                setCost(null);
              }}
              style={{ flex: 1, height: 42 }}
            >
              Keep the old one
            </button>
            <button
              type="button"
              className="btn btn-primary"
              onClick={keep}
              style={{ flex: 1, height: 42 }}
            >
              Use this guide
            </button>
          </div>
        </Blueprint>
      )}
    </>
  );
}
