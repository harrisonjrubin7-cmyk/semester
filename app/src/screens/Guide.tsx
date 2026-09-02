import { useMemo, useRef } from 'react';
import { useStore } from '../state/store';
import { Blueprint } from '../components/Blueprint';
import { ChipRow, Meter, SectionLabel } from '../components/ui';
import { ChevronRight } from '../components/Icons';
import { FigureCard } from '../components/FigureCard';
import { GUIDES, FRAME_LABELS, allCards, weakestUnit } from '../data/guides';
import { EXTRA_FIGURES, FIGURES } from '../data/figures';
import { PODCAST } from '../data/podcast';
import { EXAMPLES } from '../data/examples';
import { buildQuiz } from '../lib/quiz';
import type { StudyMode } from '../lib/types';

const MODES: { id: StudyMode; label: string }[] = [
  { id: 'cards', label: 'Cards' },
  { id: 'read', label: 'Read' },
  { id: 'quiz', label: 'Quiz' },
  { id: 'figures', label: 'Figures' },
  { id: 'cases', label: 'Cases' },
  { id: 'cram', label: 'Cram' },
  { id: 'listen', label: 'Listen' },
];

export function Guide() {
  const { state, dispatch } = useStore();
  const guide = GUIDES[state.guideId];
  const cards = allCards(guide);
  const weak = weakestUnit(guide);
  const figMap = FIGURES[state.guideId] ?? {};

  return (
    <div style={{ padding: 18 }}>
      <div style={{ fontSize: 15, lineHeight: 1.3 }}>{guide.name}</div>
      <div style={{ fontSize: 13, opacity: 0.6, marginTop: 3 }}>{guide.blurb}</div>

      <div style={{ marginTop: 16 }}>
        <ChipRow
          options={MODES.map((m) => m.label)}
          value={MODES.find((m) => m.id === state.mode)?.label ?? 'Cards'}
          onChange={(label) => {
            const mode = MODES.find((m) => m.label === label);
            if (mode) dispatch({ type: 'setMode', mode: mode.id });
          }}
        />
      </div>

      {state.mode === 'cards' && (
        <>
          <button
            type="button"
            className="btn btn-primary btn-block"
            onClick={() => dispatch({ type: 'startDrill', unit: null })}
            style={{
              height: 48,
              fontSize: 15,
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
              <span style={{ display: 'block', fontSize: 14, lineHeight: 1.25, marginTop: 2 }}>
                {weak.unit.name}
              </span>
              <span style={{ display: 'block', fontSize: 11, opacity: 0.55 }}>
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
                  fontSize: 20,
                  opacity: 0.4,
                }}
              >
                {i + 1}
              </span>
              <span style={{ flex: 1, minWidth: 0 }}>
                <span style={{ display: 'block', fontSize: 15, lineHeight: 1.25 }}>{u.name}</span>
                <span style={{ display: 'block', marginTop: 6 }}>
                  <Meter pct={u.mastery} height={5} />
                </span>
              </span>
              <span
                style={{
                  fontFamily: 'var(--font-heading)',
                  fontSize: 11,
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
                  fontSize: 20,
                  opacity: 0.4,
                }}
              >
                ★
              </span>
              <span style={{ flex: 1, minWidth: 0, fontSize: 15 }}>
                The guide’s own self-test
              </span>
              <span
                style={{
                  fontFamily: 'var(--font-heading)',
                  fontSize: 11,
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
          <div style={{ fontFamily: 'var(--font-heading)', fontSize: 22, lineHeight: 1.1 }}>
            Ten multiple choice
          </div>
          <div
            style={{
              fontSize: 13,
              opacity: 0.7,
              lineHeight: 1.45,
              marginTop: 4,
              textWrap: 'pretty',
            }}
          >
            Pulled at random from every card in the guide, with three decoys drawn from the other
            units — the same recognition work the real exam asks for. Different ten every run.
          </div>
          <button
            type="button"
            className="btn btn-primary btn-block"
            onClick={() =>
              dispatch({ type: 'startQuiz', quiz: buildQuiz(guide, state.quizSeed) })
            }
            style={{
              height: 48,
              fontSize: 15,
              letterSpacing: '0.1em',
              textTransform: 'uppercase',
              marginTop: 14,
            }}
          >
            Start quiz
          </button>
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
                  <span style={{ flex: 1, minWidth: 0, fontSize: 15, lineHeight: 1.25 }}>
                    {u.name}
                  </span>
                  <span
                    style={{
                      fontFamily: 'var(--font-heading)',
                      fontSize: 11,
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
                    {u.cards.map((c) => (
                      <div key={c.q}>
                        <div
                          style={{
                            fontFamily: 'var(--font-heading)',
                            fontSize: 17,
                            lineHeight: 1.2,
                            textWrap: 'pretty',
                          }}
                        >
                          {c.q}
                        </div>
                        <div
                          style={{
                            fontSize: 14,
                            lineHeight: 1.5,
                            opacity: 0.78,
                            marginTop: 3,
                            textWrap: 'pretty',
                          }}
                        >
                          {c.a}
                        </div>
                      </div>
                    ))}
                    {fig && <FigureCard figure={fig} />}
                    <button
                      type="button"
                      className="btn btn-secondary"
                      onClick={() => dispatch({ type: 'startDrill', unit: i })}
                      style={{
                        alignSelf: 'flex-start',
                        fontSize: 11,
                        letterSpacing: '0.12em',
                        textTransform: 'uppercase',
                      }}
                    >
                      Drill this unit
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {state.mode === 'figures' && <Figures />}
      {state.mode === 'cases' && <Cases />}
      {state.mode === 'cram' && <Cram />}
      {state.mode === 'listen' && <Listen />}

      <div
        style={{
          fontSize: 11,
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

function Figures() {
  const { state } = useStore();
  const guide = GUIDES[state.guideId];
  const figMap = FIGURES[state.guideId] ?? {};
  const extras = EXTRA_FIGURES[state.guideId] ?? [];

  const unitFigures = Object.keys(figMap)
    .map(Number)
    .sort((a, b) => a - b)
    .map((i) => ({ figure: figMap[i]!, unit: guide.units[i]?.name }));

  if (unitFigures.length === 0 && extras.length === 0) {
    return (
      <div style={{ fontSize: 13, opacity: 0.65, marginTop: 14 }}>
        No figures in this guide yet.
      </div>
    );
  }

  return (
    <>
      <div style={{ fontSize: 13, opacity: 0.65, marginTop: 14, textWrap: 'pretty' }}>
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
  const { state } = useStore();
  const guide = GUIDES[state.guideId];
  const examples = EXAMPLES[state.guideId] ?? [];

  return (
    <>
      <div style={{ fontSize: 13, opacity: 0.65, marginTop: 14, textWrap: 'pretty' }}>
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
                    fontSize: 19,
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
                        fontSize: 10,
                        letterSpacing: '0.16em',
                        textTransform: 'uppercase',
                        color: 'var(--app-accent)',
                      }}
                    >
                      {label}
                    </div>
                    <div
                      style={{
                        fontSize: 13.5,
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
                    fontSize: 12,
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
                fontSize: 19,
                lineHeight: 1.15,
                marginTop: 8,
                textWrap: 'pretty',
              }}
            >
              {e.t}
            </div>
            <div
              style={{
                fontSize: 14,
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
  const { state } = useStore();
  const guide = GUIDES[state.guideId];

  return (
    <>
      {guide.frames && guide.frames.length > 0 && (
        <>
          <SectionLabel>{FRAME_LABELS[state.guideId]}</SectionLabel>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {guide.frames.map((f) => (
              <Blueprint key={f.t} style={{ padding: '13px 14px' }}>
                <div style={{ fontFamily: 'var(--font-heading)', fontSize: 17, lineHeight: 1.15 }}>
                  {f.t}
                </div>
                <div
                  style={{
                    fontSize: 13,
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
          <div style={{ fontFamily: 'var(--font-heading)', fontSize: 17 }}>{t.t}</div>
          <div style={{ fontSize: 13, opacity: 0.72, lineHeight: 1.45, marginTop: 2 }}>{t.d}</div>
        </div>
      ))}

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
                  fontSize: 16,
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
                  fontSize: 13.5,
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
  const { state, dispatch } = useStore();
  const guide = GUIDES[state.guideId];
  const pod = PODCAST[state.guideId];
  const audioRef = useRef<HTMLAudioElement>(null);

  const episode = useMemo(() => {
    if (pod.editions.length === 0) return null;
    return pod.editions.find((e) => e.id === state.episodeId) ?? pod.editions[0];
  }, [pod.editions, state.episodeId]);

  if (!episode) {
    return (
      <Blueprint style={{ padding: 16, marginTop: 14, background: 'var(--app-hero)' }}>
        <div className="kicker">Field guide, spoken</div>
        <div className="chrome-text" style={{ fontSize: 26, marginTop: 8 }}>
          Not recorded yet
        </div>
        <div style={{ fontSize: 13, opacity: 0.8, marginTop: 6 }}>{pod.blurb}</div>
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
              fontSize: 11,
              letterSpacing: '0.14em',
              color: 'var(--app-accent-deep)',
            }}
          >
            {episode.len}
          </div>
        </div>
        <div className="chrome-text" style={{ fontSize: 28, lineHeight: 1.06, marginTop: 8 }}>
          {guide.code}
        </div>
        <div
          style={{
            fontSize: 13,
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
            src={episode.file}
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
              fontSize: 12,
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
              fontSize: 14,
              color: 'var(--app-accent)',
            }}
          >
            {c.t}
          </span>
          <span style={{ flex: 1, minWidth: 0, fontSize: 14, lineHeight: 1.3 }}>{c.name}</span>
        </button>
      ))}
    </>
  );
}
