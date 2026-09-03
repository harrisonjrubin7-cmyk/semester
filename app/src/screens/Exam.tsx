import { useEffect, useMemo, useRef, useState } from 'react';
import { useStore } from '../state/store';
import { useLive } from '../lib/live';
import { Blueprint } from '../components/Blueprint';
import { SectionLabel, Segmented } from '../components/ui';
import { PrintButton } from '../components/PrintButton';
import { ask, configured } from '../lib/claude';
import { download } from '../lib/deliver';
import { cardsFrom, missedFrom, pctOf } from '../lib/sitting';
import {
  FORMATS,
  SYSTEM,
  brief,
  clock,
  examFileName,
  fromGuide,
  invite,
  letter,
  marksFor,
  paper,
  readExam,
  readSeed,
  result,
  seedCode,
  shapeFor,
  total,
  verdict,
  type Answer,
  type Question,
} from '../lib/exam';
import { UseSources, appendTo } from '../components/UseSources';

type Stage = 'setup' | 'sitting' | 'marking';

/**
 * A practice paper, sat and marked.
 *
 * The app already had a quiz — ten multiple-choice questions pulled from the
 * cards. That is a recall drill and it is nothing like an exam. An exam has a
 * shape, a total, a clock, and a key. All four are here, and the first three
 * are arithmetic done in `lib/exam.ts` rather than asked of a model, because a
 * model told to write a fifty-minute paper worth a hundred marks will hand
 * back nine questions worth ninety-six.
 *
 * Two doors, the free one first: a paper drawn from your own cards needs no
 * key and no network. What it cannot write is an essay question, because a
 * flashcard is not an argument — so the format list says so instead of
 * producing a bad one.
 *
 * Marking is split on purpose. Multiple choice is marked by the app. Written
 * answers are marked by you, against the key, in three grades. Scoring free
 * text automatically is a thing that can be done badly and cannot be done
 * well, and a practice paper that calls a right answer wrong is worse than no
 * practice paper. Self-marking also happens to be the part of revision that
 * teaches the most.
 */
export function Exam() {
  const { state, dispatch, catalog, account } = useStore();
  const { guide } = useLive(state.guideId);
  const course = catalog.byId[state.guideId];

  // The guide's Quiz mode can hand a shape over. Read once, on the way in.
  const preset = state.examPreset;
  const [source, setSource] = useState<'cards' | 'written'>('cards');
  const [formatId, setFormatId] = useState(preset?.formatId ?? FORMATS[0].id);
  const [minutes, setMinutes] = useState(preset?.minutes ?? 30);
  const [material, setMaterial] = useState('');
  const [about, setAbout] = useState('');
  const [topics, setTopics] = useState('');

  const [stage, setStage] = useState<Stage>('setup');
  const [title, setTitle] = useState('');
  // The seed the current paper was drawn with, so it can be sat again or
  // handed to somebody else. Empty for a paper a model wrote, which is not
  // reproducible from a number.
  const [seed, setSeed] = useState<number | null>(null);
  const [reuse, setReuse] = useState(state.examPreset?.code ?? '');
  const [questions, setQuestions] = useState<Question[]>([]);
  const [answers, setAnswers] = useState<Record<string, Answer>>({});
  const [left, setLeft] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const abort = useRef<AbortController | null>(null);

  const shape = useMemo(() => shapeFor(minutes, formatId), [minutes, formatId]);
  const missed = useMemo(() => missedFrom(questions, answers), [questions, answers]);
  const [kept, setKept] = useState<'no' | 'result' | 'cards' | 'both'>('no');

  // Dropped as soon as it has been read, so coming back later opens on your
  // own last choice rather than on what the quiz asked for an hour ago.
  useEffect(() => {
    if (preset) dispatch({ type: 'clearPaperPreset' });
  }, [preset, dispatch]);
  const marks = useMemo(() => result(questions, answers), [questions, answers]);

  // The clock. Stops at zero rather than going negative, and does not end the
  // paper on its own — a practice paper that snatches itself away is a paper
  // you stop sitting.
  useEffect(() => {
    if (stage !== 'sitting') return;
    const tick = setInterval(() => setLeft((n) => Math.max(0, n - 1)), 1000);
    return () => clearInterval(tick);
  }, [stage]);

  const begin = (list: Question[], named: string, drawnWith: number | null = null) => {
    setQuestions(list);
    setTitle(named);
    setSeed(drawnWith);
    setKept('no');
    setAnswers({});
    setLeft(minutes * 60);
    setStage('sitting');
    window.scrollTo(0, 0);
  };

  const fromCards = () => {
    // A code typed in reproduces that exact paper; nothing typed draws a new
    // one. The seed used to be Date.now(), so no paper could ever be sat twice
    // — not after revising, and not by two people in the same class.
    const asked = reuse.trim() ? readSeed(reuse) : null;
    if (reuse.trim() && asked === null) {
      setError(`"${reuse.trim()}" is not a paper code. They look like 7PS4.`);
      return;
    }
    const drawnWith = asked ?? (Date.now() % 90_000) + 10_000;
    const list = fromGuide(guide, shape, drawnWith);
    if (list.length === 0) {
      setError('This guide has no cards to build a paper from yet.');
      return;
    }
    setError('');
    begin(list, `${guide.code} · paper ${seedCode(drawnWith)}`, drawnWith);
  };

  const write = async () => {
    if (busy) return;
    setBusy(true);
    setError('');
    abort.current = new AbortController();
    let sofar = '';
    try {
      await ask({
        signal: abort.current.signal,
        maxTokens: 6000,
        think: true,
        system: SYSTEM,
        messages: [
          {
            role: 'user',
            content: brief({
              formatId,
              shape,
              course: course?.code ?? '',
              material,
              about,
              topics,
            }),
          },
        ],
        onText: (chunk) => {
          sofar += chunk;
        },
      });
      const read = readExam(sofar, shape);
      begin(read.questions, read.title);
    } catch (e) {
      if (!(e instanceof DOMException && e.name === 'AbortError')) {
        setError(e instanceof Error ? e.message : String(e));
      }
    } finally {
      setBusy(false);
    }
  };

  const say = (id: string, patch: Partial<Answer>) =>
    setAnswers((all) => {
      const before: Answer = all[id] ?? { given: '' };
      return { ...all, [id]: { ...before, ...patch } };
    });

  const document = () =>
    paper({ title, course: course?.code ?? '', minutes, questions });

  // ── Setup ─────────────────────────────────────────────────────────────

  if (stage === 'setup') {
    return (
      <div style={{ padding: 18 }}>
        <div style={{ fontSize: 12.5, opacity: 0.65, lineHeight: 1.5, textWrap: 'pretty' }}>
          A paper with a shape, a total and a clock — not another round of cards. The marks and
          the timing are worked out here; only the questions come from anywhere else.
        </div>

        <Segmented
          options={[
            { id: 'cards', label: 'From your cards' },
            { id: 'written', label: 'Written for you' },
          ]}
          value={source}
          onChange={setSource}
          style={{ marginTop: 14 }}
        />

        <SectionLabel>How long you have</SectionLabel>
        <Segmented
          options={[
            { id: '15', label: '15 min' },
            { id: '30', label: '30' },
            { id: '50', label: '50' },
            { id: '90', label: '90' },
          ]}
          value={String(minutes)}
          onChange={(next) => setMinutes(Number(next))}
        />

        <SectionLabel>What it looks like</SectionLabel>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
          {FORMATS.map((f) => {
            const on = f.id === formatId;
            // A flashcard is not an argument, so a paper drawn from cards
            // cannot carry an essay question. Said rather than silently ignored.
            const unavailable = source === 'cards' && f.mix.long > 0;
            return (
              <button
                key={f.id}
                type="button"
                className="bare tappable"
                aria-pressed={on}
                disabled={unavailable}
                onClick={() => setFormatId(f.id)}
                style={{
                  textAlign: 'left',
                  padding: '10px 12px',
                  borderRadius: 'var(--r-md)',
                  border: `1px solid ${on && !unavailable ? 'var(--app-accent-deep)' : 'var(--app-line)'}`,
                  background: on && !unavailable ? 'var(--app-accent-wash)' : 'transparent',
                  opacity: unavailable ? 0.4 : 1,
                }}
              >
                <span style={{ display: 'block', fontSize: 14 }}>{f.label}</span>
                <span style={{ display: 'block', fontSize: 11.5, opacity: 0.55, marginTop: 2 }}>
                  {unavailable ? 'Needs written questions — a flashcard is not an argument.' : f.blurb}
                </span>
              </button>
            );
          })}
        </div>

        <Blueprint style={{ padding: '12px 14px', marginTop: 14 }}>
          <div className="kicker">The paper</div>
          <div style={{ fontSize: 14, marginTop: 6, lineHeight: 1.5 }}>
            {[
              shape.counts.choice > 0 && `${shape.counts.choice} multiple choice`,
              shape.counts.short > 0 && `${shape.counts.short} short answer`,
              shape.counts.long > 0 && `${shape.counts.long} long answer`,
            ]
              .filter(Boolean)
              .join(', ')}
          </div>
          <div style={{ fontSize: 12, opacity: 0.55, marginTop: 5 }}>
            {shape.points} marks · {shape.minutes} minutes
          </div>
        </Blueprint>

        {source === 'written' && (
          <>
            <SectionLabel>The material it may use</SectionLabel>
            <textarea
              className="input"
              value={material}
              onChange={(e) => setMaterial(e.target.value)}
              placeholder="Your notes, the readings, the lecture. Every question has to come from what is in here."
              style={{ width: '100%', minHeight: 130, resize: 'vertical', lineHeight: 1.5 }}
            />

            <UseSources
              courseId={state.guideId}
              onFill={(lines) => setMaterial((now) => appendTo(now, lines))}
              label="readings"
            />

            <SectionLabel>Topics to cover</SectionLabel>
            <input
              className="input"
              value={topics}
              onChange={(e) => setTopics(e.target.value)}
              placeholder="Elasticity, surplus, price floors"
              style={{ width: '100%' }}
            />

            <SectionLabel>What the real exam is like</SectionLabel>
            <textarea
              className="input"
              value={about}
              onChange={(e) => setAbout(e.target.value)}
              placeholder="In class, closed book, one side of notes. Half multiple choice, one longer question."
              style={{ width: '100%', minHeight: 70, resize: 'vertical', lineHeight: 1.5 }}
            />
          </>
        )}

        {error ? (
          <div style={{ fontSize: 13, marginTop: 12, color: 'var(--app-warn)', lineHeight: 1.45 }}>
            {error}
          </div>
        ) : null}

        {source === 'cards' ? (
          <>
            <SectionLabel>Sit one you have sat before</SectionLabel>
            <input
              className="input"
              value={reuse}
              onChange={(e) => setReuse(e.target.value)}
              placeholder="Paper code — leave empty for a new one"
              style={{ width: '100%', textTransform: 'uppercase' }}
            />
            <div style={{ fontSize: 11.5, opacity: 0.5, marginTop: 6, lineHeight: 1.45 }}>
              Every paper drawn from cards has a code. Enter one to get the same questions back —
              after revising, or because somebody in your class read theirs out.
            </div>

            <button
              type="button"
              className="btn btn-primary btn-block"
              onClick={fromCards}
              style={{
                height: 46,
                marginTop: 16,
                letterSpacing: '0.1em',
                textTransform: 'uppercase',
              }}
            >
              Sit it
            </button>
            <div style={{ fontSize: 11.5, opacity: 0.5, marginTop: 8, lineHeight: 1.45 }}>
              Built from {guide.code}'s own cards — no key needed, nothing invented, works
              offline. Switch course from Study. For the same questions marked one at a time as
              you answer, the guide's Quiz mode is the other half of this.
            </div>
          </>
        ) : configured() ? (
          <button
            type="button"
            className="btn btn-primary btn-block"
            onClick={() => void write()}
            disabled={busy}
            style={{ height: 46, marginTop: 16, letterSpacing: '0.1em', textTransform: 'uppercase' }}
          >
            {busy ? 'Writing the paper…' : 'Write the paper'}
          </button>
        ) : (
          <div style={{ fontSize: 12.5, opacity: 0.6, marginTop: 16, lineHeight: 1.5 }}>
            Needs a key first — set one under Ask Claude → Settings. A paper from your cards needs
            no key at all.
          </div>
        )}
        <div style={{ height: 26 }} />
      </div>
    );
  }

  // ── Sitting, and marking ──────────────────────────────────────────────

  const marking = stage === 'marking';

  return (
    <div style={{ padding: 18 }}>
      {/*
        Opaque, not the Blueprint's usual near-transparent gradient. A sticky
        bar you can read the page through is a sticky bar that makes both
        illegible, which is exactly what it did on the first pass.
      */}
      <Blueprint
        style={{
          padding: '12px 14px',
          position: 'sticky',
          top: 0,
          zIndex: 2,
          background: 'var(--app-bg)',
          boxShadow: 'var(--lift-2)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 10 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div className="kicker">{marking ? 'Marked' : 'Sitting'}</div>
            <div style={{ fontSize: 14, marginTop: 3, lineHeight: 1.3 }}>{title}</div>
          </div>
          <div
            className="chrome-text"
            style={{ fontSize: 22, fontVariantNumeric: 'tabular-nums', flex: 'none' }}
          >
            {marking ? `${marks.got}/${marks.outOf}` : clock(left)}
          </div>
        </div>
        {!marking && left === 0 && (
          <div style={{ fontSize: 11.5, opacity: 0.6, marginTop: 6, lineHeight: 1.45 }}>
            Time is up. Nothing has been taken away from you — finish when you want to.
          </div>
        )}
      </Blueprint>

      {questions.map((q, i) => {
        const answer = answers[q.id];
        const chosen = answer?.given ?? '';
        const right = q.kind === 'choice' && chosen === q.answer;
        return (
          <div key={q.id} style={{ marginTop: 18 }}>
            <div style={{ display: 'flex', gap: 10, alignItems: 'baseline' }}>
              <span className="kicker" style={{ flex: 'none' }}>
                {i + 1} · {q.points} {q.points === 1 ? 'mark' : 'marks'}
              </span>
              {q.from ? (
                <span style={{ fontSize: 11, opacity: 0.45, flex: 1, minWidth: 0 }}>{q.from}</span>
              ) : null}
              {marking ? (
                <span style={{ fontSize: 11.5, flex: 'none', opacity: 0.7 }}>
                  {marksFor(q, answer)}/{q.points}
                </span>
              ) : null}
            </div>
            <div style={{ fontSize: 15, lineHeight: 1.4, marginTop: 5, textWrap: 'pretty' }}>
              {q.prompt}
            </div>

            {q.kind === 'choice' ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 9 }}>
                {q.options.map((option, n) => {
                  const picked = chosen === String(n);
                  const key = marking && String(n) === q.answer;
                  return (
                    <button
                      key={option}
                      type="button"
                      className="bare tappable"
                      disabled={marking}
                      aria-pressed={picked}
                      onClick={() => say(q.id, { given: String(n) })}
                      style={{
                        display: 'flex',
                        gap: 10,
                        textAlign: 'left',
                        padding: '9px 11px',
                        borderRadius: 'var(--r-md)',
                        border: `1px solid ${
                          key
                            ? 'var(--app-accent)'
                            : marking && picked
                              ? 'var(--app-warn-line)'
                              : picked
                                ? 'var(--app-accent-deep)'
                                : 'var(--app-line)'
                        }`,
                        background: key
                          ? 'var(--app-accent-wash)'
                          : marking && picked
                            ? 'var(--app-warn-wash)'
                            : picked
                              ? 'var(--app-accent-wash)'
                              : 'transparent',
                      }}
                    >
                      <span style={{ flex: 'none', opacity: 0.55, fontSize: 12.5 }}>
                        {letter(n)}
                      </span>
                      <span style={{ flex: 1, minWidth: 0, fontSize: 13.5, lineHeight: 1.4 }}>
                        {option}
                      </span>
                    </button>
                  );
                })}
              </div>
            ) : (
              <textarea
                className="input"
                value={chosen}
                readOnly={marking}
                onChange={(e) => say(q.id, { given: e.target.value })}
                placeholder={q.kind === 'long' ? 'A page.' : 'Two or three sentences.'}
                style={{
                  width: '100%',
                  minHeight: q.kind === 'long' ? 150 : 84,
                  resize: 'vertical',
                  lineHeight: 1.5,
                  marginTop: 9,
                }}
              />
            )}

            {marking && (
              <>
                <Blueprint style={{ padding: '11px 13px', marginTop: 9 }}>
                  <div className="kicker">{q.kind === 'choice' ? 'Why' : 'The key'}</div>
                  <div style={{ fontSize: 13, lineHeight: 1.55, marginTop: 5, textWrap: 'pretty' }}>
                    {q.kind === 'choice'
                      ? q.why || `${letter(Number(q.answer))}. ${q.options[Number(q.answer)]}`
                      : q.answer}
                  </div>
                  {q.kind !== 'choice' && q.why ? (
                    <div style={{ fontSize: 12, opacity: 0.6, marginTop: 7, lineHeight: 1.5 }}>
                      {q.why}
                    </div>
                  ) : null}
                </Blueprint>

                {q.kind === 'choice' ? (
                  <div style={{ fontSize: 12, opacity: 0.6, marginTop: 7 }}>
                    {chosen === '' ? 'Left blank.' : right ? 'Right.' : 'Not this one.'}
                  </div>
                ) : (
                  <>
                    <div style={{ fontSize: 11.5, opacity: 0.55, margin: '9px 0 6px' }}>
                      Mark it yourself against the key.
                    </div>
                    <Segmented
                      options={[
                        { id: 'wrong', label: 'Missed' },
                        { id: 'partly', label: 'Partly' },
                        { id: 'right', label: 'Got it' },
                      ]}
                      value={answer?.mark ?? ''}
                      onChange={(mark) =>
                        say(q.id, { mark: mark as 'right' | 'partly' | 'wrong' })
                      }
                    />
                  </>
                )}
              </>
            )}
          </div>
        );
      })}

      {marking ? (
        <>
          <SectionLabel>How it went</SectionLabel>
          <Blueprint style={{ padding: '14px 15px' }}>
            <div className="chrome-text" style={{ fontSize: 30, lineHeight: 1 }}>
              {marks.pct}%
            </div>
            <div style={{ fontSize: 12.5, opacity: 0.6, marginTop: 6 }}>
              {marks.got} of {marks.outOf} marks
            </div>
            <div style={{ fontSize: 13, marginTop: 9, lineHeight: 1.5, textWrap: 'pretty' }}>
              {verdict(marks)}
            </div>
          </Blueprint>

          {/*
            The score used to be thrown away the moment you left this screen,
            which made the whole exercise a mirror — it told you how you did
            and then forgot, so it could never say whether you were getting
            better. Kept, it is the only evidence Grades has about that.
          */}
          <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
            <button
              type="button"
              className="btn btn-primary"
              disabled={kept === 'result' || kept === 'both'}
              onClick={() => {
                dispatch({
                  type: 'keepSitting',
                  sitting: {
                    courseId: course?.id ?? '',
                    title,
                    at: Date.now(),
                    minutes,
                    got: marks.got,
                    outOf: marks.outOf,
                    pct: pctOf(marks.got, marks.outOf),
                    code: seed === null ? '' : seedCode(seed),
                    missed,
                  },
                });
                setKept((k) => (k === 'cards' ? 'both' : 'result'));
              }}
              style={{ flex: 1, height: 44 }}
            >
              {kept === 'result' || kept === 'both' ? 'Kept' : 'Keep this result'}
            </button>
            {missed.length > 0 && course && (
              <button
                type="button"
                className="btn btn-secondary"
                disabled={kept === 'cards' || kept === 'both'}
                onClick={() => {
                  dispatch({
                    type: 'addUpdate',
                    update: {
                      courseId: course.id,
                      unit: null,
                      title: `Missed on ${title}`,
                      source: 'A practice paper',
                      body: '',
                      cards: cardsFrom(missed),
                      terms: [],
                      fileIds: [],
                    },
                  });
                  setKept((k) => (k === 'result' ? 'both' : 'cards'));
                }}
                style={{ flex: 1, height: 44 }}
              >
                {kept === 'cards' || kept === 'both'
                  ? 'Added'
                  : `Drill the ${missed.length} you missed`}
              </button>
            )}
          </div>
          <div style={{ fontSize: 11.5, opacity: 0.5, marginTop: 8, lineHeight: 1.45 }}>
            A kept result shows on Grades beside what the rest of the course has to average — as
            evidence about you, never folded into the projection. The missed questions become
            cards in {course?.code ?? 'this course'}, and the drill schedule takes them from there.
          </div>

          {seed !== null && (
            <Blueprint style={{ padding: '11px 13px', marginTop: 10 }}>
              <div className="kicker">Paper code</div>
              <div
                style={{
                  fontSize: 22,
                  letterSpacing: '0.18em',
                  marginTop: 5,
                  fontVariantNumeric: 'tabular-nums',
                }}
              >
                {seedCode(seed)}
              </div>
              <div style={{ fontSize: 11.5, opacity: 0.55, marginTop: 6, lineHeight: 1.45 }}>
                Enter it on the setup screen to sit these exact questions again, or give it to
                somebody in your class and compare marks on the same paper.
              </div>
              {/*
                Sharing is a message carrying the code, not a new table. The
                code already reproduces the questions exactly, and everybody's
                marks stay on their own device — which is the only version of
                "compare marks" that does not send somebody's answers anywhere.

                Offered only with an account, because without one the button
                led to a room screen saying "sign in first" and nothing said
                what had become of the paper.
              */}
              {account ? (
              <button
                type="button"
                className="btn btn-secondary btn-block"
                onClick={() => {
                  dispatch({
                    type: 'writeRoomDraft',
                    text: invite({
                      code: seedCode(seed),
                      courseCode: course?.code ?? guide.code,
                      minutes,
                      formatId,
                    }),
                  });
                  dispatch({ type: 'go', screen: 'classmates' });
                }}
                style={{ height: 40, marginTop: 10 }}
              >
                Share it with the class
              </button>
              ) : (
                <div style={{ fontSize: 11.5, opacity: 0.5, marginTop: 8, lineHeight: 1.45 }}>
                  Sharing it into your class room needs an account — Me → Account. The code works
                  read aloud either way.
                </div>
              )}
            </Blueprint>
          )}

          <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() =>
                download({ name: examFileName(title), body: document(), mime: 'text/markdown' })
              }
              style={{ flex: 1, height: 42 }}
            >
              Save the paper
            </button>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => {
                dispatch({
                  type: 'keepNote',
                  title,
                  body: document(),
                  courseId: course?.id ?? null,
                });
              }}
              style={{ flex: 1, height: 42 }}
            >
              Keep as note
            </button>
          </div>
          <PrintButton label="Print it with the key" style={{ marginTop: 8 }} />
          <button
            type="button"
            className="btn btn-block"
            onClick={() => {
              setStage('setup');
              setQuestions([]);
              setAnswers({});
            }}
            style={{ height: 44, marginTop: 8 }}
          >
            Another paper
          </button>
        </>
      ) : (
        <>
          <button
            type="button"
            className="btn btn-primary btn-block"
            onClick={() => {
              setStage('marking');
              window.scrollTo(0, 0);
            }}
            style={{ height: 46, marginTop: 22, letterSpacing: '0.1em', textTransform: 'uppercase' }}
          >
            Finish and mark it
          </button>
          <div style={{ fontSize: 11.5, opacity: 0.5, marginTop: 8, lineHeight: 1.45 }}>
            {total(questions)} marks in {questions.length} questions. Multiple choice is marked
            here; the written ones you mark yourself against the key, which is the part that
            teaches.
          </div>
        </>
      )}
      <div style={{ height: 26 }} />
    </div>
  );
}
