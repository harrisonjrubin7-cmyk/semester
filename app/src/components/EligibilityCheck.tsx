import { useState } from 'react';
import { useStore } from '../state/store';
import { secondLine } from '../lib/dim';
import { SectionLabel } from './ui';
import { NotOfficial } from './NotOfficial';
import { ATHLETICS_LIMITS, type AthleticsLibrary } from '../lib/athletics';
import { progress, progressLine, type Requirement } from '../lib/degree';

/**
 * What is left, as you were told it.
 *
 * The Degree screen's argument, applied to the other set of requirements a
 * student-athlete has to satisfy: `lib/degree.ts` will not ship a list of
 * AXLE categories or a major template, because requirements belong to a
 * university, a college and a catalogue year, they change, and a student
 * reading a confidently wrong list finds out in their final year when nothing
 * can be done. Continuing-eligibility rules are that argument with the volume
 * up — they differ by division, by conference, by sport and by the year a
 * student entered, an athletics department has people whose whole job is
 * knowing them, and the cost of being wrong is a season.
 *
 * So there is no built-in list here either, and there will not be one. What
 * there is is a place to put the requirements *your* compliance office gave
 * you, in their words, and the arithmetic done against the courses you have
 * already recorded.
 *
 * ## It is the Degree screen's arithmetic, not a copy of it
 *
 * `Requirement` and `progress` are imported from `lib/degree.ts`, and the
 * courses counted are `state.taken` — the same transcript the Degree screen
 * reads. Two consequences, both wanted: a course recorded once counts in both
 * places, and "in progress is not done" is enforced here by the same code that
 * enforces it there. A second implementation would have been a second set of
 * rounding decisions about somebody's eligibility.
 *
 * The one thing not borrowed is the store. A degree is account data and syncs;
 * this lives in the Athletics device library with the rest of this workspace.
 */
export function EligibilityCheck({
  value,
  update,
  blocked,
}: {
  value: AthleticsLibrary;
  update: (change: (old: AthleticsLibrary) => AthleticsLibrary) => boolean;
  blocked: boolean;
}) {
  const { state, dispatch } = useStore();

  const [programme, setProgramme] = useState('');
  const [name, setName] = useState('');
  const [need, setNeed] = useState<'courses' | 'hours'>('hours');
  const [count, setCount] = useState('');
  const [accepts, setAccepts] = useState('');
  const [note, setNote] = useState('');
  const [said, setSaid] = useState('');

  const line = {
    fontSize: 'var(--type-sm)',
    ...secondLine(),
    lineHeight: 'var(--leading-normal)',
    textWrap: 'pretty',
  } as const;

  const add = () => {
    if (!name.trim()) {
      setSaid('Give the requirement a name — whatever your compliance office calls it.');
      return;
    }
    if (value.eligibility.length >= ATHLETICS_LIMITS.eligibility) {
      setSaid(`That is ${ATHLETICS_LIMITS.eligibility} requirements, which is as many as this holds.`);
      return;
    }
    const req: Requirement = {
      id: crypto.randomUUID(),
      programme: programme.trim() || 'Eligibility',
      name: name.trim(),
      need,
      count: Math.max(1, Math.round(Number(count) || 1)),
      accepts: accepts
        .split(',')
        .map((a) => a.trim())
        .filter(Boolean),
      note: note.trim(),
    };
    if (update((old) => ({ ...old, eligibility: [...old.eligibility, req] }))) {
      setName('');
      setCount('');
      setAccepts('');
      setNote('');
      setSaid('Added. It counts the courses you have recorded under The degree.');
    }
  };

  return (
    <>
      <NotOfficial>
        These are requirements you entered and courses you recorded. The app has no list of
        eligibility rules and does not check one — nothing here is a determination that you are
        eligible, or that you are not.
      </NotOfficial>

      {state.taken.length === 0 && (
        <p style={{ ...line, marginBlock: 0 }}>
          No courses recorded yet, so every requirement below will read as nothing done. They are
          entered once under{' '}
          <button
            type="button"
            className="bare tappable"
            onClick={() => dispatch({ type: 'go', screen: 'degree' })}
            /* `.bare` is width:100%, which would put this on a line of its own. */
            style={{ textDecoration: 'underline', display: 'inline', width: 'auto' }}
          >
            The degree
          </button>
          , and count in both places.
        </p>
      )}

      <SectionLabel
        aside={`${state.taken.length} recorded`}
        style={{ marginBlock: 'var(--sp-6) var(--sp-3)' }}
      >
        What you were told is required
      </SectionLabel>

      {value.eligibility.length === 0 ? (
        <p style={{ fontSize: 'var(--type-base)', ...secondLine(), lineHeight: 'var(--leading-normal)', textWrap: 'pretty' }}>
          Nothing entered. Copy the lines from whatever your compliance office gave you — credit
          hours a year, hours before the second year, percentage of the degree by each year — in
          their words, and the counting is done against your own record.
        </p>
      ) : (
        value.eligibility.map((req) => {
          const p = progress(req, state.taken);
          return (
            <div
              key={req.id}
              style={{ borderBottom: '1px solid var(--app-line)', paddingBlock: 'var(--sp-4)' }}
            >
              <p
                style={{
                  fontSize: 'var(--type-base)',
                  lineHeight: 'var(--leading-normal)',
                  marginBlock: 0,
                  textWrap: 'pretty',
                }}
              >
                {req.name}
                {req.programme ? ` · ${req.programme}` : ''}
              </p>
              <p style={{ ...line, marginBlock: 'var(--sp-2) 0' }}>{progressLine(p)}</p>
              {req.note && <p style={{ ...line, marginBlock: 'var(--sp-2) 0' }}>{req.note}</p>}
              <button
                type="button"
                className="bare tappable"
                onClick={() =>
                  update((old) => ({ ...old, eligibility: old.eligibility.filter((r) => r.id !== req.id) }))
                }
                style={{
                  textDecoration: 'underline',
                  fontSize: 'var(--type-sm)',
                  marginTop: 'var(--sp-2)',
                  width: 'auto',
                }}
              >
                Remove
              </button>
            </div>
          );
        })
      )}

      <SectionLabel style={{ marginBlock: 'var(--sp-7) var(--sp-3)' }}>Add one</SectionLabel>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          add();
        }}
      >
        <fieldset disabled={blocked} style={{ border: 0, padding: 0, minWidth: 0 }}>
          <label style={{ display: 'block', marginBottom: 'var(--sp-5)' }}>
            <span style={{ fontSize: 'var(--type-sm)', ...secondLine() }}>
              Requirement, in their words
            </span>
            <input
              className="input"
              required
              maxLength={200}
              placeholder="e.g. Credit hours earned in the academic year"
              value={name}
              onChange={(e) => setName(e.target.value)}
              style={{ width: '100%', marginTop: 'var(--sp-2)' }}
            />
          </label>
          <label style={{ display: 'block', marginBottom: 'var(--sp-5)' }}>
            <span style={{ fontSize: 'var(--type-sm)', ...secondLine() }}>Who set it</span>
            <input
              className="input"
              maxLength={200}
              placeholder="e.g. Compliance office, 14 Aug"
              value={programme}
              onChange={(e) => setProgramme(e.target.value)}
              style={{ width: '100%', marginTop: 'var(--sp-2)' }}
            />
          </label>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--sp-4)' }}>
            <label style={{ flex: '1 1 140px' }}>
              <span style={{ fontSize: 'var(--type-sm)', ...secondLine() }}>Counted in</span>
              <select
                className="input"
                value={need}
                onChange={(e) => setNeed(e.target.value as 'courses' | 'hours')}
                style={{ width: '100%', marginTop: 'var(--sp-2)' }}
              >
                <option value="hours">Credit hours</option>
                <option value="courses">Courses</option>
              </select>
            </label>
            <label style={{ flex: '1 1 100px' }}>
              <span style={{ fontSize: 'var(--type-sm)', ...secondLine() }}>How many</span>
              <input
                className="input"
                type="number"
                min="1"
                step="1"
                value={count}
                onChange={(e) => setCount(e.target.value)}
                style={{ width: '100%', marginTop: 'var(--sp-2)' }}
              />
            </label>
          </div>
          <label style={{ display: 'block', marginBlock: 'var(--sp-5)' }}>
            <span style={{ fontSize: 'var(--type-sm)', ...secondLine() }}>
              Which courses count, comma separated — blank means any
            </span>
            <input
              className="input"
              maxLength={500}
              placeholder="e.g. ECON, PSCI 1104"
              value={accepts}
              onChange={(e) => setAccepts(e.target.value)}
              style={{ width: '100%', marginTop: 'var(--sp-2)' }}
            />
          </label>
          <label style={{ display: 'block', marginBottom: 'var(--sp-5)' }}>
            <span style={{ fontSize: 'var(--type-sm)', ...secondLine() }}>
              Note — where this came from, and when
            </span>
            <input
              className="input"
              maxLength={500}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              style={{ width: '100%', marginTop: 'var(--sp-2)' }}
            />
          </label>
          <button type="submit" className="btn btn-primary btn-block">
            Add requirement
          </button>
        </fieldset>
      </form>

      {said && (
        <p
          role="status"
          style={{
            fontSize: 'var(--type-base)',
            lineHeight: 'var(--leading-normal)',
            marginTop: 'var(--sp-4)',
            textWrap: 'pretty',
          }}
        >
          {said}
        </p>
      )}
    </>
  );
}
