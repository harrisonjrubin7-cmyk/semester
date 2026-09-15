import { useState } from 'react';
import { useStore } from '../state/store';
import { useRowStyle } from '../components/shell/useShell';
import { Blueprint } from '../components/Blueprint';
import { Meter, SectionLabel } from '../components/ui';
import { key, needCaveat, needFor, reaches, standing } from '../lib/grades';
import { NO_POLICY, pointsOff, rate, tally } from '../lib/attend';
import { PiecesRow } from '../components/PiecesRow';
import { against, forCourse, trend, trendLine, type Sitting } from '../lib/sitting';
import { projectGrade, projectionLine } from '../lib/worth';
import { NO_CUTOFFS, letterFor, systemFor, targetsOf } from '../lib/cutoffs';
import { Cutoffs } from '../components/Cutoffs';
import { ScoreField } from '../components/ScoreField';
import { Folding } from '../components/Fold';

/**
 * What you have, and what the rest has to be.
 *
 * The grading table was already in the app, shown read-only under each course.
 * That answers "how is this marked" and not the question anybody actually asks
 * in week ten, which is what they need on the final. Type what you have and
 * the arithmetic is done — including when the answer is that an A is no longer
 * reachable, which is worth knowing in October rather than December.
 */
/**
 * Rendered by the Courses switcher, which supplies the page, the padding and
 * the empty-state guard. There is no standalone path: see the note at the foot
 * of this file.
 */
export function Grades() {
  const { state, dispatch, catalog, school, tint } = useStore();
  // The hairline this row wears, in whichever layout is on. Spread rather
  // than wrapped so the row keeps its own insides. See `useRowStyle`.
  const rowFlush = useRowStyle(0);

  const intro = (
    <>
      Weights come from each syllabus. Put in what you have so far — a percentage, 17/20, 17 out of
      20, or the letter you were given — and the rest is arithmetic.
    </>
  );

  const body = (shown: typeof catalog.courses) => (
    <>
      {shown.map((c) => {
        // Everything the projection now needs beyond the syllabus: the
        // absence penalty, attendance as a graded category, the individual
        // pieces inside a category and how many of them the course drops.
        const policy = state.attendPolicy[c.id] ?? NO_POLICY;
        // What earns an A here, and whether the app actually knows or is
        // assuming. See `lib/cutoffs.ts` — the two must not look alike.
        const { system, source } = systemFor(c.id, state.gradeSystems, school);
        const targets = targetsOf(system);
        const t = tally(state.attendance, c.id);
        const s = standing(c, state.grades, {
          pieces: state.pieces,
          drops: state.drops,
          pointsOff: pointsOff(policy, t),
          attendance: { worth: policy.worth, rate: rate(t) },
        });
        return (
          <div key={c.id}>
            <Folding name="body">
            <SectionLabel style={{ margin: '26px 0 8px' }}>{c.code}</SectionLabel>

            <Blueprint style={{ padding: 15, background: 'var(--app-hero)' }}>
              <div className="kicker">
                {s.current === null ? 'Nothing graded yet' : `Across ${Math.round(s.counted)}% of the grade`}
              </div>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 'var(--sp-5)', marginTop: 'var(--sp-3)' }}>
                <div className="chrome-text" style={{ fontSize: 'calc(34px * var(--text-scale, 1))', lineHeight: 1 }}>
                  {s.current === null ? '—' : `${Math.round(s.current)}%`}
                  {/* The letter beside the number, where the scale in force
                      has cutoffs to read it against. The line under the
                      targets below says whose cutoffs those are. */}
                  {s.current !== null && letterFor(s.current, system) ? (
                    <span style={{ fontSize: 'calc(17px * var(--text-scale, 1))', color: 'var(--app-dim)', marginLeft: 'var(--sp-4)' }}>
                      {letterFor(s.current, system)}
                    </span>
                  ) : null}
                </div>
                {/*
                  Nothing where nothing could be weighted.

                  `remaining` is `total - counted`, so it is nought in two
                  quite different situations: every weighted row has a score,
                  and *no row is weighted at all*. The second is an ordinary
                  state — a syllabus stating points beside a row nobody can
                  read a figure from is refused by `asWeights` rather than
                  converted on a guess — and it was printing "Everything is
                  in" beside "Nothing graded yet", on a card whose own rows
                  showed two of four with no score. Seen on CORE 2500: eight
                  quizzes and thirteen reflections entered, a final reflection
                  and an attendance row empty, and the summary claiming the
                  course was finished.
                  Saying nothing is the honest answer: the paragraph under
                  this already explains that the weights add to 0% and which
                  rows could not be read, and a second line contradicting the
                  first is worse than one line fewer.
                */}
                {s.counted > 0 || s.remaining > 0 ? (
                  <div style={{ fontSize: 'calc(12.5px * var(--text-scale, 1))', color: 'var(--app-dim)' }}>
                    {s.remaining > 0
                      ? `${Math.round(s.remaining)}% still to play for`
                      : 'Everything is in'}
                  </div>
                ) : null}
              </div>
              {s.current !== null && (
                <div style={{ marginTop: 'var(--sp-5)' }}>
                  {/* The grade itself is printed above, with its letter. */}
                  <Meter pct={Math.min(100, Math.round(s.current))} fill={tint(c.id).fill} label={null} />
                </div>
              )}
              {s.extraCredit > 0 && (
                <div style={{ fontSize: 'var(--type-sm)', color: 'var(--app-dim)', marginTop: 'var(--sp-4)' }}>
                  Plus {s.extraCredit.toFixed(1)} points of extra credit.
                </div>
              )}
              {/* Where the term lands if the rest goes like the graded part.
                  A band rather than a number, because four quizzes out of
                  eight at 84 does not mean 84 — and never a probability, which
                  would need a model of the student, the course and the marking
                  and the app has none of the three. */}
              <div
                style={{
                  fontSize: 'calc(12.5px * var(--text-scale, 1))',
                  color: 'var(--app-dim)',
                  marginTop: 'var(--sp-5)',
                  lineHeight: 'var(--leading-relaxed)',
                  textWrap: 'pretty',
                }}
              >
                {projectionLine(
                  projectGrade(
                    s,
                    s.rows
                      .map((r) => r.score)
                      .filter((n): n is number => typeof n === 'number'),
                  ),
                )}
              </div>
              {needCaveat(s) ? (
                <div style={{ fontSize: 'calc(11.5px * var(--text-scale, 1))', color: 'var(--app-dim)', marginTop: 'var(--sp-4)', lineHeight: 'var(--leading-normal)' }}>
                  {/* Names the number the weights actually add to. "Do not add
                      to 100" leaves the student to work out by how much, from
                      a table they cannot easily sum in their head. */}
                  {needCaveat(s)} Rows the app could not read a weight from are marked below.
                </div>
              ) : null}
            </Blueprint>

            {s.rows
              // The index is the grade's key, so it comes from the row's
              // position in the course's own list and nothing may renumber it.
              .map((r, i) => (
              <div key={r.what} style={rowFlush}>
              <div
                style={{
                  display: 'flex',
                  gap: 'var(--sp-6)',
                  alignItems: 'center',
                  padding: '11px 0',
                }}
              >
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 'var(--type-md)', lineHeight: 'var(--leading-tight)' }}>{r.what}</div>
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
                    {r.pct}
                    {r.weight === null ? ' · not weighted' : r.extra ? ' · extra credit' : ''}
                  </div>
                </div>
                <ScoreField
                  value={state.grades[key(c.id, i)] ?? ''}
                  onChange={(value) => dispatch({ type: 'setGrade', key: key(c.id, i), value })}
                  system={system}
                  assumed={source === 'assumed'}
                  label={`Your score for ${r.what} in ${c.code}`}
                />
              </div>
              {/* The attendance row is appended by `standing` past the end of
                  the syllabus's own categories, and is computed from the log
                  rather than typed — so it gets no pieces row. Keyed on the
                  index rather than the name, because a syllabus with a real
                  category called "Attendance" is not this. */}
              {i < c.grading.length && r.weight !== null ? (
                <PiecesRow gradeKey={key(c.id, i)} what={r.what} />
              ) : null}
              </div>
            ))}

            {s.remaining > 0 && s.counted > 0 && (
              <>
                <div
                  style={{
                    fontSize: 'var(--type-xs)',
                    color: 'var(--app-dim)',
                    margin: '14px 0 6px',
                    fontFamily: 'var(--font-heading)',
                    letterSpacing: '0.12em',
                    textTransform: 'uppercase',
                  }}
                >
                  To finish with, you need
                </div>
                {targets.length === 0 && (
                  <div style={{ fontSize: 'var(--type-sm)', color: 'var(--app-dim)', lineHeight: 'var(--leading-relaxed)', textWrap: 'pretty' }}>
                    {NO_CUTOFFS}
                  </div>
                )}
                {reaches(s, targets).map((t) => {
                  if (t.need === null) return null;
                  // `reachFor` decides what the number means; this only draws
                  // it. The old test here was `need > 100`, which showed a
                  // required average of 98.5% as an ordinary target — it is
                  // arithmetically available and it is not a plan.
                  const impossible = t.reach === 'unreachable';
                  return (
                    <div
                      key={t.label}
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'baseline',
                        padding: '8px 0',
                        borderBottom: '1px solid var(--app-line-soft)',
                        opacity: impossible ? 0.45 : 1,
                      }}
                    >
                      <span style={{ fontFamily: 'var(--font-heading)', fontSize: 'var(--type-lg)' }}>
                        {t.label}
                        <span style={{ fontSize: 'var(--type-xs)', color: 'var(--app-dim)' }}> · {t.target}%</span>
                      </span>
                      <span
                        style={{
                          fontSize: 'calc(13.5px * var(--text-scale, 1))',
                          textAlign: 'right',
                          maxWidth: '62%',
                          lineHeight: 1.4,
                          color: t.reach === 'hard' ? 'var(--app-warn)' : undefined,
                        }}
                      >
                        {t.says}
                      </span>
                    </div>
                  );
                })}
              </>
            )}

            {/*
              Outside the targets block on purpose.

              The hero names a letter, and a letter is only as true as the
              cutoff behind it. If this sat inside the block above it would
              disappear for a course with nothing graded yet and for one where
              everything is in — leaving a letter on the screen with nothing
              anywhere saying whose numbers produced it, which is the failure
              `lib/cutoffs.ts` exists to prevent.
            */}
            <Cutoffs courseId={c.id} code={c.code} />

            {/*
              Practice, beside the projection and deliberately not inside it.
              The projection is arithmetic on weights a syllabus states; a
              practice score is evidence about you. Averaging the two makes a
              number that is neither, and it would be the number people quote.
            */}
            {(() => {
              const sat = forCourse(state.sittings, c.id);
              if (sat.length === 0) return null;
              const t = trend(sat);
              const target = s.remaining > 0 && s.counted > 0 ? needFor(s, 90) : null;
              return (
                <div style={{ marginTop: 'var(--sp-7)' }}>
                  <div
                    style={{
                      fontSize: 'var(--type-xs)',
                      color: 'var(--app-dim)',
                      marginBottom: 'var(--sp-3)',
                      fontFamily: 'var(--font-heading)',
                      letterSpacing: '0.12em',
                      textTransform: 'uppercase',
                    }}
                  >
                    On practice papers
                  </div>
                  <div style={{ fontSize: 'calc(13.5px * var(--text-scale, 1))', lineHeight: 'var(--leading-relaxed)', textWrap: 'pretty' }}>
                    {trendLine(t, sat)}
                  </div>
                  {target !== null && t.papers > 0 ? (
                    <div style={{ fontSize: 'var(--type-sm)', color: 'var(--app-dim)', marginTop: 5, lineHeight: 'var(--leading-normal)' }}>
                      {against(t.average, target)}
                    </div>
                  ) : null}
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--sp-3)', marginTop: 9 }}>
                    {sat.slice(0, 6).map((paper) => (
                      <PaperTag key={paper.id} paper={paper} />
                    ))}
                  </div>
                  {t.missed > 0 && (
                    <button
                      type="button"
                      className="btn btn-secondary btn-block"
                      onClick={() => dispatch({ type: 'go', screen: 'exam' })}
                      style={{ height: 40, marginTop: 'var(--sp-5)' }}
                    >
                      Sit another
                    </button>
                  )}
                </div>
              );
            })()}
            </Folding>
          </div>
        );
      })}

      <div style={{ fontSize: 'calc(11.5px * var(--text-scale, 1))', color: 'var(--app-dim)', marginTop: 22, lineHeight: 'var(--leading-relaxed)' }}>
        This is your own arithmetic, not a gradebook — nothing here is read from Brightspace, and
        nothing is sent anywhere. A syllabus that drops your lowest score, curves, or rounds will
        not match exactly.
      </div>
    </>
  );

  /*
   * One caller, one frame.
   *
   * There were two: this as a screen with its own `<Page>`, and this as the
   * Grades tab of Courses, which needed a second render path with no `<Page>`
   * of its own since that screen had already drawn the frame. The same table
   * twice, so "what do I need on the final" had two homes and the directory
   * pointed at the one nobody was on.
   *
   * Courses is where it lives — a view of the same four courses, next to the
   * courses themselves and to what they are asking of you — so this draws the
   * panel and never the frame. There is no prop to choose between them, which
   * is what `lib/onehome.test.ts` is watching for.
   *
   * The trailing spacer belongs to whoever owns the frame, which is why
   * `Courses` passes `bottom={0}` and it is written by hand here.
   */
  return (
    <div>
      <div style={{ fontSize: 'var(--type-base)', color: 'var(--app-dim)', lineHeight: 'var(--leading-relaxed)', textWrap: 'pretty' }}>
        {intro}
      </div>
      {body(catalog.courses)}
      <div style={{ height: 22 }} />
    </div>
  );
}

/**
 * One practice paper's score, and the way to take it back.
 *
 * `keepSitting` shipped and `dropSitting` sat in the reducer with nothing
 * dispatching it, so a sitting could be recorded and never removed. That is
 * worse here than a stray row usually is, because of what a sitting feeds:
 * `trend` averages them into the line above ("you are averaging 74% across
 * four papers"), `against` compares that to the mark the rest of the term
 * needs, and the drill deck is built from the questions they say you missed.
 * A paper abandoned after two questions, or sat twice by a double tap, or sat
 * on a phone on a bus, drags all three — and `lib/sitting.ts` opens by saying
 * the trend is the useful part.
 *
 * ## Two presses, in place
 *
 * A single tap on a small tag is the accident `Mine.tsx` keeps destructive
 * controls inside an opened editor to avoid, and a full editor for a number
 * you cannot edit would be a drawer with one button in it. So the tag arms
 * first and removes second, and says which it is doing. Arming is per tag and
 * exclusive by construction — each tag holds its own flag, and a tag that is
 * armed and then not pressed stays armed only until the next render that
 * replaces it.
 */
function PaperTag({ paper }: { paper: Sitting }) {
  const { dispatch } = useStore();
  const [armed, setArmed] = useState(false);
  const when = new Date(paper.at).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });

  return (
    <button
      type="button"
      className="tag tag-outline"
      onClick={() => {
        if (!armed) {
          setArmed(true);
          return;
        }
        dispatch({ type: 'dropSitting', id: paper.id });
      }}
      onBlur={() => setArmed(false)}
      aria-label={
        armed
          ? `Remove the ${paper.pct}% paper from ${when}. Press again to confirm.`
          : `${paper.pct}% on ${when}. Press to remove it.`
      }
      style={{
        fontVariantNumeric: 'tabular-nums',
        cursor: 'pointer',
        borderColor: armed ? 'var(--app-warn-line)' : undefined,
        background: armed ? 'var(--app-warn-wash)' : undefined,
      }}
    >
      {armed ? (
        'Remove?'
      ) : (
        <>
          {paper.pct}%<span style={{ color: 'var(--app-dim)' }}> · {when}</span>
        </>
      )}
    </button>
  );
}
