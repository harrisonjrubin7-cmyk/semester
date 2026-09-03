import { useEffect, useRef } from 'react';
import { useStore } from '../state/store';
import { Blueprint } from '../components/Blueprint';
import { TickBox } from '../components/ui';
import { EXTRACT, LOAD_STEPS, PASTED } from '../data/misc';

/** The screen the app is built around: paste a syllabus, get dated rows back. */
export function Import() {
  const { dispatch } = useStore();

  return (
    <div style={{ padding: 18 }}>
      <div
        className="chrome-text"
        style={{ fontSize: 28, lineHeight: 1.08, letterSpacing: '-0.01em', textWrap: 'pretty' }}
      >
        Paste it. Walk away.
      </div>
      <div style={{ fontSize: 14, opacity: 0.7, marginTop: 6 }}>
        Dump the whole PDF or just the schedule table. Every date, weight and reading gets pulled
        out.
      </div>

      <div style={{ display: 'flex', gap: 8, margin: '16px 0 12px' }}>
        <button
          type="button"
          className="btn btn-secondary"
          style={{ flex: 1, height: 40, fontSize: 12, letterSpacing: '0.1em', textTransform: 'uppercase' }}
        >
          Upload PDF
        </button>
        <button
          type="button"
          className="btn btn-secondary"
          onClick={() => dispatch({ type: 'go', screen: 'connect' })}
          style={{ flex: 1, height: 40, fontSize: 12, letterSpacing: '0.1em', textTransform: 'uppercase' }}
        >
          Brightspace
        </button>
      </div>

      <textarea
        className="input"
        defaultValue={PASTED}
        style={{ minHeight: 210, fontSize: 13, lineHeight: 1.5 }}
        aria-label="Syllabus text"
      />

      <button
        type="button"
        className="btn btn-primary btn-block"
        onClick={() => dispatch({ type: 'go', screen: 'importing' })}
        style={{
          height: 50,
          fontSize: 15,
          letterSpacing: '0.1em',
          textTransform: 'uppercase',
          marginTop: 12,
        }}
      >
        Extract deadlines
      </button>
      <div style={{ height: 22 }} />
    </div>
  );
}

/** The working state. Steps through the extraction, then hands over to review. */
export function Importing() {
  const { state, dispatch } = useStore();
  const step = useRef(0);

  useEffect(() => {
    step.current = 0;
    dispatch({ type: 'setLoadStep', step: 0 });
    const id = setInterval(() => {
      step.current += 1;
      if (step.current >= LOAD_STEPS.length) {
        clearInterval(id);
        dispatch({ type: 'go', screen: 'review' });
      } else {
        dispatch({ type: 'setLoadStep', step: step.current });
      }
    }, 700);
    return () => clearInterval(id);
  }, [dispatch]);

  const skeletons = [
    { op: 1, w1: '62%', w2: '38%' },
    { op: 0.8, w1: '48%', w2: '54%' },
    { op: 0.6, w1: '70%', w2: '30%' },
    { op: 0.4, w1: '40%', w2: '46%' },
    { op: 0.2, w1: '58%', w2: '34%' },
  ];

  return (
    <div style={{ padding: 18 }}>
      <div className="chrome-text" style={{ fontSize: 28, lineHeight: 1.08 }}>
        Reading the syllabus…
      </div>
      <div style={{ fontSize: 13, opacity: 0.6, marginTop: 6 }}>
        {LOAD_STEPS[state.loadStep] ?? LOAD_STEPS[0]}
      </div>
      <div
        style={{
          height: 3,
          background: 'var(--app-track)',
          margin: '18px 0 24px',
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            height: '100%',
            width: '34%',
            background: 'var(--chrome)',
            animation: 'sweep 1.1s linear infinite',
          }}
        />
      </div>
      {skeletons.map((s, i) => (
        <Blueprint key={i} style={{ padding: '13px 14px', marginBottom: 10, opacity: s.op }}>
          <div style={{ height: 9, width: s.w1, background: 'var(--app-track)' }} />
          <div style={{ height: 9, width: s.w2, background: 'var(--app-track)', marginTop: 8 }} />
        </Blueprint>
      ))}
    </div>
  );
}

/** Confirm what was found before it lands in the semester. */
export function Review() {
  const { state, dispatch } = useStore();
  const picked = EXTRACT.filter((x) => state.picked[x.id]).length;

  return (
    <div style={{ padding: 18 }}>
      <div
        className="chrome-text"
        style={{ fontSize: 28, lineHeight: 1.08, letterSpacing: '-0.01em' }}
      >
        {EXTRACT.length} dates found.
      </div>
      <div style={{ fontSize: 14, opacity: 0.7, marginTop: 6 }}>
        ECON 1020 · Principles of Microeconomics · Dr. John Stromme. Untick anything you don’t want.
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 9, marginTop: 18 }}>
        {EXTRACT.map((r) => {
          const on = !!state.picked[r.id];
          return (
            <Blueprint
              key={r.id}
              onClick={() => dispatch({ type: 'togglePick', id: r.id })}
              style={{
                display: 'flex',
                gap: 12,
                padding: '12px 14px',
                alignItems: 'flex-start',
                opacity: on ? 1 : 0.45,
                textAlign: 'left',
              }}
            >
              <span style={{ marginTop: 2, flex: 'none' }}>
                <TickBox on={on} size={19} />
              </span>
              <span style={{ flex: 1, minWidth: 0 }}>
                <span style={{ display: 'block', fontSize: 14, lineHeight: 1.3 }}>{r.title}</span>
                <span
                  style={{
                    display: 'block',
                    fontSize: 11,
                    opacity: 0.55,
                    fontFamily: 'var(--font-heading)',
                    letterSpacing: '0.1em',
                    textTransform: 'uppercase',
                    marginTop: 2,
                  }}
                >
                  {r.when} · {r.kind}
                </span>
              </span>
            </Blueprint>
          );
        })}
      </div>

      <button
        type="button"
        className="btn btn-primary btn-block"
        onClick={() => dispatch({ type: 'go', screen: 'courses' })}
        style={{
          height: 50,
          fontSize: 15,
          letterSpacing: '0.1em',
          textTransform: 'uppercase',
          marginTop: 16,
        }}
      >
        Add {picked} to ECON 1020
      </button>
      <div style={{ height: 22 }} />
    </div>
  );
}
