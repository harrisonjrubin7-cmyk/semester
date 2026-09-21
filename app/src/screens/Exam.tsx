import { useEffect, useMemo, useRef, useState } from 'react';
import { secondLine } from '../lib/dim';
import { useStore } from '../state/store';
import { Page } from '../components/Page';
import { Dictate } from '../components/Dictate';
import { useLive } from '../lib/live';
import { Blueprint } from '../components/Blueprint';
import { ActionButton, SectionLabel, Segmented } from '../components/ui';
import { Trouble } from '../components/Trouble';
import { useTrouble } from '../lib/trouble';
import { PrintButton } from '../components/PrintButton';
import { ask } from '../lib/claude';
import { configured } from '../lib/assistant';
import { download, shareOut } from '../lib/deliver';
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
  outstanding,
  readExam,
  readSeed,
  result,
  seedCode,
  shapeFor,
  total,
  usableFormat,
  buildable,
  verdict,
  type Answer,
  type Question,
} from '../lib/exam';
import { UseSources, appendTo } from '../components/UseSources';
import { NeedsKey } from '../components/NeedsKey';

type Stage = 'setup' | 'sitting' | 'marking';

/**
 * One line of the "before you finish" panel: a count, then a number per
 * question you can press to go there.
 *
 * Buttons rather than `<a href="#q7">`: a hash link writes to the address
 * bar, and this app is hash-routed — `#q7` is not a route and navigating to
 * it would take the screen apart. `scrollIntoView` does the one thing that
 * was wanted.
 */
function Jumps({ said, numbers, what }: { said: string; numbers: number[]; what: string }) {
  return (
    <div style={{ marginTop: 'var(--sp-4)' }}>
      <div style={{ fontSize: 'var(--type-sm)', lineHeight: 'var(--leading-normal)' }}>{said}</div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--sp-3)', marginTop: 'var(--sp-3)' }}>
        {numbers.map((n) => (
          <button
            key={n}
            type="button"
            className="bare tappable"
            onClick={() => document.getElementById(`q${n}`)?.scrollIntoView({ block: 'start' })}
            aria-label={`Go to question ${n}, ${what}`}
            style={{
              width: 'auto',
              flex: 'none',
              minWidth: 30,
              paddingBlock: 'var(--sp-1)',
              paddingInline: 'var(--sp-4)',
              border: '1px solid var(--app-line)',
              borderRadius: 'var(--r-md)',
              fontSize: 'var(--type-sm)',
              textAlign: 'center',
            }}
          >
            {n}
          </button>
        ))}
      </div>
    </div>
  );
}

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
  const [picked, setFormatId] = useState(preset?.formatId ?? FORMATS[0].id);
  // See `usableFormat`: a shape that cannot be built from cards is never the
  // shape in force, so the paper described below is always the paper you get.
  const formatId = usableFormat(picked, source);
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
  const trouble = useTrouble();
  const abort = useRef<AbortController | null>(null);

  const shape = useMemo(() => shapeFor(minutes, formatId), [minutes, formatId]);
  const missed = useMemo(() => missedFrom(questions, answers), [questions, answers]);
  /** What the paper still has open — see the panel above the Finish button. */
  const open = useMemo(() => outstanding(questions, answers), [questions, answers]);
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
      trouble.wrong(`"${reuse.trim()}" is not a paper code. They look like 7PS4.`);
      return;
    }
    const drawnWith = asked ?? (Date.now() % 90_000) + 10_000;
    const list = fromGuide(guide, shape, drawnWith);
    if (list.length === 0) {
      trouble.wrong('This guide has no cards to build a paper from yet.');
      return;
    }
    trouble.clear();
    begin(list, `${guide.code} · paper ${seedCode(drawnWith)}`, drawnWith);
  };

  const write = async () => {
    if (busy) return;
    setBusy(true);
    trouble.clear();
    abort.current = new AbortController();
    let sofar = '';
    try {
      await ask({
        about: 'exam paper',
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
      trouble.failed(e, () => void write());
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
      <Page bottom={26}>
        <div style={{ fontSize: 'calc(12.5px * var(--text-scale, 1))', color: 'var(--app-dim)', lineHeight: 'var(--leading-relaxed)', textWrap: 'pretty' }}>
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
          style={{ marginTop: 'calc(14px * var(--density, 1))' }}
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
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'calc(7px * var(--density, 1))' }}>
          {FORMATS.map((f) => {
            const on = f.id === formatId;
            // A flashcard is not an argument, so a paper drawn from cards
            // cannot carry an essay question. Said rather than silently ignored.
            const unavailable = !buildable(f.id, source);
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
                  paddingBlock: 'calc(10px * var(--density, 1))', paddingInline: 'calc(12px * var(--density, 1))',
                  borderRadius: 'var(--r-md)',
                  border: `1px solid ${on && !unavailable ? 'var(--app-accent-deep)' : 'var(--app-line)'}`,
                  background: on && !unavailable ? 'var(--app-accent-wash)' : 'transparent',
                  /*
                    Said once. `.bare:disabled` already answers `disabled`
                    with `--app-faint`, which is held to the 3:1 a switched-off
                    control is meant to read at, and this said it a second time
                    with `DIMMED_ROW` on top. The two do not average, they
                    multiply: 0.42 of ink dimmed again to 0.64 of itself is
                    0.27, and "A real paper" rendered at 2.14:1 on Ink — under
                    the bar the faint rung exists to hold, and a number nobody
                    picked. It is the exact failure `lib/dim.ts` was written
                    about, one line below a comment already refusing to dim the
                    blurb twice for the same reason.
                  */
                }}
              >
                <span style={{ display: 'block', fontSize: 'var(--type-md)' }}>{f.label}</span>
                {/* The reason it cannot be picked is the one line on this
                    button somebody actually needs, so it is not dimmed a
                    second time inside a button that is already dimmed. */}
                <span style={{ display: 'block', fontSize: 'calc(11.5px * var(--text-scale, 1))', ...secondLine(unavailable), marginTop: 'var(--sp-1)' }}>
                  {unavailable ? 'Needs written questions — a flashcard is not an argument.' : f.blurb}
                </span>
              </button>
            );
          })}
        </div>

        <Blueprint style={{ paddingBlock: 'calc(12px * var(--density, 1))', paddingInline: 'calc(14px * var(--density, 1))', marginTop: 'calc(14px * var(--density, 1))' }}>
          <div className="kicker">The paper</div>
          <div style={{ fontSize: 'var(--type-md)', marginTop: 'var(--sp-3)', lineHeight: 'var(--leading-relaxed)' }}>
            {[
              shape.counts.choice > 0 && `${shape.counts.choice} multiple choice`,
              shape.counts.short > 0 && `${shape.counts.short} short answer`,
              shape.counts.long > 0 && `${shape.counts.long} long answer`,
            ]
              .filter(Boolean)
              .join(', ')}
          </div>
          <div style={{ fontSize: 'var(--type-sm)', color: 'var(--app-dim)', marginTop: 'calc(5px * var(--density, 1))' }}>
            {shape.points} marks · {shape.minutes} minutes
          </div>
        </Blueprint>

        {source === 'written' && (
          <>
            <SectionLabel>The material it may use</SectionLabel>
            <textarea
              aria-label="The material it may use"
              className="input"
              value={material}
              onChange={(e) => setMaterial(e.target.value)}
              placeholder="Your notes, the readings, the lecture. Every question has to come from what is in here."
              style={{ width: '100%', minHeight: 130, resize: 'vertical', lineHeight: 'var(--leading-relaxed)' }}
            />

            <UseSources
              courseId={state.guideId}
              onFill={(lines) => setMaterial((now) => appendTo(now, lines))}
              label="readings"
            />

            <SectionLabel>Topics to cover</SectionLabel>
            <input
              aria-label="Topics to cover"
              className="input"
              value={topics}
              onChange={(e) => setTopics(e.target.value)}
              placeholder="Elasticity, surplus, price floors"
              style={{ width: '100%' }}
            />

            <SectionLabel>What the real exam is like</SectionLabel>
            <textarea
              aria-label="What the real exam is like"
              className="input"
              value={about}
              onChange={(e) => setAbout(e.target.value)}
              placeholder="In class, closed book, one side of notes. Half multiple choice, one longer question."
              style={{ width: '100%', minHeight: 70, resize: 'vertical', lineHeight: 'var(--leading-relaxed)' }}
            />
            <Dictate compact current={about} onText={setAbout} label="Say it instead" />
          </>
        )}

        <Trouble said={trouble.said} onRetry={trouble.again} />

        {source === 'cards' ? (
          <>
            <SectionLabel>Sit one you have sat before</SectionLabel>
            <input
              aria-label="Paper code"
              className="input"
              value={reuse}
              onChange={(e) => setReuse(e.target.value)}
              placeholder="Paper code — leave empty for a new one"
              style={{ width: '100%', textTransform: 'uppercase' }}
            />
            <div style={{ fontSize: 'calc(11.5px * var(--text-scale, 1))', color: 'var(--app-dim)', marginTop: 'var(--sp-3)', lineHeight: 'var(--leading-normal)' }}>
              Every paper drawn from cards has a code. Enter one to get the same questions back —
              after revising, or because somebody in your class read theirs out.
            </div>

            <ActionButton
              onClick={fromCards}
              tone="primary"
              style={{ marginTop: 'var(--sp-7)' }}
            >
              Sit it
            </ActionButton>
            <div style={{ fontSize: 'calc(11.5px * var(--text-scale, 1))', color: 'var(--app-dim)', marginTop: 'var(--sp-4)', lineHeight: 'var(--leading-normal)' }}>
              Built from {guide.code}'s own cards — no key needed, nothing invented, works
              offline. Switch course from Study. For the same questions marked one at a time as
              you answer, the guide's Quiz mode is the other half of this.
            </div>
          </>
        ) : configured() ? (
          <ActionButton
            onClick={() => void write()}
            disabled={busy}
            tone="primary"
            style={{ marginTop: 'var(--sp-7)' }}
          >
            {busy ? 'Writing the paper…' : 'Write the paper'}
          </ActionButton>
        ) : (
          <NeedsKey also="A paper from your cards needs no key at all." />
        )}
      </Page>
    );
  }

  // ── Sitting, and marking ──────────────────────────────────────────────

  const marking = stage === 'marking';

  return (
    <Page bottom={26}>
      {/*
        Opaque, not the Blueprint's usual near-transparent gradient. A sticky
        bar you can read the page through is a sticky bar that makes both
        illegible, which is exactly what it did on the first pass.
      */}
      <Blueprint
        style={{
          paddingBlock: 'calc(12px * var(--density, 1))', paddingInline: 'calc(14px * var(--density, 1))',
          position: 'sticky',
          top: 0,
          zIndex: 2,
          background: 'var(--app-bg)',
          boxShadow: 'var(--lift-2)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 'var(--sp-5)' }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div className="kicker">{marking ? 'Marked' : 'Sitting'}</div>
            <div style={{ fontSize: 'var(--type-md)', marginTop: 'calc(3px * var(--density, 1))', lineHeight: 'var(--leading-tight)' }}>{title}</div>
          </div>
          <div
            className="chrome-text"
            style={{ fontSize: 'calc(22px * var(--text-scale, 1))', fontVariantNumeric: 'tabular-nums', flex: 'none' }}
          >
            {marking ? `${marks.got}/${marks.outOf}` : clock(left)}
          </div>
        </div>
        {!marking && left === 0 && (
          <div style={{ fontSize: 'calc(11.5px * var(--text-scale, 1))', color: 'var(--app-dim)', marginTop: 'var(--sp-3)', lineHeight: 'var(--leading-normal)' }}>
            Time is up. Nothing has been taken away from you — finish when you want to.
          </div>
        )}
      </Blueprint>

      {questions.map((q, i) => {
        const answer = answers[q.id];
        const chosen = answer?.given ?? '';
        const right = q.kind === 'choice' && chosen === q.answer;
        return (
          /* Anchored so "question 7" in the panel below can actually go
             there. The id is the question number rather than its id: a
             student reads the number, and a jump that lands somewhere the
             heading does not match is worse than no jump. */
          <div key={q.id} id={`q${i + 1}`} style={{ marginTop: 'calc(18px * var(--density, 1))', scrollMarginTop: 'var(--sp-7)' }}>
            <div style={{ display: 'flex', gap: 'var(--sp-5)', alignItems: 'baseline' }}>
              <span className="kicker" style={{ flex: 'none' }}>
                {i + 1} · {q.points} {q.points === 1 ? 'mark' : 'marks'}
              </span>
              {q.from ? (
                <span style={{ fontSize: 'var(--type-xs)', ...secondLine(), flex: 1, minWidth: 0 }}>{q.from}</span>
              ) : null}
              {marking ? (
                <span style={{ fontSize: 'calc(11.5px * var(--text-scale, 1))', flex: 'none', color: 'var(--app-dim)' }}>
                  {marksFor(q, answer)}/{q.points}
                </span>
              ) : null}
              {/* Only while sitting. During marking the paper is a record, and
                  a control that changes it would be inviting somebody to edit
                  their own script. */}
              {!marking && (
                <button
                  type="button"
                  className="bare no-print"
                  onClick={() => say(q.id, { flagged: !answer?.flagged })}
                  aria-pressed={Boolean(answer?.flagged)}
                  aria-label={
                    answer?.flagged
                      ? `Question ${i + 1}: remove the flag`
                      : `Question ${i + 1}: flag it to come back to`
                  }
                  style={{
                    width: 'auto',
                    flex: 'none',
                    marginLeft: 'auto',
                    fontSize: 'var(--type-xs)',
                    letterSpacing: '0.08em',
                    textTransform: 'uppercase',
                    color: answer?.flagged ? 'var(--app-accent-deep)' : 'var(--app-dim)',
                  }}
                >
                  {answer?.flagged ? 'Flagged' : 'Flag'}
                </button>
              )}
            </div>
            <div style={{ fontSize: 'var(--type-lg)', lineHeight: 1.4, marginTop: 'calc(5px * var(--density, 1))', textWrap: 'pretty' }}>
              {q.prompt}
            </div>

            {q.kind === 'choice' ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-3)', marginTop: 'calc(9px * var(--density, 1))' }}>
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
                        gap: 'var(--sp-5)',
                        textAlign: 'left',
                        paddingBlock: 'calc(9px * var(--density, 1))', paddingInline: 'calc(11px * var(--density, 1))',
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
                      <span style={{ flex: 'none', color: 'var(--app-dim)', fontSize: 'calc(12.5px * var(--text-scale, 1))' }}>
                        {letter(n)}
                      </span>
                      <span style={{ flex: 1, minWidth: 0, fontSize: 'calc(13.5px * var(--text-scale, 1))', lineHeight: 1.4 }}>
                        {option}
                      </span>
                    </button>
                  );
                })}
              </div>
            ) : (
              <textarea
                aria-label="Your answer"
                className="input"
                value={chosen}
                readOnly={marking}
                onChange={(e) => say(q.id, { given: e.target.value })}
                placeholder={q.kind === 'long' ? 'A page.' : 'Two or three sentences.'}
                style={{
                  width: '100%',
                  minHeight: q.kind === 'long' ? 150 : 84,
                  resize: 'vertical',
                  lineHeight: 'var(--leading-relaxed)',
                  marginTop: 'calc(9px * var(--density, 1))',
                }}
              />
            )}

            {marking && (
              <>
                <Blueprint plain style={{ paddingBlock: 'calc(11px * var(--density, 1))', paddingInline: 'calc(13px * var(--density, 1))', marginTop: 'calc(9px * var(--density, 1))' }}>
                  <div className="kicker">{q.kind === 'choice' ? 'Why' : 'The key'}</div>
                  <div style={{ fontSize: 'var(--type-base)', lineHeight: 1.55, marginTop: 'calc(5px * var(--density, 1))', textWrap: 'pretty' }}>
                    {q.kind === 'choice'
                      ? q.why || `${letter(Number(q.answer))}. ${q.options[Number(q.answer)]}`
                      : q.answer}
                  </div>
                  {q.kind !== 'choice' && q.why ? (
                    <div style={{ fontSize: 'var(--type-sm)', color: 'var(--app-dim)', marginTop: 'calc(7px * var(--density, 1))', lineHeight: 'var(--leading-relaxed)' }}>
                      {q.why}
                    </div>
                  ) : null}
                </Blueprint>

                {q.kind === 'choice' ? (
                  <div style={{ fontSize: 'var(--type-sm)', color: 'var(--app-dim)', marginTop: 'calc(7px * var(--density, 1))' }}>
                    {chosen === '' ? 'Left blank.' : right ? 'Right.' : 'Not this one.'}
                  </div>
                ) : (
                  <>
                    <div style={{ fontSize: 'calc(11.5px * var(--text-scale, 1))', color: 'var(--app-dim)', marginTop: 'calc(9px * var(--density, 1))', marginInline: '0', marginBottom: 'calc(6px * var(--density, 1))' }}>
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
          <Blueprint style={{ paddingBlock: 'calc(14px * var(--density, 1))', paddingInline: 'calc(15px * var(--density, 1))' }}>
            <div className="chrome-text" style={{ fontSize: 'calc(30px * var(--text-scale, 1))', lineHeight: 1 }}>
              {marks.pct}%
            </div>
            <div style={{ fontSize: 'calc(12.5px * var(--text-scale, 1))', color: 'var(--app-dim)', marginTop: 'var(--sp-3)' }}>
              {marks.got} of {marks.outOf} marks
            </div>
            <div style={{ fontSize: 'var(--type-base)', marginTop: 'calc(9px * var(--density, 1))', lineHeight: 'var(--leading-relaxed)', textWrap: 'pretty' }}>
              {verdict(marks)}
            </div>
          </Blueprint>

          {/*
            The score used to be thrown away the moment you left this screen,
            which made the whole exercise a mirror — it told you how you did
            and then forgot, so it could never say whether you were getting
            better. Kept, it is the only evidence Grades has about that.
          */}
          <div style={{ display: 'flex', gap: 'var(--sp-4)', marginTop: 'var(--sp-5)' }}>
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
          <div style={{ fontSize: 'calc(11.5px * var(--text-scale, 1))', color: 'var(--app-dim)', marginTop: 'var(--sp-4)', lineHeight: 'var(--leading-normal)' }}>
            A kept result shows on Grades beside what the rest of the course has to average — as
            evidence about you, never folded into the projection. The missed questions become
            cards in {course?.code ?? 'this course'}, and the drill schedule takes them from there.
          </div>

          {seed !== null && (
            <Blueprint style={{ paddingBlock: 'calc(11px * var(--density, 1))', paddingInline: 'calc(13px * var(--density, 1))', marginTop: 'var(--sp-5)' }}>
              <div className="kicker">Paper code</div>
              <div
                style={{
                  fontSize: 'calc(22px * var(--text-scale, 1))',
                  letterSpacing: '0.18em',
                  marginTop: 'calc(5px * var(--density, 1))',
                  fontVariantNumeric: 'tabular-nums',
                }}
              >
                {seedCode(seed)}
              </div>
              <div style={{ fontSize: 'calc(11.5px * var(--text-scale, 1))', color: 'var(--app-dim)', marginTop: 'var(--sp-3)', lineHeight: 'var(--leading-normal)' }}>
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
                style={{ height: 40, marginTop: 'var(--sp-5)' }}
              >
                Share it with the class
              </button>
              ) : (
                <div style={{ fontSize: 'calc(11.5px * var(--text-scale, 1))', color: 'var(--app-dim)', marginTop: 'var(--sp-4)', lineHeight: 'var(--leading-normal)' }}>
                  Sharing it into your class room needs an account — Me → Account. The code works
                  read aloud either way.
                </div>
              )}
            </Blueprint>
          )}

          <div style={{ display: 'flex', gap: 'var(--sp-4)', marginTop: 'var(--sp-6)' }}>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => {
                const piece = {
                  name: examFileName(title),
                  body: document(),
                  mime: 'text/markdown',
                };
                // The share sheet first, because a paper is a thing you send
                // to the group chat rather than file away. A phone with no
                // sheet, or a dismissal, falls back to saving it — the two
                // are the same answer: the file has not gone anywhere yet.
                void shareOut([piece], title).then((shared) => {
                  if (!shared) download(piece);
                });
              }}
              style={{ flex: 1, height: 42 }}
            >
              Share the paper
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
          <PrintButton label="Print it with the key" style={{ marginTop: 'var(--sp-4)' }} />
          <button
            type="button"
            className="btn btn-block"
            onClick={() => {
              setStage('setup');
              setQuestions([]);
              setAnswers({});
            }}
            style={{ height: 44, marginTop: 'var(--sp-4)' }}
          >
            Another paper
          </button>
        </>
      ) : (
        <>
          {/*
            What is still open, before the paper is closed.

            Every computer-based exam shows this on the way out, and here it
            is load-bearing rather than a nicety: the whole paper is one long
            page, so "I left seven blank" is otherwise something you find out
            after pressing Finish, when the answer is on the screen next to a
            key and it is too late to mean anything.

            A jump per number rather than a count. "Three unanswered" tells
            somebody they have a problem and not where it is, which on a
            twenty-question page is most of the work.
          */}
          {(open.blank.length > 0 || open.flagged.length > 0) && (
            <Blueprint plain style={{ padding: 'var(--sp-7)', marginTop: 'calc(var(--sp-7) + var(--sp-3))' }}>
              <div className="kicker">Before you finish</div>
              {open.blank.length > 0 && (
                <Jumps
                  said={`${open.blank.length} unanswered`}
                  numbers={open.blank}
                  what="unanswered"
                />
              )}
              {open.flagged.length > 0 && (
                <Jumps
                  said={`${open.flagged.length} flagged to come back to`}
                  numbers={open.flagged}
                  what="flagged"
                />
              )}
            </Blueprint>
          )}

          <ActionButton
            onClick={() => {
            setStage('marking');
            window.scrollTo(0, 0);
            }}
            tone="primary"
            style={{ marginTop: 'calc(22px * var(--density, 1))' }}
          >
            Finish and mark it
          </ActionButton>
          <div style={{ fontSize: 'calc(11.5px * var(--text-scale, 1))', color: 'var(--app-dim)', marginTop: 'var(--sp-4)', lineHeight: 'var(--leading-normal)' }}>
            {total(questions)} marks in {questions.length} questions. Multiple choice is marked
            here; the written ones you mark yourself against the key, which is the part that
            teaches.
          </div>
        </>
      )}
    </Page>
  );
}
