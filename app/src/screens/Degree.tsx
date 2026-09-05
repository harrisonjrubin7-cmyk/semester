/**
 * The four-year view.
 *
 * The app is called Semester and it ends in December. This is the part that
 * does not: what is left of a major, what a course is counting towards, and
 * where the credit hours stand.
 *
 * ## It ships no requirements and never will
 *
 * Requirements are specific to a university, a college, a catalogue year and a
 * declaration date, and they change. A student reading a confidently wrong
 * list would find out in their final year, when nothing can be done about it.
 * So this screen holds *your* requirements, copied from your own audit, and
 * does the arithmetic — which is the tedious part and the part a person gets
 * wrong at midnight with a PDF open.
 *
 * The sentence saying so is on the screen rather than in a help page, because
 * the one thing that must not happen is somebody mistaking this for the
 * registrar's own audit.
 */

import { useState } from 'react';
import { useStore } from '../state/store';
import { Blueprint } from '../components/Blueprint';
import { SectionLabel, Segmented } from '../components/ui';
import {
  countingIn,
  forProgramme,
  gpa,
  gpaLine,
  hours,
  progressLine,
  programmes,
  readAccepts,
  rollup,
  rollupLine,
  spare,
} from '../lib/degree';

export function Degree() {
  const { state } = useStore();
  const [tab, setTab] = useState<'left' | 'taken' | 'rules'>('left');

  return (
    <div style={{ padding: 18 }}>
      <Blueprint style={{ padding: '14px 15px' }}>
        <div className="kicker">Your arithmetic, not the registrar’s</div>
        <div
          style={{
            marginTop: 6,
            fontSize: 'calc(12.5px * var(--text-scale, 1))',
            lineHeight: 1.55,
            textWrap: 'pretty',
          }}
        >
          This app ships no degree requirements and never will — they differ by university, by
          college and by catalogue year, and a wrong one is found out in a final year. Put in
          what your own audit says and everything below is worked out from it. Check anything
          that matters against the real thing.
        </div>
      </Blueprint>

      <Segmented
        options={[
          { id: 'left', label: 'What is left' },
          { id: 'taken', label: `Taken${state.taken.length ? ` (${state.taken.length})` : ''}` },
          { id: 'rules', label: 'Requirements' },
        ]}
        value={tab}
        onChange={setTab}
        style={{ margin: '16px 0' }}
      />

      {tab === 'left' ? <WhatIsLeft /> : null}
      {tab === 'taken' ? <Transcript /> : null}
      {tab === 'rules' ? <Rules /> : null}
    </div>
  );
}

function WhatIsLeft() {
  const { state } = useStore();
  const list = programmes(state.requirements);
  const g = gpa(state.taken, state.scale);
  const h = hours(state.taken);
  const loose = spare(state.requirements, state.taken);

  if (list.length === 0) {
    return (
      <>
        <p style={{ fontSize: 'calc(12.5px * var(--text-scale, 1))', opacity: 0.6, lineHeight: 1.55, textWrap: 'pretty' }}>
          Nothing recorded yet. Add your requirements under Requirements — one row per line of
          your audit — and the courses you have taken under Taken.
        </p>
        {/*
          The cumulative figure still shows.

          Requirements are one thing and a transcript is another: somebody who
          has closed out two terms has a real GPA across them, and hiding it
          behind an audit they have not typed yet meant the whole point of
          closing a term was invisible. See `lib/rollover.ts`.
        */}
        {h.done > 0 ? (
          <>
            <SectionLabel style={{ margin: '24px 0 8px' }}>Hours and grades</SectionLabel>
            <div style={{ fontSize: 'calc(13px * var(--text-scale, 1))', lineHeight: 1.5, textWrap: 'pretty' }}>
              {h.done} hours finished
              {h.withThisTerm !== h.done ? `, ${h.withThisTerm} with this term` : ''}. {gpaLine(g)}
            </div>
          </>
        ) : null}
      </>
    );
  }

  return (
    <>
      {list.map((p) => {
        const r = rollup(state.requirements, state.taken, p);
        return (
          <div key={p} style={{ marginBottom: 20 }}>
            <SectionLabel style={{ margin: '0 0 6px' }}>{p}</SectionLabel>
            <div
              style={{
                fontSize: 'calc(13px * var(--text-scale, 1))',
                marginBottom: 9,
                textWrap: 'pretty',
              }}
            >
              {rollupLine(r)}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
              {forProgramme(state.requirements, state.taken, p).map((prog) => (
                <div
                  key={prog.req.id}
                  style={{
                    padding: '10px 13px',
                    borderRadius: 'var(--r-md)',
                    border: '1px solid var(--app-line)',
                    opacity: prog.met ? 0.62 : 1,
                  }}
                >
                  <div style={{ fontSize: 'calc(13px * var(--text-scale, 1))', lineHeight: 1.35, textWrap: 'pretty' }}>
                    {prog.req.name || 'Unnamed requirement'}
                  </div>
                  <div
                    style={{
                      fontSize: 'calc(11.5px * var(--text-scale, 1))',
                      opacity: 0.7,
                      marginTop: 3,
                      textWrap: 'pretty',
                    }}
                  >
                    {progressLine(prog)}
                  </div>
                  {/* Which courses it is counting, so a rule against double
                      counting is visible and fixable rather than silently
                      applied or silently ignored. */}
                  {prog.done.length + prog.doing.length > 0 ? (
                    <div
                      style={{
                        fontSize: 'calc(11.5px * var(--text-scale, 1))',
                        opacity: 0.5,
                        marginTop: 4,
                        textWrap: 'pretty',
                      }}
                    >
                      {[...prog.done.map((c) => c.code), ...prog.doing.map((c) => `${c.code} (now)`)].join(', ')}
                    </div>
                  ) : null}
                </div>
              ))}
            </div>
          </div>
        );
      })}

      <SectionLabel style={{ margin: '24px 0 8px' }}>Hours and grades</SectionLabel>
      <div style={{ fontSize: 'calc(13px * var(--text-scale, 1))', lineHeight: 1.5, textWrap: 'pretty' }}>
        {h.done} hours finished
        {h.withThisTerm !== h.done ? `, ${h.withThisTerm} with this term` : ''}. {gpaLine(g)}
      </div>

      {loose.length > 0 ? (
        <>
          <SectionLabel style={{ margin: '24px 0 8px' }}>Counting towards nothing</SectionLabel>
          {/* Either they really are free electives, or a requirement has not
              been entered yet. Both are worth knowing and the app does not
              guess which. */}
          <div style={{ fontSize: 'calc(12.5px * var(--text-scale, 1))', opacity: 0.7, lineHeight: 1.5, textWrap: 'pretty' }}>
            {loose.map((c) => c.code).join(', ')}. Either these are free electives, or a
            requirement they satisfy has not been entered yet.
          </div>
        </>
      ) : null}
    </>
  );
}

function Transcript() {
  const { state, dispatch } = useStore();
  const [code, setCode] = useState('');
  const [title, setTitle] = useState('');
  const [term, setTerm] = useState('');
  const [creditHours, setCreditHours] = useState('3');
  const [grade, setGrade] = useState('');
  const [current, setCurrent] = useState(false);

  const add = () => {
    if (!code.trim()) return;
    dispatch({
      type: 'addTaken',
      patch: { code, title, term, hours: Number(creditHours) || 0, grade, current },
    });
    setCode('');
    setTitle('');
    setGrade('');
  };

  return (
    <>
      <div style={{ display: 'flex', gap: 8 }}>
        <input
          className="input"
          value={code}
          onChange={(e) => setCode(e.target.value)}
          placeholder="ECON 1020"
          aria-label="Course code"
          style={{ width: 130, height: 42 }}
        />
        <input
          className="input"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Title — optional"
          aria-label="Course title"
          style={{ flex: 1, height: 42 }}
        />
      </div>
      <div style={{ display: 'flex', gap: 8, marginTop: 8, flexWrap: 'wrap' }}>
        <input
          className="input"
          value={term}
          onChange={(e) => setTerm(e.target.value)}
          placeholder="Fall 2026"
          aria-label="Term"
          style={{ width: 120, height: 40 }}
        />
        <input
          className="input"
          inputMode="numeric"
          value={creditHours}
          onChange={(e) => setCreditHours(e.target.value)}
          aria-label="Credit hours"
          style={{ width: 64, height: 40, textAlign: 'center' }}
        />
        <input
          className="input"
          value={grade}
          onChange={(e) => setGrade(e.target.value)}
          placeholder="A-"
          aria-label="Grade"
          disabled={current}
          style={{ width: 64, height: 40, textAlign: 'center' }}
        />
        <button
          type="button"
          className="bare tappable"
          aria-pressed={current}
          onClick={() => setCurrent(!current)}
          style={{
            width: 'auto',
            padding: '9px 13px',
            borderRadius: 'var(--r-sm)',
            border: `1px solid ${current ? 'var(--app-accent)' : 'var(--app-line)'}`,
            fontSize: 'calc(11.5px * var(--text-scale, 1))',
          }}
        >
          Taking it now
        </button>
      </div>
      <button
        type="button"
        className="btn btn-secondary btn-block"
        onClick={add}
        style={{ height: 44, marginTop: 12, textTransform: 'uppercase', letterSpacing: '0.09em' }}
      >
        Add the course
      </button>

      {state.taken.length > 0 ? (
        <>
          <SectionLabel style={{ margin: '24px 0 8px' }}>Recorded</SectionLabel>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
            {state.taken.map((c) => (
              <div
                key={c.id}
                style={{
                  display: 'flex',
                  gap: 10,
                  alignItems: 'baseline',
                  padding: '10px 13px',
                  borderRadius: 'var(--r-md)',
                  border: '1px solid var(--app-line)',
                }}
              >
                <span style={{ flex: 1, minWidth: 0 }}>
                  <span style={{ display: 'block', fontSize: 'calc(13px * var(--text-scale, 1))' }}>
                    {c.code} {c.title ? `· ${c.title}` : ''}
                  </span>
                  <span
                    style={{
                      display: 'block',
                      fontSize: 'calc(11.5px * var(--text-scale, 1))',
                      opacity: 0.6,
                      marginTop: 2,
                      textWrap: 'pretty',
                    }}
                  >
                    {[c.term, `${c.hours} hrs`, c.current ? 'in progress' : c.grade]
                      .filter(Boolean)
                      .join(' · ')}
                    {countingIn(state.requirements, c).length > 0
                      ? ` · counts in ${[
                          ...new Set(countingIn(state.requirements, c).map((r) => r.programme)),
                        ].join(', ')}`
                      : ''}
                  </span>
                </span>
                <button
                  type="button"
                  className="bare"
                  onClick={() => dispatch({ type: 'dropTaken', id: c.id })}
                  aria-label={`Remove ${c.code}`}
                  style={{ width: 'auto', fontSize: 'calc(11px * var(--text-scale, 1))', opacity: 0.5 }}
                >
                  Remove
                </button>
              </div>
            ))}
          </div>
        </>
      ) : null}
    </>
  );
}

function Rules() {
  const { state, dispatch } = useStore();
  const [programme, setProgramme] = useState('');
  const [name, setName] = useState('');
  const [count, setCount] = useState('1');
  const [need, setNeed] = useState<'courses' | 'hours'>('courses');
  const [list, setList] = useState('');

  const add = () => {
    if (!programme.trim() || !name.trim()) return;
    dispatch({
      type: 'addRequirement',
      patch: {
        programme,
        name,
        need,
        count: Number(count) || 1,
        accepts: readAccepts(list),
      },
    });
    setName('');
    setList('');
  };

  return (
    <>
      <div style={{ display: 'flex', gap: 8 }}>
        <input
          className="input"
          value={programme}
          onChange={(e) => setProgramme(e.target.value)}
          placeholder="Economics major"
          aria-label="Which programme"
          style={{ flex: 1, height: 42 }}
        />
      </div>
      <input
        className="input"
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="Intermediate theory"
        aria-label="What the requirement is called"
        style={{ width: '100%', height: 42, marginTop: 8 }}
      />
      <div style={{ display: 'flex', gap: 8, marginTop: 8, alignItems: 'center', flexWrap: 'wrap' }}>
        <input
          className="input"
          inputMode="numeric"
          value={count}
          onChange={(e) => setCount(e.target.value)}
          aria-label="How many"
          style={{ width: 64, height: 40, textAlign: 'center' }}
        />
        {(['courses', 'hours'] as const).map((n) => (
          <button
            key={n}
            type="button"
            className="bare tappable"
            aria-pressed={need === n}
            onClick={() => setNeed(n)}
            style={{
              width: 'auto',
              padding: '9px 13px',
              borderRadius: 'var(--r-sm)',
              border: `1px solid ${need === n ? 'var(--app-accent)' : 'var(--app-line)'}`,
              fontSize: 'calc(11.5px * var(--text-scale, 1))',
            }}
          >
            {n}
          </button>
        ))}
      </div>
      <textarea
        className="input"
        value={list}
        onChange={(e) => setList(e.target.value)}
        placeholder="ECON 3010, ECON 3012 — or just ECON for any course in it. Blank means anything."
        aria-label="Which courses satisfy it"
        style={{
          width: '100%',
          minHeight: 64,
          marginTop: 8,
          resize: 'vertical',
          fontSize: 'calc(13px * var(--text-scale, 1))',
          lineHeight: 1.5,
        }}
      />
      <button
        type="button"
        className="btn btn-secondary btn-block"
        onClick={add}
        style={{ height: 44, marginTop: 10, textTransform: 'uppercase', letterSpacing: '0.09em' }}
      >
        Add the requirement
      </button>

      {state.requirements.length > 0 ? (
        <>
          <SectionLabel style={{ margin: '24px 0 8px' }}>Recorded</SectionLabel>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
            {state.requirements.map((r) => (
              <div
                key={r.id}
                style={{
                  display: 'flex',
                  gap: 10,
                  alignItems: 'baseline',
                  padding: '10px 13px',
                  borderRadius: 'var(--r-md)',
                  border: '1px solid var(--app-line)',
                }}
              >
                <span style={{ flex: 1, minWidth: 0 }}>
                  <span style={{ display: 'block', fontSize: 'calc(13px * var(--text-scale, 1))', textWrap: 'pretty' }}>
                    {r.programme} · {r.name}
                  </span>
                  <span
                    style={{
                      display: 'block',
                      fontSize: 'calc(11.5px * var(--text-scale, 1))',
                      opacity: 0.6,
                      marginTop: 2,
                      textWrap: 'pretty',
                    }}
                  >
                    {r.count} {r.need} · {r.accepts.length > 0 ? r.accepts.join(', ') : 'anything'}
                  </span>
                </span>
                <button
                  type="button"
                  className="bare"
                  onClick={() => dispatch({ type: 'dropRequirement', id: r.id })}
                  aria-label={`Remove ${r.name}`}
                  style={{ width: 'auto', fontSize: 'calc(11px * var(--text-scale, 1))', opacity: 0.5 }}
                >
                  Remove
                </button>
              </div>
            ))}
          </div>
        </>
      ) : null}
    </>
  );
}
