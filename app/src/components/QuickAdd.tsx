/**
 * One line, anywhere: "econ ps4 friday 5pm".
 *
 * Adding something you were just told about used to take a screen, a course
 * picker, a date picker and four taps, and the honest consequence is that
 * walking out of a lecture nobody does it. An app with stale data is worse
 * than no app, because it is trusted and wrong.
 *
 * ## It shows what it read before it writes anything
 *
 * The preview is not decoration. Every rule in `lib/capture.ts` can misfire —
 * "march" is a month and a verb, a course called CORE collides with the
 * ordinary English word — and a parse that silently created a deadline on the
 * wrong day would be the app quietly corrupting the one thing it exists to be
 * right about. So the reading is shown with the words it came from, and the
 * student presses the button.
 *
 * ## It writes a task, not a syllabus entry
 *
 * What comes out is one of *your* things filed against a course, not a line
 * pretending the syllabus said it. The app has kept that boundary everywhere
 * else and a capture box is exactly where it would be easiest to blur: a
 * re-imported syllabus rewrites its own items and would silently eat anything
 * added here if this wrote into that list.
 */

import { useEffect, useRef, useState } from 'react';
import { useStore } from '../state/store';
import { capture, enough, readBack } from '../lib/capture';

export function QuickAdd({ onClose }: { onClose: () => void }) {
  const { catalog, dispatch, now } = useStore();
  const [text, setText] = useState('');
  const [said, setSaid] = useState('');
  const box = useRef<HTMLInputElement>(null);

  useEffect(() => {
    box.current?.focus();
  }, []);

  const named = catalog.courses.map((c) => ({ id: c.id, code: c.code, title: c.name ?? '' }));
  const caught = capture(text, named, now);
  const ready = enough(caught);
  const codeOf = (id: string) => catalog.byId[id]?.code ?? id;

  const add = () => {
    if (!ready) return;
    dispatch({
      type: 'addTask',
      task: {
        title: caught.title,
        date: caught.date || null,
        time: caught.time,
        note: caught.kind ? `${caught.kind}, captured` : 'Captured',
        courseId: caught.courseId,
      },
    });
    setSaid(`Added${caught.courseId ? ` to ${codeOf(caught.courseId)}` : ''}.`);
    setText('');
    box.current?.focus();
  };

  return (
    <div
      role="dialog"
      aria-label="Add something quickly"
      style={{
        position: 'absolute',
        inset: 0,
        zIndex: 80,
        background: 'var(--app-bg)',
        display: 'flex',
        flexDirection: 'column',
        padding: 18,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 10 }}>
        <span className="kicker" style={{ flex: 1 }}>
          One line
        </span>
        <button
          type="button"
          className="bare"
          onClick={onClose}
          style={{ width: 'auto', fontSize: 'calc(12px * var(--text-scale, 1))', opacity: 0.6 }}
        >
          Close
        </button>
      </div>

      <input
        ref={box}
        className="input"
        value={text}
        onChange={(e) => {
          setText(e.target.value);
          setSaid('');
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter') add();
          if (e.key === 'Escape') onClose();
        }}
        placeholder="econ ps4 friday 5pm"
        aria-label="What to add"
        autoComplete="off"
        spellCheck={false}
        style={{
          width: '100%',
          height: 52,
          marginTop: 10,
          fontSize: 'calc(16px * var(--text-scale, 1))',
        }}
      />

      {text.trim() ? (
        <div style={{ marginTop: 14 }}>
          <div className="kicker">What it read</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 5, marginTop: 7 }}>
            {readBack(caught, codeOf).map((line) => (
              <div
                key={line}
                style={{
                  fontSize: 'calc(12.5px * var(--text-scale, 1))',
                  opacity: line.startsWith('No ') ? 0.55 : 0.85,
                  lineHeight: 1.45,
                  textWrap: 'pretty',
                }}
              >
                {line}
              </div>
            ))}
            <div
              style={{
                fontSize: 'calc(12.5px * var(--text-scale, 1))',
                marginTop: 4,
                lineHeight: 1.45,
                textWrap: 'pretty',
              }}
            >
              It will be called <strong>{caught.title || '—'}</strong>.
            </div>
          </div>

          <button
            type="button"
            className="btn btn-primary btn-block"
            onClick={add}
            disabled={!ready}
            style={{
              height: 46,
              marginTop: 16,
              textTransform: 'uppercase',
              letterSpacing: '0.09em',
            }}
          >
            Add it
          </button>
        </div>
      ) : (
        <div
          style={{
            fontSize: 'calc(12.5px * var(--text-scale, 1))',
            opacity: 0.6,
            marginTop: 16,
            lineHeight: 1.6,
            textWrap: 'pretty',
          }}
        >
          A course, what it is, when. Any order, and any part can be left out — “psci essay oct
          6”, “core quiz tomorrow”, “dentist tuesday 9am”. What it understood is shown before
          anything is written, because a deadline on the wrong day is worse than no deadline.
        </div>
      )}

      {said ? (
        <div
          role="status"
          style={{
            fontSize: 'calc(12.5px * var(--text-scale, 1))',
            opacity: 0.75,
            marginTop: 14,
          }}
        >
          {said} It is one of yours, filed against the course — not a line pretending the
          syllabus said it.
        </div>
      ) : null}
    </div>
  );
}
