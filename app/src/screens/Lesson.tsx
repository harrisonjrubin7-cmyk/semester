import { useCallback, useEffect, useMemo, useState } from 'react';
import { useStore } from '../state/store';
import { useRowStyle } from '../components/shell/useShell';
import { DIMMED_ROW, secondLine } from '../lib/dim';
import { Page } from '../components/Page';
import { useLive } from '../lib/live';
import { Blueprint } from '../components/Blueprint';
import { SectionLabel } from '../components/ui';
import { ChevronLeft, ChevronRight } from '../components/Icons';
import { FigureCard } from '../components/FigureCard';
import { ask, mine, playHere, seekTo, setRate, usePlayback } from '../lib/sound.hook';
import { clock } from '../lib/sound';
import { canSpeak, hush, speakThen } from '../lib/speak';
import { spokenLesson } from '../lib/watch';
import type { Figure, LessonCue, StudyCard } from '../lib/types';
import {
  atFirstBeat,
  atLastBeat,
  cueIndexAt,
  showingExtra as isShowingExtra,
  type BeatPosition,
} from '../lib/beats';

const SPEEDS = [1, 1.25, 1.5];

/**
 * The lesson player.
 *
 * The narration is an audio file; everything on screen is drawn from the cue
 * list the renderer emitted, so the slide is real type at the device's own
 * resolution rather than a video of type. It costs a tenth of what a screen
 * recording would and stays sharp on any phone.
 */

/**
 * One thing added to a unit after its narration was recorded.
 *
 * A lesson is fixed audio with slides under it, so nothing added later can be
 * read aloud without re-rendering the file. What it can do is play afterwards,
 * clearly marked — which is the honest arrangement: the recording is not
 * pretending to cover this.
 */
type Beat =
  | { kind: 'card'; card: StudyCard }
  | { kind: 'figure'; figure: Figure }
  | { kind: 'note'; title: string; text: string; from: string };

/** "two cards and a table" — so the count above it is not a bare number. */
function describeBeats(beats: Beat[]): string {
  const n = (kind: Beat['kind']) => beats.filter((b) => b.kind === kind).length;
  const bits = [
    n('card') && `${n('card')} ${n('card') === 1 ? 'card' : 'cards'}`,
    n('figure') && `${n('figure')} ${n('figure') === 1 ? 'figure' : 'figures'}`,
    n('note') && `${n('note')} ${n('note') === 1 ? 'note' : 'notes'}`,
  ].filter(Boolean) as string[];
  if (bits.length <= 1) return bits[0] ?? '';
  return `${bits.slice(0, -1).join(', ')} and ${bits[bits.length - 1]}`;
}

/*
 * The two type sizes a played-back beat uses, as objects rather than repeated
 * inline — a card and a note are the same slide with different words in it.
 */
/**
 * The slide both players draw on.
 *
 * One frame rather than two sets of the same numbers: a recorded lesson and a
 * spoken one are the same screen with different sources of narration, and two
 * copies of `padding: 20; minHeight: 260` is how they stop being.
 */
const SLIDE = {
  marginTop: 'var(--sp-7)',
  padding: 'var(--sp-7)',
  minHeight: 260,
  display: 'flex',
  flexDirection: 'column',
  justifyContent: 'center',
  background: 'var(--app-hero)',
} as const;

/** The two arrows either side of the play control, in both players. */
const ARROW = { width: 52, height: 44 } as const;

const READ = {
  flex: 1,
  height: 44,
  fontSize: 'var(--type-sm)',
  letterSpacing: '0.1em',
  textTransform: 'uppercase',
} as const;

const TITLE = {
  fontSize: 'var(--type-lg)',
  lineHeight: 'var(--leading-tight)',
  marginTop: 'var(--sp-1)',
} as const;

const BEAT_TITLE = {
  fontFamily: 'var(--font-heading)',
  fontSize: 'var(--type-display)',
  lineHeight: 'var(--leading-display)',
  marginTop: 'var(--sp-5)',
  textWrap: 'pretty',
} as const;

const BEAT_BODY = {
  fontSize: 'calc(14.5px * var(--text-scale, 1))',
  lineHeight: 'var(--leading-relaxed-plus)',
  color: 'var(--app-dim)',
  marginTop: 'var(--sp-5)',
  whiteSpace: 'pre-wrap',
} as const;

export function LessonPlayer() {
  // A row's padding and hairline, from the layout rather than hard-coded.
  const chapterRow = useRowStyle(10);
  const { state } = useStore();
  const { guide, lessons, figures, onUnit, figuresOn } = useLive(state.guideId);
  const unit = state.lessonUnit;
  const lesson = lessons[unit];

  /*
   * The element is not here. It is `components/Sound.tsx`, mounted above every
   * screen, because a screen is unmounted the moment you look at another tab
   * and a lesson is forty minutes long. This screen is a view on it and a set
   * of controls for it: the clock below is the player's, not its own.
   */
  const { time: at, going, rate: speed } = usePlayback();
  const [extra, setExtra] = useState(0);
  /*
   * Whether the sound running is this lesson, in this tab. Another tab may
   * own the player — that is the whole point of moving it — and its clock is
   * not the one to draw under these slides.
   */
  const ours = lesson ? mine(lesson.file) : false;
  const time = ours ? at : 0;
  const playing = ours && going;

  const cues: LessonCue[] = useMemo(() => lesson?.cues ?? [], [lesson]);
  const index = useMemo(() => cueIndexAt(cues, time), [cues, time]);

  const figure = figures[unit];
  /*
   * Everything added to this unit since the narration was recorded, as beats
   * to step through after it ends.
   *
   * This was `flatMap((u) => u.cards)` — cards only. So a reading that brought
   * a table, a process and two paragraphs of prose showed nothing here, and
   * the lesson looked complete when a third of what the unit now holds was not
   * in it. The figures are the ones the unit could not lead with, since the
   * first is already on screen throughout.
   */
  const spare = figuresOn(unit).slice(figure ? 1 : 0);
  const added = useMemo<Beat[]>(() => {
    const out: Beat[] = [];
    for (const up of onUnit(unit)) {
      for (const card of up.cards) out.push({ kind: 'card', card });
      if (up.body) {
        out.push({
          kind: 'note',
          title: up.title || 'Added since',
          text: up.body,
          from: up.source || 'Added by you',
        });
      }
    }
    for (const f of spare) out.push({ kind: 'figure', figure: f });
    return out;
    // `onUnit` and `figuresOn` are stable for a given set of updates; the unit
    // is what actually changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [unit, onUnit, spare.length]);

  const seek = useCallback((seconds: number) => {
    seekTo(Math.max(0, seconds));
  }, []);

  /*
   * The lock screen, the speed and the wake lock all moved up to
   * `components/Sound.tsx` with the element. They have to outlive this
   * screen: pausing a lesson from a pocket has to work while you are looking
   * at the calendar, which is precisely when it is in a pocket.
   *
   * What stays here is the tail. A lesson that has played out and has beats
   * added since steps into the first of them, and this is the only place that
   * knows there are any.
   */
  const ending = lesson ? time >= lesson.seconds - 0.5 : false;
  useEffect(() => {
    if (ending && added.length > 0) setExtra((was) => (was === 0 ? 1 : was));
  }, [ending, added.length]);

  // A different unit is a different lesson: back to the start, and out of the
  // added-slides tail. Done during render, so there is no second pass.
  const [playingUnit, setPlayingUnit] = useState(unit);
  if (playingUnit !== unit) {
    setPlayingUnit(unit);
    setExtra(0);
  }


  /*
   * Nothing recorded for this unit, which for a generated course is every
   * unit. It used to end here, on the name of a Python script somebody
   * without a checkout cannot run. `lib/watch.ts` reads the unit out instead.
   */
  if (!lesson) {
    return <SpokenLesson unit={unit} />;
  }

  const cue = cues[index];
  const pct = lesson.seconds ? Math.min(100, (time / lesson.seconds) * 100) : 0;
  const finished = ending;
  // Where the playhead is, and so which arrows have anywhere to go. The rule
  // lives in `lib/beats.ts`; this screen asks it rather than restating it.
  const where: BeatPosition = {
    index,
    cues: cues.length,
    added: added.length,
    extra,
    finished,
  };
  const showingExtra = isShowingExtra(where);
  const beat = showingExtra ? added[Math.min(extra - 1, added.length - 1)] : null;

  return (
    <Page>
      <div className="kicker">
        Unit {unit + 1} of {guide.units.length} · {lesson.len}
      </div>
      <div style={{ fontSize: 'var(--type-lg)', lineHeight: 'var(--leading-tight)', marginTop: 'calc(3px * var(--density, 1))' }}>{lesson.title}</div>

      {/* ── the slide ─────────────────────────────────────────────────── */}
      <Blueprint
        style={{
          marginTop: 'calc(14px * var(--density, 1))',
          paddingBlock: 'calc(20px * var(--density, 1))', paddingInline: 'calc(20px * var(--density, 1))',
          minHeight: 260,
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          background: 'var(--app-hero)',
        }}
      >
        {beat ? (
          <>
            <div className="kicker" style={{ color: 'var(--app-accent)' }}>
              Added since this was recorded · {extra} of {added.length}
            </div>
            {beat.kind === 'figure' ? (
              <FigureCard figure={beat.figure} />
            ) : (
              <>
                <div style={BEAT_TITLE}>{beat.kind === 'card' ? beat.card.q : beat.title}</div>
                <div style={BEAT_BODY}>{beat.kind === 'card' ? beat.card.a : beat.text}</div>
              </>
            )}
          </>
        ) : (
          <>
            <div className="kicker" style={{ color: 'var(--app-dim)' }}>
              {cue?.kind === 'title'
                ? 'Lesson'
                : cue?.kind === 'close'
                  ? 'That is the unit'
                  : cue?.kind === 'q'
                    ? 'Question'
                    : 'Answer'}
            </div>
            {cue?.kind === 'title' || cue?.kind === 'close' ? (
              <div
                className="chrome-text"
                style={{ fontSize: 'calc(30px * var(--text-scale, 1))', lineHeight: 'var(--leading-display-xl)', marginTop: 'var(--sp-5)', textWrap: 'pretty' }}
              >
                {cue.text}
              </div>
            ) : (
              <>
                <div
                  style={{
                    fontFamily: 'var(--font-heading)',
                    fontSize: 'var(--type-display)',
                    lineHeight: 'var(--leading-display)',
                    marginTop: 'var(--sp-5)',
                    textWrap: 'pretty',
                    ...secondLine(cue?.kind !== 'a'),
                  }}
                >
                  {cue?.kind === 'a' ? cues[index - 1]?.text : cue?.text}
                </div>
                {cue?.kind === 'a' && (
                  <div
                    style={{
                      fontSize: 'var(--type-lg)',
                      lineHeight: 'var(--leading-relaxed-plus)',
                      marginTop: 'var(--sp-6)',
                      textWrap: 'pretty',
                    }}
                  >
                    {cue.text}
                  </div>
                )}
              </>
            )}
          </>
        )}
      </Blueprint>

      {/* ── transport ─────────────────────────────────────────────────── */}
      <div
        style={{ height: 4, background: 'var(--app-track)', marginTop: 'var(--sp-6)', cursor: 'pointer' }}
        onClick={(e) => {
          const box = e.currentTarget.getBoundingClientRect();
          seek(((e.clientX - box.left) / box.width) * lesson.seconds);
        }}
        role="presentation"
      >
        <div style={{ height: '100%', width: `${pct}%`, background: 'var(--chrome)' }} />
      </div>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          fontFamily: 'var(--font-heading)',
          fontSize: 'var(--type-xs)',
          letterSpacing: '0.1em',
          color: 'var(--app-dim)',
          marginTop: 'calc(5px * var(--density, 1))',
        }}
      >
        <span>{clock(time)}</span>
        <span>{lesson.len}</span>
      </div>

      <div style={{ display: 'flex', gap: 'var(--sp-4)', alignItems: 'center', marginTop: 'var(--sp-6)' }}>
        <button
          type="button"
          className="btn btn-secondary btn-icon"
          disabled={atFirstBeat(where)}
          onClick={() => (showingExtra ? setExtra(extra - 1) : seek(cues[Math.max(0, index - 1)].at))}
          aria-label="Previous beat"
        >
          <ChevronLeft size={18} />
        </button>
        <button
          type="button"
          className="btn btn-primary"
          onClick={() => {
            // Pressing Play is what takes the player — not arriving on the
            // screen. Opening a lesson to see what is in it should not start
            // talking, and claiming on mount would also stop whatever another
            // tab was already playing.
            if (!ours) {
              playHere({
                src: lesson.file,
                title: lesson.title || `Unit ${unit + 1}`,
                course: guide.code,
                album: guide.name,
              });
              ask('play');
            } else if (playing) ask('pause');
            else ask('play');
          }}
          style={{
            flex: 1,
            height: 46,
            fontSize: 'var(--type-md)',
            letterSpacing: '0.12em',
            textTransform: 'uppercase',
          }}
        >
          {playing ? 'Pause' : time > 0 ? 'Resume' : 'Play the lesson'}
        </button>
        <button
          type="button"
          className="btn btn-secondary btn-icon"
          disabled={atLastBeat(where)}
          onClick={() => {
            if (finished && added.length > 0 && extra < added.length) setExtra(extra + 1);
            else if (index < cues.length - 1) seek(cues[index + 1].at);
          }}
          aria-label="Next beat"
        >
          <ChevronRight size={18} />
        </button>
        <button
          type="button"
          className="btn btn-secondary"
          onClick={() => setRate(SPEEDS[(SPEEDS.indexOf(speed) + 1) % SPEEDS.length])}
          style={{ fontFamily: 'var(--font-heading)', fontSize: 'var(--type-sm)', width: 54, flex: 'none' }}
        >
          {speed}×
        </button>
      </div>


      {added.length > 0 && (
        <div
          style={{
            fontSize: 'var(--type-sm)',
            color: 'var(--app-dim)',
            marginTop: 'var(--sp-5)',
            lineHeight: 'var(--leading-normal)',
            textWrap: 'pretty',
          }}
        >
          {added.length} {added.length === 1 ? 'thing was' : 'things were'} added to this unit
          after the narration was recorded — {describeBeats(added)}. They play as slides at the end
          — re-render the lesson to have them read aloud.
        </div>
      )}

      {figure && (
        <>
          <SectionLabel>The figure for this unit</SectionLabel>
          <FigureCard figure={figure} />
        </>
      )}

      <SectionLabel>Jump to a beat</SectionLabel>
      {cues.map((c, i) => (
        <button
          key={`${c.at}-${i}`}
          type="button"
          className="bare tappable"
          onClick={() => seek(c.at)}
          style={{
            display: 'flex',
            gap: 'var(--sp-6)',
            alignItems: 'baseline',
            ...chapterRow,
            textAlign: 'left',
            opacity: i === index ? 1 : DIMMED_ROW,
          }}
        >
          <span
            style={{
              width: 44,
              flex: 'none',
              fontFamily: 'var(--font-heading)',
              fontSize: 'var(--type-base)',
              color: i === index ? 'var(--app-accent)' : 'inherit',
            }}
          >
            {clock(c.at)}
          </span>
          <span style={{ flex: 1, minWidth: 0, fontSize: 'var(--type-base-plus)', lineHeight: 'var(--leading-tight-plus)' }}>{c.text}</span>
        </button>
      ))}

      <UnitStep unit={unit} units={guide.units.length} />
    </Page>
  );
}

/**
 * The unit either side, in both players.
 *
 * Every unit, not only the recorded ones — see the note where `nextUnit` is
 * worked out above. Extracted so the spoken player is not a room with one
 * door: a reader who has heard this unit read out should be able to go on to
 * the next one without going back to the guide first.
 */
function UnitStep({ unit, units }: { unit: number; units: number }) {
  /*
   * Every unit, not only the recorded ones.
   *
   * This walked `Object.keys(lessons)` — the units with an mp3 — which was
   * right while a unit without one was a dead end: there was nowhere to send
   * somebody. Now every unit has a lesson of some kind, and the old rule
   * stranded a reader on the last recorded unit with the button greyed out
   * and a unit after it holding three cards this device would read happily.
   *
   * Measured in the browser, on ECON with a reading added as a unit of its
   * own: "unit 11 of 12", `Next unit` disabled, and nothing beyond it
   * reachable from the tab at all.
   */
  const { dispatch } = useStore();
  const go = (to: number) => dispatch({ type: 'openLesson', unit: to });
  return (
    <div style={{ display: 'flex', gap: 'var(--sp-4)', marginTop: 'var(--sp-7)' }}>
      <button
        type="button"
        className="btn btn-secondary"
        disabled={unit === 0}
        onClick={() => go(unit - 1)}
        style={UNIT_BUTTON}
      >
        Previous unit
      </button>
      <button
        type="button"
        className="btn btn-secondary"
        disabled={unit >= units - 1}
        onClick={() => go(unit + 1)}
        style={UNIT_BUTTON}
      >
        Next unit
      </button>
    </div>
  );
}

const UNIT_BUTTON = {
  flex: 1,
  height: 42,
  fontSize: 'var(--type-sm)',
  textTransform: 'uppercase',
  letterSpacing: '0.1em',
} as const;

/**
 * The lesson this unit would have, read by the device.
 *
 * Everything above this plays an mp3 somebody rendered, against a cue list
 * with a second on every cue. This has neither — `lib/watch.ts` has the
 * argument, and the short version is that `speechSynthesis` offers no
 * duration before it speaks and no way to seek, so a spoken lesson has beats
 * rather than a timeline.
 *
 * What that costs is the scrub bar and the speed control, and both are
 * absences rather than approximations: an estimated total printed where the
 * recorded lessons print an exact one is the failure `lib/where.ts` is about.
 * What it keeps is the shape — a slide with real type on it, one beat at a
 * time, arrows either way — so the two players are recognisably the same
 * screen without either claiming to be the other.
 */
export function SpokenLesson({ unit }: { unit: number }) {
  const { state } = useStore();
  const { guide, figuresOn } = useLive(state.guideId);
  const held = guide.units[unit];
  const figures = figuresOn(unit);
  const spoken = useMemo(() => spokenLesson(unit, held, figures), [unit, held, figures]);

  const [at, setAt] = useState(0);
  const [reading, setReading] = useState(false);
  /*
   * Set when an utterance came back having said nothing.
   *
   * Headless Chromium has `speechSynthesis` and no voices, and so does a
   * locked-down browser and a fresh profile on some desktops. `canSpeak`
   * cannot tell — the object is there — so this is found by trying once, and
   * from then on the screen says the same thing it says to a browser with no
   * speech at all.
   */
  const [mute, setMute] = useState(false);
  const beats = spoken?.beats ?? [];
  const last = beats.length - 1;

  // A new unit starts at its first beat, and stops the voice on the old one.
  const [showing, setShowing] = useState(unit);
  if (showing !== unit) {
    setShowing(unit);
    setAt(0);
    setReading(false);
  }

  /*
   * One utterance per beat, and the next beat when it ends.
   *
   * In an effect keyed on the beat rather than in the click handler, because
   * "keep reading" has to survive an advance that the *voice* caused as well
   * as one the reader did — and because leaving the screen mid-sentence has
   * to stop it, which is what the cleanup is.
   */
  useEffect(() => {
    if (!reading) return undefined;
    const beat = beats[Math.min(at, last)];
    if (!beat) return undefined;
    const stop = speakThen(beat.said, 1, (spoke) => {
      if (!spoke) {
        setMute(true);
        setReading(false);
        return;
      }
      setAt((n) => {
        if (n >= last) {
          setReading(false);
          return n;
        }
        return n + 1;
      });
    });
    return stop;
    // `beats` is rebuilt only when the unit changes, and `at` is what moves.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reading, at, unit]);

  useEffect(() => () => hush(), []);

  if (!spoken) {
    return (
      <Page>
        <Blueprint style={{ padding: 'var(--sp-7)', background: 'var(--app-hero)' }}>
          <div className="kicker">Nothing to read yet</div>
          <div className="chrome-text" style={{ fontSize: 'var(--type-xl)', marginTop: 'var(--sp-4)', lineHeight: 'var(--leading-tight)' }}>
            {held?.name ?? 'This unit'} has no cards
          </div>
          <div style={{ fontSize: 'var(--type-base)', color: 'var(--app-dim)', marginTop: 'var(--sp-4)', lineHeight: 'var(--leading-relaxed)' }}>
            A lesson here is the unit&rsquo;s own questions and answers, read out. Add material to
            this unit and it will have one.
          </div>
        </Blueprint>
      </Page>
    );
  }

  const beat = beats[Math.min(at, last)];
  const dumb = mute || !canSpeak();

  return (
    <Page>
      <div className="kicker">
        Unit {unit + 1} of {guide.units.length} · beat {at + 1} of {beats.length}
      </div>
      <div style={TITLE}>{spoken.title}</div>

      <Blueprint style={SLIDE}>
        <div className="kicker" style={secondLine()}>
          {beat.kind === 'title'
            ? 'This unit'
            : beat.kind === 'q'
              ? 'Question'
              : beat.kind === 'a'
                ? 'Answer'
                : beat.kind === 'figure'
                  ? 'Figure'
                  : 'End'}
        </div>
        {beat.kind === 'figure' && beat.figure ? (
          <FigureCard figure={beat.figure} />
        ) : (
          <div style={BEAT_TITLE}>{beat.text}</div>
        )}
      </Blueprint>

      <div style={{ display: 'flex', gap: 'var(--sp-4)', marginTop: 'var(--sp-5)' }}>
        <button
          type="button"
          className="btn btn-secondary"
          aria-label="Previous beat"
          disabled={at === 0}
          onClick={() => setAt((n) => Math.max(0, n - 1))}
          style={ARROW}
        >
          <ChevronLeft />
        </button>
        <button
          type="button"
          className="btn btn-primary"
          disabled={dumb}
          onClick={() => setReading((on) => !on)}
          style={READ}
        >
          {reading ? 'Stop' : 'Read it to me'}
        </button>
        <button
          type="button"
          className="btn btn-secondary"
          aria-label="Next beat"
          disabled={at >= last}
          onClick={() => setAt((n) => Math.min(last, n + 1))}
          style={ARROW}
        >
          <ChevronRight />
        </button>
      </div>

      <UnitStep unit={unit} units={guide.units.length} />

      {/*
        The label §3.3 asks for, on the screen as well as on the mode card.
        A reader who has heard one of the forty-four recorded lessons should
        be able to tell in one sentence that this is not one of them.
      */}
      <div
        style={{
          ...secondLine(),
          fontSize: 'var(--type-sm)',
          marginTop: 'var(--sp-5)',
          lineHeight: 'var(--leading-relaxed)',
          textWrap: 'pretty',
        }}
      >
        {dumb
          ? 'Nothing is recorded for this unit, and this browser will not read aloud — so this is the unit in slides, which you can step through.'
          : 'Nothing is recorded for this unit. This is your device reading the unit’s own cards, one at a time — not a recording, so there is no scrub bar and no stated length.'}
      </div>
    </Page>
  );
}
