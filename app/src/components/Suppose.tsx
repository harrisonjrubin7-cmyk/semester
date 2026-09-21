import { useMemo, useState } from 'react';
import { useStore } from '../state/store';
import { Blueprint } from './Blueprint';
import { SectionLabel } from './ui';
import { ScoreField } from './ScoreField';
import { Folding } from './Fold';
import { targetsOf, type GradeSystem, type Source } from '../lib/cutoffs';
import { key, type Extras } from '../lib/grades';
import { hoursAWeek } from '../lib/windows';
import {
  runwayLine,
  supposing,
  swing,
  swingLine,
  thenNeedsLine,
  type Supposed,
} from '../lib/whatif';
import type { Course } from '../lib/types';

/**
 * A grade you have not got yet, tried on.
 *
 * The block above this says where you stand and what everything left has to
 * average for an A. Both are true, and neither is the question a student
 * types into a calculator at midnight, which is the other way round: *if I
 * get an 88 on the final, what does that make my grade?*
 *
 * ## Nothing typed here is a mark
 *
 * The fields hold their values in this component and nowhere else. Not in
 * `state.grades`, which is the point: a supposition written there would sync,
 * feed the projection on Today, count toward the term GPA, and a 95 typed
 * into the final in October to cheer yourself up would still be there in
 * December with the app agreeing. Local state is what makes "this is not a
 * record" true rather than merely promised — there is no reducer that could
 * be called by mistake and no key in storage to leak.
 *
 * The cost is honest and small: leave the screen and the supposition is gone.
 * That is the right way round for a scratch calculation, and the line under
 * the heading says so rather than letting somebody find out.
 *
 * ## The two things it refuses to be quiet about
 *
 * A supposition laid over a mark already on record, and a supposition that
 * could not be read as a score at all. Both produce a plausible-looking
 * number on screen — the first a grade built on a mark the student does not
 * have, the second a grade that simply did not move — and `lib/whatif.ts`
 * hands back both lists by name so this can say which rows.
 */
export function Suppose({
  course,
  extras,
  system,
  source,
  daysToTest,
}: {
  course: Course;
  extras: Extras;
  system: GradeSystem;
  source: Source;
  /** Days to this course's next exam, or null where it has none scheduled. */
  daysToTest: number | null;
}) {
  const { state } = useStore();
  const [supposed, setSupposed] = useState<Supposed>({});

  const s = useMemo(
    () => swing(course, state.grades, supposed, extras, system),
    [course, state.grades, supposed, extras, system],
  );

  // Only rows the course can actually weight. A field on a row `asWeights`
  // refused would take a number and move nothing, which is the shape of a
  // broken feature even though every part of it is behaving.
  const rows = course.grading
    .map((g, i) => ({ g, i, k: key(course.id, i), weight: s.now.rows[i]?.weight ?? null }))
    .filter((r) => r.weight !== null);

  if (rows.length === 0) return null;

  const tried = supposing(s);
  const targets = targetsOf(system);
  const needs = tried
    ? targets.map((t) => thenNeedsLine(s, t.at, t.label)).filter((line) => line !== '')
    : [];
  const runway = tried ? runwayLine(daysToTest, hoursAWeek(state.windows)) : '';

  return (
    <div style={{ marginTop: 'var(--sp-7)' }}>
      <Folding name="suppose">
        <SectionLabel
          style={{ marginBlock: '0 var(--sp-2)' }}
          aside={
            tried ? (
              <button
                type="button"
                className="btn"
                onClick={() => setSupposed({})}
                style={{ fontSize: 'var(--type-xs)' }}
              >
                Clear
              </button>
            ) : undefined
          }
        >
          Suppose
        </SectionLabel>
        <div
          style={{
            fontSize: 'var(--type-sm)',
            color: 'var(--app-dim)',
            marginBottom: 'var(--sp-5)',
            lineHeight: 'var(--leading-relaxed)',
            textWrap: 'pretty',
          }}
        >
          Try a score you have not got yet and see what it would make the grade. Nothing here is
          saved or counted anywhere — it is gone when you leave the screen.
        </div>

        {rows.map(({ g, i, k }) => (
          <div
            key={g.what}
            style={{
              display: 'flex',
              gap: 'var(--sp-6)',
              alignItems: 'center',
              paddingBlock: 'var(--sp-4)',
              borderBottom: '1px solid var(--app-line-soft)',
            }}
          >
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 'var(--type-md)', lineHeight: 'var(--leading-tight)' }}>
                {g.what}
              </div>
              <div
                style={{
                  fontSize: 'var(--type-xs)',
                  color: 'var(--app-dim)',
                  marginTop: 'var(--sp-1)',
                  fontFamily: 'var(--font-heading)',
                  letterSpacing: '0.1em',
                  textTransform: 'uppercase',
                }}
              >
                {/* What is on record for this row, so the box beside it is
                    plainly a second, different thing rather than a duplicate
                    of the grade field above. */}
                {s.now.rows[i]?.score === null || s.now.rows[i]?.score === undefined
                  ? 'Nothing on record'
                  : `${Math.round(s.now.rows[i].score as number)}% on record`}
              </div>
            </div>
            <ScoreField
              value={supposed[k] ?? ''}
              onChange={(value) => setSupposed((prev) => ({ ...prev, [k]: value }))}
              system={system}
              assumed={source === 'assumed'}
              label={`Suppose a score for ${g.what} in ${course.code}`}
            />
          </div>
        ))}

        {tried && (
          <Blueprint style={{ padding: 'var(--sp-7)', marginTop: 'var(--sp-6)', background: 'var(--app-hero)' }}>
            <div
              className="chrome-text"
              style={{
                fontSize: 'var(--type-lg)',
                lineHeight: 'var(--leading-tight)',
                textWrap: 'pretty',
              }}
            >
              {swingLine(s)}
            </div>

            {needs.length > 0 && (
              <div style={{ marginTop: 'var(--sp-5)' }}>
                {needs.map((line) => (
                  <div
                    key={line}
                    style={{
                      fontSize: 'var(--type-base)',
                      color: 'var(--app-dim)',
                      lineHeight: 'var(--leading-relaxed)',
                      textWrap: 'pretty',
                    }}
                  >
                    {line}
                  </div>
                ))}
              </div>
            )}

            {runway ? (
              <div
                style={{
                  fontSize: 'var(--type-sm)',
                  color: 'var(--app-dim)',
                  marginTop: 'var(--sp-4)',
                  lineHeight: 'var(--leading-relaxed)',
                  textWrap: 'pretty',
                }}
              >
                {runway}
              </div>
            ) : null}

            {/* The two the file refuses to be quiet about. Warn-coloured
                rather than dim: each one means the number above is not what
                it looks like, which is not a footnote. */}
            {s.over.length > 0 && (
              <div
                style={{
                  fontSize: 'var(--type-sm)',
                  color: 'var(--app-warn)',
                  marginTop: 'var(--sp-4)',
                  lineHeight: 'var(--leading-relaxed)',
                  textWrap: 'pretty',
                }}
              >
                Supposing over a mark you already have on {list(s.over)}. That number is not your
                grade — it is the grade you would have had.
              </div>
            )}

            {s.unreadable.length > 0 && (
              <div
                style={{
                  fontSize: 'var(--type-sm)',
                  color: 'var(--app-warn)',
                  marginTop: 'var(--sp-4)',
                  lineHeight: 'var(--leading-relaxed)',
                  textWrap: 'pretty',
                }}
              >
                Nothing was read from what you put against {list(s.unreadable)}, so{' '}
                {s.unreadable.length === 1 ? 'it has' : 'they have'} not moved anything. A number, a
                percentage, 17/20, or a letter.
              </div>
            )}
          </Blueprint>
        )}
      </Folding>
    </div>
  );
}

/** "the midterm", "the midterm and the final", "a, b and c". */
function list(names: string[]): string {
  if (names.length === 1) return names[0];
  return `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`;
}
