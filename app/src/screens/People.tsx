/**
 * The people who will write about you.
 *
 * Two years from now three letters have to come from somewhere, and the
 * difference between "of course" and "I don't really know you well enough" was
 * decided by a handful of twenty-minute conversations nobody wrote down. It is
 * the highest-cost thing a student can start late, it has no deadline attached
 * to warn them, and nothing in any student app suggests it exists.
 *
 * Everything here is a count or a date. There is no relationship score and no
 * prediction of who will say yes — see `lib/letters.ts` for why a green bar
 * would be worse than silence.
 */

import { useState } from 'react';
import { useStore } from '../state/store';
import { Blueprint } from '../components/Blueprint';
import { SectionLabel, Segmented } from '../components/ui';
import {
  ASKS,
  NOTICE,
  daysLeft,
  known,
  knownLine,
  needing,
  nextMove,
  notice,
  short,
} from '../lib/letters';

export function People() {
  const { state } = useStore();
  const [tab, setTab] = useState<'people' | 'letters'>('people');

  return (
    <div style={{ padding: 18 }}>
      <Segmented
        options={[
          { id: 'people', label: `People${state.people.length ? ` (${state.people.length})` : ''}` },
          { id: 'letters', label: `Letters${state.letters.length ? ` (${state.letters.length})` : ''}` },
        ]}
        value={tab}
        onChange={setTab}
        style={{ margin: '0 0 16px' }}
      />
      {tab === 'people' ? <PeopleTab /> : <LettersTab />}
    </div>
  );
}

function PeopleTab() {
  const { state, dispatch, now, catalog } = useStore();
  const [name, setName] = useState('');
  const [role, setRole] = useState('');
  const [open, setOpen] = useState<string | null>(null);
  const [what, setWhat] = useState('');

  return (
    <>
      <div style={{ display: 'flex', gap: 8 }}>
        <input
          className="input"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Dr. Stromme"
          aria-label="Their name"
          style={{ flex: 1, height: 42 }}
        />
        <button
          type="button"
          className="btn btn-secondary"
          onClick={() => {
            if (!name.trim()) return;
            dispatch({ type: 'addPerson', patch: { name, role } });
            setName('');
            setRole('');
          }}
          style={{ width: 'auto', padding: '0 16px', height: 42, textTransform: 'uppercase', letterSpacing: '0.09em' }}
        >
          Add
        </button>
      </div>
      <input
        className="input"
        value={role}
        onChange={(e) => setRole(e.target.value)}
        placeholder="Professor, ECON 1020 — optional"
        aria-label="Their role"
        style={{ width: '100%', height: 40, marginTop: 8 }}
      />

      {state.people.length === 0 ? (
        <p
          style={{
            marginTop: 20,
            fontSize: 'calc(12.5px * var(--text-scale, 1))',
            opacity: 0.65,
            lineHeight: 1.6,
            textWrap: 'pretty',
          }}
        >
          Nobody here yet. Add the people whose courses you are actually in, and put one line
          in after each conversation — what you talked about, what you are working on. It takes
          thirty seconds and it is the difference between a letter somebody can write and one
          they cannot.
        </p>
      ) : null}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 9, marginTop: 18 }}>
        {state.people.map((p) => {
          const k = known(state.visits, p.id, now);
          const theirs = state.visits
            .filter((v) => v.personId === p.id)
            .sort((a, b) => b.at - a.at);
          const course = p.courseId ? catalog.byId[p.courseId]?.code : '';
          return (
            <Blueprint key={p.id} style={{ padding: '13px 14px' }}>
              <button
                type="button"
                className="bare tappable"
                onClick={() => setOpen(open === p.id ? null : p.id)}
                style={{ display: 'block', width: '100%', textAlign: 'left' }}
              >
                <span style={{ display: 'block', fontSize: 'calc(14.5px * var(--text-scale, 1))' }}>
                  {p.name}
                </span>
                <span
                  style={{
                    display: 'block',
                    fontSize: 'calc(11.5px * var(--text-scale, 1))',
                    opacity: 0.62,
                    marginTop: 3,
                    textWrap: 'pretty',
                  }}
                >
                  {[p.role, course].filter(Boolean).join(' · ')}
                </span>
                <span
                  style={{
                    display: 'block',
                    fontSize: 'calc(12px * var(--text-scale, 1))',
                    opacity: 0.75,
                    marginTop: 5,
                    lineHeight: 1.45,
                    textWrap: 'pretty',
                  }}
                >
                  {knownLine(k, now)}
                </span>
              </button>

              {open === p.id ? (
                <div style={{ marginTop: 12 }}>
                  <div className="kicker">After a conversation</div>
                  <textarea
                    className="input"
                    value={what}
                    onChange={(e) => setWhat(e.target.value)}
                    placeholder="What you talked about, and what you are working on with them."
                    aria-label={`What you discussed with ${p.name}`}
                    spellCheck
                    style={{
                      width: '100%',
                      minHeight: 56,
                      marginTop: 6,
                      resize: 'vertical',
                      fontSize: 'calc(13px * var(--text-scale, 1))',
                      lineHeight: 1.5,
                    }}
                  />
                  <button
                    type="button"
                    className="btn btn-secondary btn-block"
                    onClick={() => {
                      if (!what.trim()) return;
                      dispatch({ type: 'addVisit', patch: { personId: p.id, what } });
                      setWhat('');
                    }}
                    style={{ height: 40, marginTop: 8, textTransform: 'uppercase', letterSpacing: '0.09em' }}
                  >
                    Record it
                  </button>

                  {theirs.length > 0 ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 12 }}>
                      {theirs.map((v) => (
                        <div
                          key={v.id}
                          style={{
                            fontSize: 'calc(12px * var(--text-scale, 1))',
                            lineHeight: 1.45,
                            opacity: 0.8,
                            textWrap: 'pretty',
                          }}
                        >
                          <span style={{ opacity: 0.6 }}>
                            {new Date(v.at).toDateString().slice(4).replace(/\s\d{4}$/, '')}
                          </span>{' '}
                          — {v.what}
                        </div>
                      ))}
                    </div>
                  ) : null}

                  <button
                    type="button"
                    className="bare"
                    onClick={() => dispatch({ type: 'dropPerson', id: p.id })}
                    style={{
                      width: 'auto',
                      marginTop: 12,
                      fontSize: 'calc(11.5px * var(--text-scale, 1))',
                      opacity: 0.5,
                    }}
                  >
                    Remove {p.name} and everything recorded about them
                  </button>
                </div>
              ) : null}
            </Blueprint>
          );
        })}
      </div>
    </>
  );
}

function LettersTab() {
  const { state, dispatch, now } = useStore();
  const [personId, setPersonId] = useState('');
  const [forWhat, setForWhat] = useState('');
  const [due, setDue] = useState('');

  const nameOf = (id: string) => state.people.find((p) => p.id === id)?.name ?? 'somebody';
  const wanted = needing(state.letters, now);

  if (state.people.length === 0) {
    return (
      <p style={{ fontSize: 'calc(12.5px * var(--text-scale, 1))', opacity: 0.65, lineHeight: 1.6 }}>
        Add somebody under People first — a letter belongs to a person.
      </p>
    );
  }

  return (
    <>
      <SectionLabel style={{ margin: '0 0 8px' }}>Ask for one</SectionLabel>
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        {state.people.map((p) => (
          <button
            key={p.id}
            type="button"
            className="bare tappable"
            aria-pressed={personId === p.id}
            onClick={() => setPersonId(p.id)}
            style={{
              width: 'auto',
              padding: '8px 12px',
              borderRadius: 'var(--r-sm)',
              border: `1px solid ${personId === p.id ? 'var(--app-accent)' : 'var(--app-line)'}`,
              fontSize: 'calc(11.5px * var(--text-scale, 1))',
            }}
          >
            {p.name}
          </button>
        ))}
      </div>
      <input
        className="input"
        value={forWhat}
        onChange={(e) => setForWhat(e.target.value)}
        placeholder="Truman Scholarship"
        aria-label="What the letter is for"
        style={{ width: '100%', height: 42, marginTop: 10 }}
      />
      <div style={{ display: 'flex', gap: 8, marginTop: 8, alignItems: 'center', flexWrap: 'wrap' }}>
        <input
          className="input"
          type="date"
          value={due}
          onChange={(e) => setDue(e.target.value)}
          aria-label="When the letter is due"
          style={{ width: 170, height: 40 }}
        />
        <button
          type="button"
          className="btn btn-secondary"
          onClick={() => {
            if (!personId || !forWhat.trim()) return;
            dispatch({ type: 'addLetter', patch: { personId, forWhat, due } });
            setForWhat('');
            setDue('');
          }}
          style={{ width: 'auto', padding: '0 16px', height: 40, textTransform: 'uppercase', letterSpacing: '0.09em' }}
        >
          Track it
        </button>
      </div>

      {wanted.length > 0 ? (
        <>
          <SectionLabel style={{ margin: '22px 0 8px' }}>Wanting something from you</SectionLabel>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
            {wanted.map((l) => {
              const left = daysLeft(l, now);
              const tight = short(l, now);
              return (
                <Blueprint
                  key={l.id}
                  style={{
                    padding: '13px 14px',
                    border: tight ? '1px solid var(--app-warn-line)' : undefined,
                    background: tight ? 'var(--app-warn-wash)' : undefined,
                  }}
                >
                  <div style={{ fontSize: 'calc(14px * var(--text-scale, 1))', textWrap: 'pretty' }}>
                    {l.forWhat} — {nameOf(l.personId)}
                  </div>
                  <div
                    style={{
                      fontSize: 'calc(11.5px * var(--text-scale, 1))',
                      opacity: 0.62,
                      marginTop: 3,
                    }}
                  >
                    {[
                      ASKS.find((a) => a.id === l.stage)?.label,
                      left === null ? 'no deadline set' : left < 0 ? 'deadline gone' : `in ${left} days`,
                      notice(l, now) !== null ? `${notice(l, now)} days of notice` : '',
                    ]
                      .filter(Boolean)
                      .join(' · ')}
                  </div>
                  <div
                    style={{
                      fontSize: 'calc(12.5px * var(--text-scale, 1))',
                      marginTop: 7,
                      lineHeight: 1.5,
                      textWrap: 'pretty',
                    }}
                  >
                    {nextMove(l, now)}
                  </div>

                  <div style={{ display: 'flex', gap: 6, marginTop: 10, flexWrap: 'wrap' }}>
                    {ASKS.map((a) => (
                      <button
                        key={a.id}
                        type="button"
                        className="bare tappable"
                        aria-pressed={l.stage === a.id}
                        onClick={() =>
                          dispatch({
                            type: 'patchLetter',
                            id: l.id,
                            // Asking stamps the day, so the notice figure is a
                            // fact rather than something to remember later.
                            patch:
                              a.id === 'asked' && !l.askedOn
                                ? { stage: a.id, askedOn: new Date(now).toISOString().slice(0, 10) }
                                : { stage: a.id },
                          })
                        }
                        style={{
                          width: 'auto',
                          padding: '6px 10px',
                          borderRadius: 'var(--r-sm)',
                          border: `1px solid ${l.stage === a.id ? 'var(--app-accent)' : 'var(--app-line)'}`,
                          fontSize: 'calc(11px * var(--text-scale, 1))',
                        }}
                      >
                        {a.label}
                      </button>
                    ))}
                  </div>
                  <div style={{ display: 'flex', gap: 6, marginTop: 8, flexWrap: 'wrap' }}>
                    <Toggle
                      on={l.sentMaterials}
                      label="Sent them what they need"
                      onClick={() =>
                        dispatch({ type: 'patchLetter', id: l.id, patch: { sentMaterials: !l.sentMaterials } })
                      }
                    />
                    <Toggle
                      on={l.thanked}
                      label="Thanked"
                      onClick={() => dispatch({ type: 'patchLetter', id: l.id, patch: { thanked: !l.thanked } })}
                    />
                    <button
                      type="button"
                      className="bare"
                      onClick={() => dispatch({ type: 'dropLetter', id: l.id })}
                      style={{ width: 'auto', padding: '6px 10px', fontSize: 'calc(11px * var(--text-scale, 1))', opacity: 0.5 }}
                    >
                      Remove
                    </button>
                  </div>
                </Blueprint>
              );
            })}
          </div>
        </>
      ) : null}

      <p
        style={{
          fontSize: 'calc(11.5px * var(--text-scale, 1))',
          opacity: 0.55,
          marginTop: 22,
          lineHeight: 1.55,
          textWrap: 'pretty',
        }}
      >
        {NOTICE} days is what most letter-writers ask for. It is a convention rather than a
        rule — some want a month, some are happy with ten days, and somebody you have worked
        with for two years is a different case from somebody whose lecture you attended.
      </p>
    </>
  );
}

function Toggle({ on, label, onClick }: { on: boolean; label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      className="bare tappable"
      aria-pressed={on}
      onClick={onClick}
      style={{
        width: 'auto',
        padding: '6px 10px',
        borderRadius: 'var(--r-sm)',
        border: `1px solid ${on ? 'var(--app-accent)' : 'var(--app-line)'}`,
        fontSize: 'calc(11px * var(--text-scale, 1))',
      }}
    >
      {on ? `✓ ${label}` : label}
    </button>
  );
}
