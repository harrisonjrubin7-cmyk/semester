import { allCards, weakestUnit } from '../data/catalog';
import { useMemo, useRef } from 'react';
import { useKeepAwake } from '../lib/awake';
import { useStore } from '../state/store';
import { useLive } from '../lib/live';
import { Blueprint } from '../components/Blueprint';
import { hasPrebuiltDeck, hasPrebuiltDocs } from '../lib/handout';
import { ChipRow, Meter, SectionLabel } from '../components/ui';
import { ModePicker } from '../components/ModePicker';
import { modeInfo, modesFor } from '../lib/modes';
import { FieldGuide } from './Field';
import { ChevronRight, Plus } from '../components/Icons';
import { FigureCard } from '../components/FigureCard';
import { buildQuiz } from '../lib/quiz';
import { asset } from '../lib/asset';

export function Guide() {
  const { state, dispatch, catalog } = useStore();

  // A study guide is a long read with long pauses. See `lib/awake.ts`.
  useKeepAwake();

  const live = useLive(state.guideId);
  const { guide, figures: figMap, updates, onUnit } = live;
  const cards = allCards(guide);
  const weak = weakestUnit(guide);
  // What each way of studying holds for this course, so the picker can say so
  // rather than making every mode look equally full.
  const modes = modesFor(catalog, state.guideId, live);
  const here = modeInfo(modes, state.mode);

  return (
    <div style={{ padding: 18 }}>
      {/* The field guide opens with its own masthead carrying both of these,
          so repeating them above it just pushes the document down. */}
      {state.mode !== 'field' && (
        <>
          <div style={{ fontSize: 'calc(15px * var(--text-scale, 1))', lineHeight: 1.3 }}>{guide.name}</div>
          <div style={{ fontSize: 'calc(13px * var(--text-scale, 1))', opacity: 0.6, marginTop: 3 }}>{guide.blurb}</div>
        </>
      )}

      <button
        type="button"
        className="btn btn-secondary"
        onClick={() => dispatch({ type: 'openUpdate', courseId: state.guideId, unit: null })}
        style={{
          marginTop: 12,
          height: 36,
          fontSize: 'calc(11px * var(--text-scale, 1))',
          letterSpacing: '0.12em',
          textTransform: 'uppercase',
          display: 'flex',
          alignItems: 'center',
          gap: 7,
        }}
      >
        <Plus size={14} />
        {updates.length === 0
          ? 'New reading or handout'
          : `${updates.length} added · add more`}
      </button>

      {/*
        Unrolled it is a menu of ten; rolled up it is one line saying where you
        are. Both are right, at different points in a semester, so it is a
        preference that persists rather than a guess made for you.
      */}
      <button
        type="button"
        className="bare tappable"
        onClick={() => dispatch({ type: 'toggleWays' })}
        aria-expanded={state.waysOpen}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          width: '100%',
          margin: '20px 0 8px',
          textAlign: 'left',
        }}
      >
        <SectionLabel style={{ margin: 0 }}>
          {state.waysOpen ? 'Ways to study this' : `${here?.label ?? 'Cards'} · ${here?.count ?? ''}`}
        </SectionLabel>
        <span style={{ flex: 1 }} />
        <span
          style={{
            fontSize: 'calc(10px * var(--text-scale, 1))',
            letterSpacing: '0.12em',
            textTransform: 'uppercase',
            opacity: 0.5,
            fontFamily: 'var(--font-heading)',
          }}
        >
          {state.waysOpen ? 'Hide' : `${modes.filter((m) => m.ready).length} ways`}
        </span>
        <ChevronRight
          size={14}
          style={{
            opacity: 0.5,
            flex: 'none',
            transform: state.waysOpen ? 'rotate(90deg)' : 'none',
          }}
        />
      </button>
      {state.waysOpen && (
        <ModePicker
          modes={modes}
          value={state.mode}
          onChange={(mode) => dispatch({ type: 'setMode', mode })}
        />
      )}
      {state.waysOpen && here && (
        <div
          style={{
            fontSize: 'calc(12.5px * var(--text-scale, 1))',
            opacity: 0.62,
            lineHeight: 1.45,
            margin: '10px 0 2px',
            textWrap: 'pretty',
          }}
        >
          {here.ready ? here.blurb : here.missing}
        </div>
      )}

      {state.mode === 'cards' && (
        <>
          <button
            type="button"
            className="btn btn-primary btn-block"
            onClick={() => dispatch({ type: 'startDrill', unit: null })}
            style={{
              height: 48,
              fontSize: 'calc(15px * var(--text-scale, 1))',
              letterSpacing: '0.1em',
              textTransform: 'uppercase',
              marginTop: 14,
            }}
          >
            Drill all {cards.length} cards
          </button>

          <Blueprint
            onClick={() => dispatch({ type: 'startDrill', unit: weak.index })}
            style={{
              padding: '13px 14px',
              marginTop: 12,
              display: 'flex',
              alignItems: 'center',
              gap: 12,
            }}
          >
            <span
              style={{ width: 8, height: 34, background: 'var(--chrome)', flex: 'none' }}
            />
            <span style={{ flex: 1, minWidth: 0 }}>
              <span className="kicker" style={{ display: 'block' }}>
                Weakest unit
              </span>
              <span style={{ display: 'block', fontSize: 'calc(14px * var(--text-scale, 1))', lineHeight: 1.25, marginTop: 2 }}>
                {weak.unit.name}
              </span>
              <span style={{ display: 'block', fontSize: 'calc(11px * var(--text-scale, 1))', opacity: 0.55 }}>
                {weak.unit.mastery}% — drill this one first
              </span>
            </span>
            <ChevronRight size={16} style={{ opacity: 0.4, flex: 'none' }} />
          </Blueprint>

          <SectionLabel>Units</SectionLabel>
          {guide.units.map((u, i) => (
            <button
              key={u.name}
              type="button"
              className="bare tappable"
              onClick={() => dispatch({ type: 'startDrill', unit: i })}
              style={{
                display: 'flex',
                gap: 12,
                alignItems: 'center',
                padding: '13px 0',
                borderBottom: '1px solid var(--app-line)',
              }}
            >
              <span
                style={{
                  width: 26,
                  flex: 'none',
                  fontFamily: 'var(--font-heading)',
                  fontSize: 'calc(20px * var(--text-scale, 1))',
                  opacity: 0.4,
                }}
              >
                {i + 1}
              </span>
              <span style={{ flex: 1, minWidth: 0 }}>
                <span style={{ display: 'block', fontSize: 'calc(15px * var(--text-scale, 1))', lineHeight: 1.25 }}>{u.name}</span>
                <span style={{ display: 'block', marginTop: 6 }}>
                  <Meter pct={u.mastery} height={5} />
                </span>
              </span>
              <span
                style={{
                  fontFamily: 'var(--font-heading)',
                  fontSize: 'calc(11px * var(--text-scale, 1))',
                  letterSpacing: '0.1em',
                  textTransform: 'uppercase',
                  opacity: 0.5,
                  width: 54,
                  textAlign: 'right',
                  flex: 'none',
                }}
              >
                {u.cards.length} cards
              </span>
            </button>
          ))}

          {guide.selfTest && (
            <button
              type="button"
              className="bare tappable"
              onClick={() => dispatch({ type: 'startDrill', unit: -1 })}
              style={{
                display: 'flex',
                gap: 12,
                alignItems: 'center',
                padding: '13px 0',
                borderBottom: '1px solid var(--app-line)',
              }}
            >
              <span
                style={{
                  width: 26,
                  flex: 'none',
                  fontFamily: 'var(--font-heading)',
                  fontSize: 'calc(20px * var(--text-scale, 1))',
                  opacity: 0.4,
                }}
              >
                ★
              </span>
              <span style={{ flex: 1, minWidth: 0, fontSize: 'calc(15px * var(--text-scale, 1))' }}>
                The guide’s own self-test
              </span>
              <span
                style={{
                  fontFamily: 'var(--font-heading)',
                  fontSize: 'calc(11px * var(--text-scale, 1))',
                  letterSpacing: '0.1em',
                  textTransform: 'uppercase',
                  opacity: 0.5,
                  flex: 'none',
                }}
              >
                {guide.selfTest.length} cards
              </span>
            </button>
          )}
        </>
      )}

      {state.mode === 'quiz' && (
        <Blueprint style={{ padding: 16, marginTop: 14 }}>
          <div style={{ fontFamily: 'var(--font-heading)', fontSize: 'calc(22px * var(--text-scale, 1))', lineHeight: 1.1 }}>
            Ten multiple choice
          </div>
          <div
            style={{
              fontSize: 'calc(13px * var(--text-scale, 1))',
              opacity: 0.7,
              lineHeight: 1.45,
              marginTop: 4,
              textWrap: 'pretty',
            }}
          >
            Pulled at random from every card in the guide, with three decoys drawn from the other
            units — the same recognition work the real exam asks for. Different ten every run,
            and <strong>marked as you go</strong>, so a wrong answer is corrected while you still
            remember why you chose it.
          </div>
          <button
            type="button"
            className="btn btn-primary btn-block"
            onClick={() =>
              dispatch({ type: 'startQuiz', quiz: buildQuiz(guide, state.quizSeed) })
            }
            style={{
              height: 48,
              fontSize: 'calc(15px * var(--text-scale, 1))',
              letterSpacing: '0.1em',
              textTransform: 'uppercase',
              marginTop: 14,
            }}
          >
            Start quiz
          </button>

          {/*
            The two used to be separate systems that did not know about each
            other, both one tap from Study, with nothing saying which to use.
            They stay distinct — immediate feedback is a different exercise
            from sitting against a clock — but each names the other now.
          */}
          <button
            type="button"
            className="btn btn-secondary btn-block"
            onClick={() => dispatch({ type: 'sitPaper', minutes: 15, formatId: 'choice' })}
            style={{ height: 42, marginTop: 8 }}
          >
            Sit it as a timed paper
          </button>
          <div style={{ fontSize: 'calc(11.5px * var(--text-scale, 1))', opacity: 0.5, marginTop: 8, lineHeight: 1.45 }}>
            The paper is the same questions with a clock, marks and a key at the end instead of
            after each one — closer to the real thing, and worse for learning a card you have
            just met.
          </div>
        </Blueprint>
      )}

      {state.mode === 'read' && (
        <div style={{ marginTop: 16, display: 'flex', flexDirection: 'column' }}>
          {guide.units.map((u, i) => {
            const open = state.openUnit === i;
            const fig = figMap[i];
            return (
              <div key={u.name} style={{ borderBottom: '1px solid var(--app-line)', padding: '13px 0' }}>
                <button
                  type="button"
                  className="bare"
                  onClick={() => dispatch({ type: 'toggleUnit', index: i })}
                  aria-expanded={open}
                  style={{ display: 'flex', gap: 11, alignItems: 'center' }}
                >
                  <ChevronRight
                    size={14}
                    style={{
                      flex: 'none',
                      opacity: 0.5,
                      transform: open ? 'rotate(90deg)' : 'rotate(0deg)',
                      transition: 'transform 140ms ease',
                    }}
                  />
                  <span style={{ flex: 1, minWidth: 0, fontSize: 'calc(15px * var(--text-scale, 1))', lineHeight: 1.25 }}>
                    {u.name}
                  </span>
                  <span
                    style={{
                      fontFamily: 'var(--font-heading)',
                      fontSize: 'calc(11px * var(--text-scale, 1))',
                      letterSpacing: '0.1em',
                      textTransform: 'uppercase',
                      opacity: 0.45,
                      flex: 'none',
                    }}
                  >
                    {u.cards.length} cards
                  </span>
                </button>

                {open && (
                  <div
                    style={{
                      padding: '8px 0 2px 25px',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 14,
                    }}
                  >
                    {u.cards.map((c, ci) => {
                      // Anything past the count the guide shipped with is
                      // something you added, and says so.
                      const isNew = ci >= (guide.baseCards[i] ?? u.cards.length);
                      return (
                        <div key={c.q}>
                          {isNew && <span className="tag tag-accent">Added</span>}
                          <div
                            style={{
                              fontFamily: 'var(--font-heading)',
                              fontSize: 'calc(17px * var(--text-scale, 1))',
                              lineHeight: 1.2,
                              textWrap: 'pretty',
                              marginTop: isNew ? 6 : 0,
                            }}
                          >
                            {c.q}
                          </div>
                          <div
                            style={{
                              fontSize: 'calc(14px * var(--text-scale, 1))',
                              lineHeight: 1.5,
                              opacity: 0.78,
                              marginTop: 3,
                              textWrap: 'pretty',
                            }}
                          >
                            {c.a}
                          </div>
                        </div>
                      );
                    })}

                    {onUnit(i)
                      .filter((up) => up.body)
                      .map((up) => (
                        <Blueprint key={up.id} style={{ padding: '13px 14px' }}>
                          <div className="kicker">
                            Added{up.source ? ` · ${up.source}` : ''}
                          </div>
                          <div
                            style={{
                              fontSize: 'calc(13.5px * var(--text-scale, 1))',
                              lineHeight: 1.55,
                              opacity: 0.82,
                              marginTop: 6,
                              whiteSpace: 'pre-wrap',
                              textWrap: 'pretty',
                            }}
                          >
                            {up.body}
                          </div>
                        </Blueprint>
                      ))}

                    {fig && <FigureCard figure={fig} />}
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                      <button
                        type="button"
                        className="btn btn-secondary"
                        onClick={() => dispatch({ type: 'startDrill', unit: i })}
                        style={{
                          fontSize: 'calc(11px * var(--text-scale, 1))',
                          letterSpacing: '0.12em',
                          textTransform: 'uppercase',
                        }}
                      >
                        Drill this unit
                      </button>
                      <button
                        type="button"
                        className="btn btn-secondary"
                        onClick={() =>
                          dispatch({ type: 'openUpdate', courseId: state.guideId, unit: i })
                        }
                        style={{
                          fontSize: 'calc(11px * var(--text-scale, 1))',
                          letterSpacing: '0.12em',
                          textTransform: 'uppercase',
                        }}
                      >
                        Add to this unit
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {state.mode === 'field' && <FieldGuide />}
      {state.mode === 'watch' && <Watch />}
      {state.mode === 'slides' && <Decks />}
      {state.mode === 'doc' && <Documents />}
      {state.mode === 'figures' && <Figures />}
      {state.mode === 'cases' && <Cases />}
      {state.mode === 'cram' && <Cram />}
      {state.mode === 'listen' && <Listen />}

      <div
        style={{
          fontSize: 'calc(11px * var(--text-scale, 1))',
          opacity: 0.45,
          marginTop: 22,
          fontFamily: 'var(--font-heading)',
          letterSpacing: '0.08em',
        }}
      >
        Built from {guide.source}
      </div>
      <div style={{ height: 22 }} />
    </div>
  );
}

/**
 * The lesson list.
 *
 * A lesson is the unit taught out loud — the same material as Read, in the
 * order a lecturer would take it, with the slide changing as the voice moves.
 * Everything that has a recording is here; anything added since shows as a
 * count on the row, because the lesson still plays the old narration and the
 * app should say so rather than let it look complete.
 */
function Watch() {
  const { state, dispatch } = useStore();
  const { guide, lessons, onUnit } = useLive(state.guideId);
  const made = Object.keys(lessons).length;
  const total = Object.values(lessons).reduce((n, l) => n + l.seconds, 0);

  if (made === 0) {
    return (
      <Blueprint style={{ padding: 16, marginTop: 14, background: 'var(--app-hero)' }}>
        <div className="kicker">Lessons</div>
        <div className="chrome-text" style={{ fontSize: 'calc(26px * var(--text-scale, 1))', marginTop: 8, lineHeight: 1.1 }}>
          Not recorded yet
        </div>
        <div style={{ fontSize: 'calc(13px * var(--text-scale, 1))', opacity: 0.78, marginTop: 8, lineHeight: 1.5 }}>
          One narrated lesson per unit, rendered by the pipeline:{' '}
          <code style={{ fontSize: 'calc(12px * var(--text-scale, 1))' }}>python3 pipeline/lessons.py {state.guideId}</code>
        </div>
      </Blueprint>
    );
  }

  return (
    <>
      <div style={{ fontSize: 'calc(13px * var(--text-scale, 1))', opacity: 0.65, marginTop: 14, textWrap: 'pretty' }}>
        {made} {made === 1 ? 'lesson' : 'lessons'} · {Math.round(total / 60)} minutes. Each unit
        taught out loud, with the slide changing as the voice moves. Headphones on the walk to
        Buttrick and you have covered a unit.
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', marginTop: 14 }}>
        {guide.units.map((u, i) => {
          const lesson = lessons[i];
          const added = onUnit(i).reduce((n, up) => n + up.cards.length, 0);
          return (
            <button
              key={u.name}
              type="button"
              className="bare tappable"
              disabled={!lesson}
              onClick={() => lesson && dispatch({ type: 'openLesson', unit: i })}
              style={{
                display: 'flex',
                gap: 12,
                alignItems: 'center',
                padding: '13px 0',
                borderBottom: '1px solid var(--app-line)',
                opacity: lesson ? 1 : 0.4,
                textAlign: 'left',
              }}
            >
              <span
                style={{
                  width: 26,
                  flex: 'none',
                  fontFamily: 'var(--font-heading)',
                  fontSize: 'calc(20px * var(--text-scale, 1))',
                  opacity: 0.4,
                }}
              >
                {i + 1}
              </span>
              <span style={{ flex: 1, minWidth: 0 }}>
                <span style={{ display: 'block', fontSize: 'calc(15px * var(--text-scale, 1))', lineHeight: 1.25 }}>{u.name}</span>
                <span
                  style={{
                    display: 'block',
                    fontSize: 'calc(11px * var(--text-scale, 1))',
                    opacity: 0.55,
                    fontFamily: 'var(--font-heading)',
                    letterSpacing: '0.1em',
                    textTransform: 'uppercase',
                    marginTop: 3,
                  }}
                >
                  {lesson ? lesson.len : 'not recorded'}
                  {added > 0 && ` · ${added} added since`}
                </span>
              </span>
              <ChevronRight size={16} style={{ opacity: 0.4, flex: 'none' }} />
            </button>
          );
        })}
      </div>
    </>
  );
}

/** Unit decks, for reading a unit through rather than drilling it. */
function Decks() {
  const { state, dispatch } = useStore();
  const { guide } = useLive(state.guideId);

  return (
    <>
      <div style={{ fontSize: 'calc(13px * var(--text-scale, 1))', opacity: 0.65, marginTop: 14, textWrap: 'pretty' }}>
        One point per slide, question before answer. Better than Read for a unit you have not met
        yet; worse than Cards for one you nearly know.
      </div>
      {/*
        The prebuilt file where there is one, and the builder where there is
        not. This used to be one unconditional link to `/decks/<id>.pptx`, and
        for every course anybody imported it opened a 404 in a new tab.
      */}
      {hasPrebuiltDeck(state.guideId) ? (
        <a
          href={asset(`/decks/${state.guideId}.pptx`)}
          target="_blank"
          rel="noreferrer"
          className="bare"
        >
          <Blueprint
            style={{
              padding: '12px 14px',
              marginTop: 12,
              display: 'flex',
              gap: 12,
              alignItems: 'center',
            }}
          >
            <span
              style={{
                fontFamily: 'var(--font-heading)',
                fontSize: 'calc(12px * var(--text-scale, 1))',
                letterSpacing: '0.12em',
                color: 'var(--app-accent)',
                flex: 'none',
              }}
            >
              PPTX
            </span>
            <span style={{ flex: 1, minWidth: 0, fontSize: 'calc(13px * var(--text-scale, 1))', lineHeight: 1.35 }}>
              The whole course as a PowerPoint deck
            </span>
            <ChevronRight size={15} style={{ opacity: 0.4, flex: 'none' }} />
          </Blueprint>
        </a>
      ) : (
        <Blueprint
          onClick={() => dispatch({ type: 'go', screen: 'deck' })}
          style={{
            padding: '12px 14px',
            marginTop: 12,
            display: 'flex',
            gap: 12,
            alignItems: 'center',
          }}
        >
          <span
            style={{
              fontFamily: 'var(--font-heading)',
              fontSize: 'calc(12px * var(--text-scale, 1))',
              letterSpacing: '0.12em',
              color: 'var(--app-accent)',
              flex: 'none',
            }}
          >
            PPTX
          </span>
          <span style={{ flex: 1, minWidth: 0, fontSize: 'calc(13px * var(--text-scale, 1))', lineHeight: 1.35 }}>
            Build a deck from any unit — a real PowerPoint file, written here
          </span>
          <ChevronRight size={15} style={{ opacity: 0.4, flex: 'none' }} />
        </Blueprint>
      )}
      <div style={{ display: 'flex', flexDirection: 'column', marginTop: 14 }}>
        {guide.units.map((u, i) => (
          <button
            key={u.name}
            type="button"
            className="bare tappable"
            onClick={() => dispatch({ type: 'openDeck', unit: i })}
            style={{
              display: 'flex',
              gap: 12,
              alignItems: 'center',
              padding: '13px 0',
              borderBottom: '1px solid var(--app-line)',
              textAlign: 'left',
            }}
          >
            <span
              style={{
                width: 26,
                flex: 'none',
                fontFamily: 'var(--font-heading)',
                fontSize: 'calc(20px * var(--text-scale, 1))',
                opacity: 0.4,
              }}
            >
              {i + 1}
            </span>
            <span style={{ flex: 1, minWidth: 0 }}>
              <span style={{ display: 'block', fontSize: 'calc(15px * var(--text-scale, 1))', lineHeight: 1.25 }}>{u.name}</span>
              <span
                style={{
                  display: 'block',
                  fontSize: 'calc(11px * var(--text-scale, 1))',
                  opacity: 0.55,
                  fontFamily: 'var(--font-heading)',
                  letterSpacing: '0.1em',
                  textTransform: 'uppercase',
                  marginTop: 3,
                }}
              >
                {u.cards.length * 2 + 2} slides
              </span>
            </span>
            <ChevronRight size={16} style={{ opacity: 0.4, flex: 'none' }} />
          </button>
        ))}
      </div>
    </>
  );
}

/**
 * The guide as a document.
 *
 * Three routes, and which of them exist depends on the course. The printable
 * view is the whole guide as one page, which every browser turns into a PDF
 * and every course has. The .docx and .pdf are written offline by
 * `pipeline/handout.py`, which has only ever run against the four sample
 * courses — so a course you imported is offered the printable view and told
 * why, rather than three buttons that open a 404 in a new tab.
 *
 * The deck is the one that got better rather than smaller: `lib/pptx.ts`
 * writes a real .pptx in the browser, so every course can have one now.
 */
function Documents() {
  const { state, dispatch } = useStore();
  const { guide } = useLive(state.guideId);
  const stem = `/handouts/${state.guideId}`;
  const prebuilt = hasPrebuiltDocs(state.guideId);

  const files = prebuilt
    ? [
        { label: 'PDF', href: asset(`${stem}.pdf`), note: 'Reads anywhere. Print it.' },
        {
          label: 'Word',
          href: asset(`${stem}.docx`),
          note: 'Annotate it, or open it in Google Docs.',
        },
      ]
    : [];

  return (
    <>
      <div style={{ fontSize: 'calc(13px * var(--text-scale, 1))', opacity: 0.65, marginTop: 14, textWrap: 'pretty' }}>
        The same {guide.units.length} units as a document — every card, the terms and the
        self-test, in reading order.
      </div>

      {files.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 11, marginTop: 14 }}>
          {files.map((f) => (
            <a key={f.label} href={f.href} target="_blank" rel="noreferrer" className="bare">
              <Blueprint
                style={{ padding: '14px 15px', display: 'flex', gap: 12, alignItems: 'center' }}
              >
                <span
                  style={{
                    fontFamily: 'var(--font-heading)',
                    fontSize: 'calc(13px * var(--text-scale, 1))',
                    letterSpacing: '0.12em',
                    color: 'var(--app-accent)',
                    width: 46,
                    flex: 'none',
                  }}
                >
                  {f.label}
                </span>
                <span style={{ flex: 1, minWidth: 0 }}>
                  <span style={{ display: 'block', fontSize: 'calc(14px * var(--text-scale, 1))' }}>{guide.code} study guide</span>
                  <span style={{ display: 'block', fontSize: 'calc(11.5px * var(--text-scale, 1))', opacity: 0.6, marginTop: 2 }}>
                    {f.note}
                  </span>
                </span>
                <ChevronRight size={16} style={{ opacity: 0.4, flex: 'none' }} />
              </Blueprint>
            </a>
          ))}
        </div>
      )}

      <button
        type="button"
        className="btn btn-primary btn-block"
        onClick={() => window.print()}
        style={{
          height: 46,
          fontSize: 'calc(13px * var(--text-scale, 1))',
          letterSpacing: '0.1em',
          textTransform: 'uppercase',
          marginTop: 14,
        }}
      >
        Print this screen
      </button>

      <button
        type="button"
        className="btn btn-secondary btn-block"
        onClick={() => dispatch({ type: 'go', screen: 'deck' })}
        style={{ height: 44, marginTop: 8 }}
      >
        Build a PowerPoint deck
      </button>

      <div
        style={{ fontSize: 'calc(11.5px * var(--text-scale, 1))', opacity: 0.55, lineHeight: 1.5, marginTop: 10, textWrap: 'pretty' }}
      >
        {prebuilt ? (
          <>
            The two files are written by <code style={{ fontSize: 'calc(11px * var(--text-scale, 1))' }}>pipeline/handout.py</code>{' '}
            from the same data this screen reads, so they cannot drift from the app. Anything you
            have added yourself is in the app but not yet in the files — the printable view has it.
          </>
        ) : (
          <>
            No .pdf or .docx is built for {guide.code}. Those two are written offline for the
            sample courses only; for your own courses the printable view is the route — every
            browser saves it as a PDF, and it always has everything you have added.
          </>
        )}
      </div>

      <SectionLabel>The whole guide, in order</SectionLabel>
      {guide.units.map((u, i) => (
        <div key={u.name} style={{ marginTop: 14 }}>
          <div style={{ fontFamily: 'var(--font-heading)', fontSize: 'calc(17px * var(--text-scale, 1))', lineHeight: 1.2 }}>
            {i + 1}. {u.name}
          </div>
          {u.cards.map((c) => (
            <div key={c.q} style={{ marginTop: 8 }}>
              <div style={{ fontSize: 'calc(13.5px * var(--text-scale, 1))', fontWeight: 600, lineHeight: 1.35 }}>{c.q}</div>
              <div style={{ fontSize: 'calc(13.5px * var(--text-scale, 1))', opacity: 0.8, lineHeight: 1.5, marginTop: 2 }}>
                {c.a}
              </div>
            </div>
          ))}
        </div>
      ))}
    </>
  );
}

function Figures() {
  const { state } = useStore();
  const { guide, figures: figMap, extras } = useLive(state.guideId);

  const unitFigures = Object.keys(figMap)
    .map(Number)
    .sort((a, b) => a - b)
    .map((i) => ({ figure: figMap[i]!, unit: guide.units[i]?.name }));

  if (unitFigures.length === 0 && extras.length === 0) {
    return (
      <div style={{ fontSize: 'calc(13px * var(--text-scale, 1))', opacity: 0.65, marginTop: 14 }}>
        No figures in this guide yet.
      </div>
    );
  }

  return (
    <>
      <div style={{ fontSize: 'calc(13px * var(--text-scale, 1))', opacity: 0.65, marginTop: 14, textWrap: 'pretty' }}>
        Every figure the guide draws, at phone size. These are the ones worth being able to sketch
        from memory.
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16, marginTop: 16 }}>
        {unitFigures.map((f, i) => (
          <FigureCard key={`u${i}`} figure={f.figure} unit={f.unit} />
        ))}
        {extras.map((f, i) => (
          <FigureCard key={`x${i}`} figure={f} unit="Also worth knowing" />
        ))}
      </div>
    </>
  );
}

function Cases() {
  const { state, catalog } = useStore();
  const { guide } = useLive(state.guideId);
  const examples = catalog.examples[state.guideId] ?? [];

  return (
    <>
      <div style={{ fontSize: 'calc(13px * var(--text-scale, 1))', opacity: 0.65, marginTop: 14, textWrap: 'pretty' }}>
        The concepts pointed at things you can actually see. All four professors grade on applying
        an idea to a case you have not met before — this is the rep for that.
      </div>

      {guide.cases && guide.cases.length > 0 && (
        <>
          <SectionLabel>The debates, claim by claim</SectionLabel>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 11 }}>
            {guide.cases.map((c) => (
              <Blueprint key={c.title} style={{ padding: '14px 15px' }}>
                <div className="kicker">{c.when}</div>
                <div
                  style={{
                    fontFamily: 'var(--font-heading)',
                    fontSize: 'calc(19px * var(--text-scale, 1))',
                    lineHeight: 1.15,
                    marginTop: 4,
                    textWrap: 'pretty',
                  }}
                >
                  {c.title}
                </div>
                {(
                  [
                    ['Claim', c.claim],
                    ['Test', c.test],
                    ['Verdict', c.verdict],
                  ] as const
                ).map(([label, body]) => (
                  <div key={label} style={{ marginTop: 10 }}>
                    <div
                      style={{
                        fontFamily: 'var(--font-heading)',
                        fontSize: 'calc(10px * var(--text-scale, 1))',
                        letterSpacing: '0.16em',
                        textTransform: 'uppercase',
                        color: 'var(--app-accent)',
                      }}
                    >
                      {label}
                    </div>
                    <div
                      style={{
                        fontSize: 'calc(13.5px * var(--text-scale, 1))',
                        lineHeight: 1.5,
                        opacity: 0.8,
                        marginTop: 2,
                        textWrap: 'pretty',
                      }}
                    >
                      {body}
                    </div>
                  </div>
                ))}
                <div
                  style={{
                    fontSize: 'calc(12px * var(--text-scale, 1))',
                    opacity: 0.6,
                    lineHeight: 1.45,
                    marginTop: 10,
                    paddingTop: 9,
                    borderTop: '1px solid var(--app-line)',
                    textWrap: 'pretty',
                  }}
                >
                  Methods lesson — {c.lesson}
                </div>
              </Blueprint>
            ))}
          </div>
        </>
      )}

      <SectionLabel>Apply it</SectionLabel>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 11 }}>
        {examples.map((e) => (
          <Blueprint key={e.t} style={{ padding: '14px 15px' }}>
            <span className="tag tag-accent">{e.tag}</span>
            <div
              style={{
                fontFamily: 'var(--font-heading)',
                fontSize: 'calc(19px * var(--text-scale, 1))',
                lineHeight: 1.15,
                marginTop: 8,
                textWrap: 'pretty',
              }}
            >
              {e.t}
            </div>
            <div
              style={{
                fontSize: 'calc(14px * var(--text-scale, 1))',
                lineHeight: 1.5,
                opacity: 0.78,
                marginTop: 4,
                textWrap: 'pretty',
              }}
            >
              {e.d}
            </div>
          </Blueprint>
        ))}
      </div>
    </>
  );
}

function Cram() {
  const { state, catalog } = useStore();
  const { guide, updates } = useLive(state.guideId);
  const notes = updates.filter((u) => u.body);

  return (
    <>
      {guide.frames && guide.frames.length > 0 && (
        <>
          <SectionLabel>{catalog.frameLabels[state.guideId]}</SectionLabel>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {guide.frames.map((f) => (
              <Blueprint key={f.t} plain style={{ padding: '13px 14px' }}>
                <div style={{ fontFamily: 'var(--font-heading)', fontSize: 'calc(17px * var(--text-scale, 1))', lineHeight: 1.15 }}>
                  {f.t}
                </div>
                <div
                  style={{
                    fontSize: 'calc(13px * var(--text-scale, 1))',
                    opacity: 0.72,
                    lineHeight: 1.45,
                    marginTop: 4,
                    textWrap: 'pretty',
                  }}
                >
                  {f.d}
                </div>
              </Blueprint>
            ))}
          </div>
        </>
      )}

      <SectionLabel>Terms you keep missing</SectionLabel>
      {guide.terms.map((t) => (
        <div key={t.t} style={{ padding: '11px 0', borderBottom: '1px solid var(--app-line)' }}>
          <div style={{ fontFamily: 'var(--font-heading)', fontSize: 'calc(17px * var(--text-scale, 1))' }}>{t.t}</div>
          <div style={{ fontSize: 'calc(13px * var(--text-scale, 1))', opacity: 0.72, lineHeight: 1.45, marginTop: 2 }}>{t.d}</div>
        </div>
      ))}

      {notes.length > 0 && (
        <>
          <SectionLabel>Added since the guide was made</SectionLabel>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {notes.map((n) => (
              <Blueprint key={n.id} plain style={{ padding: '13px 14px' }}>
                <div className="kicker">
                  {n.source || 'Yours'}
                  {n.unit !== null && guide.units[n.unit] ? ` · ${guide.units[n.unit].name}` : ''}
                </div>
                <div style={{ fontFamily: 'var(--font-heading)', fontSize: 'calc(17px * var(--text-scale, 1))', marginTop: 4 }}>
                  {n.title || 'Note'}
                </div>
                <div
                  style={{
                    fontSize: 'calc(13px * var(--text-scale, 1))',
                    opacity: 0.75,
                    lineHeight: 1.5,
                    marginTop: 4,
                    whiteSpace: 'pre-wrap',
                    textWrap: 'pretty',
                  }}
                >
                  {n.body}
                </div>
              </Blueprint>
            ))}
          </div>
        </>
      )}

      {guide.selfTest && (
        <>
          <SectionLabel>Answer these out loud</SectionLabel>
          {guide.selfTest.map((c, i) => (
            <details
              key={c.q}
              style={{ padding: '11px 0', borderBottom: '1px solid var(--app-line)' }}
            >
              <summary
                style={{
                  fontFamily: 'var(--font-heading)',
                  fontSize: 'calc(16px * var(--text-scale, 1))',
                  lineHeight: 1.25,
                  cursor: 'pointer',
                  listStyle: 'none',
                }}
              >
                <span style={{ color: 'var(--app-accent)', marginRight: 8 }}>{i + 1}</span>
                {c.q}
              </summary>
              <div
                style={{
                  fontSize: 'calc(13.5px * var(--text-scale, 1))',
                  opacity: 0.78,
                  lineHeight: 1.5,
                  marginTop: 6,
                  textWrap: 'pretty',
                }}
              >
                {c.a}
              </div>
            </details>
          ))}
        </>
      )}
    </>
  );
}

function Listen() {
  const { state, dispatch, catalog } = useStore();
  const { guide, updates } = useLive(state.guideId);
  const addedSince = updates.reduce((n, u) => n + u.cards.length, 0);
  const pod = catalog.podcast[state.guideId];
  const audioRef = useRef<HTMLAudioElement>(null);

  const episode = useMemo(() => {
    if (pod.editions.length === 0) return null;
    return pod.editions.find((e) => e.id === state.episodeId) ?? pod.editions[0];
  }, [pod.editions, state.episodeId]);

  if (!episode) {
    return (
      <Blueprint style={{ padding: 16, marginTop: 14, background: 'var(--app-hero)' }}>
        <div className="kicker">Field guide, spoken</div>
        <div className="chrome-text" style={{ fontSize: 'calc(26px * var(--text-scale, 1))', marginTop: 8 }}>
          Not recorded yet
        </div>
        <div style={{ fontSize: 'calc(13px * var(--text-scale, 1))', opacity: 0.8, marginTop: 6 }}>{pod.blurb}</div>
      </Blueprint>
    );
  }

  const seek = (seconds: number) => {
    const el = audioRef.current;
    if (!el) return;
    el.currentTime = seconds;
    void el.play();
  };

  return (
    <>
      {pod.editions.length > 1 && (
        <div style={{ marginTop: 14 }}>
          <ChipRow
            options={pod.editions.map((e) => e.label)}
            value={episode.label}
            onChange={(label) => {
              const next = pod.editions.find((e) => e.label === label);
              if (next) dispatch({ type: 'setEpisode', id: next.id });
            }}
          />
        </div>
      )}

      <Blueprint style={{ padding: 16, marginTop: 14, background: 'var(--app-hero)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
          <div className="kicker">Field guide, spoken</div>
          <div
            style={{
              fontFamily: 'var(--font-heading)',
              fontSize: 'calc(11px * var(--text-scale, 1))',
              letterSpacing: '0.14em',
              color: 'var(--app-accent-deep)',
            }}
          >
            {episode.len}
          </div>
        </div>
        <div className="chrome-text" style={{ fontSize: 'calc(28px * var(--text-scale, 1))', lineHeight: 1.06, marginTop: 8 }}>
          {guide.code}
        </div>
        <div
          style={{
            fontSize: 'calc(13px * var(--text-scale, 1))',
            opacity: 0.82,
            lineHeight: 1.45,
            marginTop: 6,
            textWrap: 'pretty',
          }}
        >
          {episode.blurb}
        </div>

        {episode.ready ? (
          <audio
            ref={audioRef}
            controls
            preload="metadata"
            src={asset(episode.file)}
            style={{ width: '100%', marginTop: 14, height: 36 }}
          >
            <track kind="captions" />
          </audio>
        ) : (
          <div
            style={{
              marginTop: 14,
              paddingTop: 12,
              borderTop: '1px solid var(--app-line)',
              fontSize: 'calc(12px * var(--text-scale, 1))',
              opacity: 0.7,
              fontFamily: 'var(--font-heading)',
              letterSpacing: '0.08em',
              textTransform: 'uppercase',
            }}
          >
            Episode not recorded yet — chapters below are the running order
          </div>
        )}
      </Blueprint>

      {addedSince > 0 && (
        <div
          style={{
            fontSize: 'calc(12px * var(--text-scale, 1))',
            opacity: 0.65,
            marginTop: 10,
            lineHeight: 1.45,
            textWrap: 'pretty',
          }}
        >
          {addedSince} {addedSince === 1 ? 'card has' : 'cards have'} been added since this was
          recorded. Cards, Read, Quiz and Cram have them; the recording does not.
        </div>
      )}

      <SectionLabel style={{ margin: '22px 0 4px' }}>Chapters</SectionLabel>
      {episode.chapters.map((c) => (
        <button
          key={c.t + c.name}
          type="button"
          className="bare tappable"
          onClick={() => episode.ready && seek(c.s)}
          disabled={!episode.ready}
          style={{
            display: 'flex',
            gap: 14,
            alignItems: 'baseline',
            padding: '11px 0',
            borderBottom: '1px solid var(--app-line)',
            cursor: episode.ready ? 'pointer' : 'default',
          }}
        >
          <span
            style={{
              width: 48,
              flex: 'none',
              fontFamily: 'var(--font-heading)',
              fontSize: 'calc(14px * var(--text-scale, 1))',
              color: 'var(--app-accent)',
            }}
          >
            {c.t}
          </span>
          <span style={{ flex: 1, minWidth: 0, fontSize: 'calc(14px * var(--text-scale, 1))', lineHeight: 1.3 }}>{c.name}</span>
        </button>
      ))}
    </>
  );
}
