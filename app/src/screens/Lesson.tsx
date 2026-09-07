import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { nowPlaying, playbackIs } from '../lib/device';
import { useKeepAwake } from '../lib/awake';
import { useStore } from '../state/store';
import { Page } from '../components/Page';
import { useLive } from '../lib/live';
import { Blueprint } from '../components/Blueprint';
import { SectionLabel } from '../components/ui';
import { ChevronLeft, ChevronRight } from '../components/Icons';
import { FigureCard } from '../components/FigureCard';
import { asset } from '../lib/asset';
import type { Figure, LessonCue, StudyCard } from '../lib/types';

const SPEEDS = [1, 1.25, 1.5];

function mmss(seconds: number): string {
  const t = Math.max(0, Math.round(seconds));
  return `${Math.floor(t / 60)}:${String(t % 60).padStart(2, '0')}`;
}

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
const BEAT_TITLE = {
  fontFamily: 'var(--font-heading)',
  fontSize: 'calc(22px * var(--text-scale, 1))',
  lineHeight: 1.15,
  marginTop: 'var(--sp-5)',
  textWrap: 'pretty',
} as const;

const BEAT_BODY = {
  fontSize: 'calc(14.5px * var(--text-scale, 1))',
  lineHeight: 1.55,
  opacity: 0.82,
  marginTop: 'var(--sp-5)',
  whiteSpace: 'pre-wrap',
} as const;

export function LessonPlayer() {
  const { state, dispatch } = useStore();
  const { guide, lessons, figures, onUnit, figuresOn } = useLive(state.guideId);
  const unit = state.lessonUnit;
  const lesson = lessons[unit];

  const audioRef = useRef<HTMLAudioElement>(null);
  const [time, setTime] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(1);
  const [extra, setExtra] = useState(0);

  // A lesson is minutes of audio with slides that change under it. The screen
  // locking halfway through is the whole reason people give up on it.
  useKeepAwake(playing);

  const cues: LessonCue[] = useMemo(() => lesson?.cues ?? [], [lesson]);
  const index = useMemo(() => {
    let i = 0;
    for (let n = 0; n < cues.length; n += 1) if (cues[n].at <= time + 0.15) i = n;
    return i;
  }, [cues, time]);

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
    const el = audioRef.current;
    if (!el) return;
    el.currentTime = Math.max(0, seconds);
    setTime(el.currentTime);
    void el.play();
  }, []);

  // The lock screen, the headphone button and the car stereo. A lesson is
  // exactly the thing you listen to walking across campus with the phone in a
  // pocket, and pausing one used to mean taking it out. See `lib/device.ts`.
  useEffect(() => {
    if (!lesson) return;
    nowPlaying(
      { title: lesson.title || `Unit ${unit + 1}`, course: guide.code, album: guide.name },
      {
        play: () => void audioRef.current?.play(),
        pause: () => audioRef.current?.pause(),
        seekbackward: () => seek((audioRef.current?.currentTime ?? 0) - 15),
        seekforward: () => seek((audioRef.current?.currentTime ?? 0) + 15),
      },
    );
    // Cleared on the way out, so a lesson you have left is not still sitting
    // on the lock screen.
    return () => nowPlaying(null);
  }, [lesson, unit, guide.code, guide.name, seek]);

  useEffect(() => {
    playbackIs(playing ? 'playing' : 'paused');
  }, [playing]);

  // Speed is a player setting, not a per-file one, so it has to be re-applied
  // whenever the element is swapped for another unit's audio.
  useEffect(() => {
    if (audioRef.current) audioRef.current.playbackRate = speed;
  }, [speed, unit]);

  // A different unit is a different lesson: back to the start, and out of the
  // added-slides tail. Done during render, so there is no second pass.
  const [playingUnit, setPlayingUnit] = useState(unit);
  if (playingUnit !== unit) {
    setPlayingUnit(unit);
    setTime(0);
    setExtra(0);
  }

  const withLesson = Object.keys(lessons).map(Number).sort((a, b) => a - b);
  const here = withLesson.indexOf(unit);
  const prevUnit = here > 0 ? withLesson[here - 1] : null;
  const nextUnit = here >= 0 && here < withLesson.length - 1 ? withLesson[here + 1] : null;

  if (!lesson) {
    return (
      <Page>
        <Blueprint style={{ padding: 'var(--sp-7)', background: 'var(--app-hero)' }}>
          <div className="kicker">No lesson yet</div>
          <div className="chrome-text" style={{ fontSize: 'var(--type-xl)', marginTop: 'var(--sp-4)', lineHeight: 1.1 }}>
            {guide.units[unit]?.name ?? 'This unit'} has not been recorded
          </div>
          <div style={{ fontSize: 'var(--type-base)', opacity: 0.75, marginTop: 'var(--sp-4)', lineHeight: 'var(--leading-relaxed)' }}>
            Lessons are rendered by the pipeline, one per unit:{' '}
            <code style={{ fontSize: 'var(--type-sm)' }}>python3 pipeline/lessons.py {state.guideId}</code>
          </div>
        </Blueprint>
      </Page>
    );
  }

  const cue = cues[index];
  const pct = lesson.seconds ? Math.min(100, (time / lesson.seconds) * 100) : 0;
  const finished = time >= lesson.seconds - 0.5;
  const showingExtra = finished && added.length > 0 && extra > 0;
  const beat = showingExtra ? added[Math.min(extra - 1, added.length - 1)] : null;

  return (
    <Page>
      <div className="kicker">
        Unit {unit + 1} of {guide.units.length} · {lesson.len}
      </div>
      <div style={{ fontSize: 'var(--type-lg)', lineHeight: 'var(--leading-tight)', marginTop: 3 }}>{lesson.title}</div>

      {/* ── the slide ─────────────────────────────────────────────────── */}
      <Blueprint
        style={{
          marginTop: 14,
          padding: 20,
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
            <div className="kicker" style={{ opacity: 0.7 }}>
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
                style={{ fontSize: 'calc(30px * var(--text-scale, 1))', lineHeight: 1.08, marginTop: 'var(--sp-5)', textWrap: 'pretty' }}
              >
                {cue.text}
              </div>
            ) : (
              <>
                <div
                  style={{
                    fontFamily: 'var(--font-heading)',
                    fontSize: 'calc(22px * var(--text-scale, 1))',
                    lineHeight: 1.15,
                    marginTop: 'var(--sp-5)',
                    textWrap: 'pretty',
                    opacity: cue?.kind === 'a' ? 0.55 : 1,
                  }}
                >
                  {cue?.kind === 'a' ? cues[index - 1]?.text : cue?.text}
                </div>
                {cue?.kind === 'a' && (
                  <div
                    style={{
                      fontSize: 'var(--type-lg)',
                      lineHeight: 1.55,
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
          opacity: 0.5,
          marginTop: 5,
        }}
      >
        <span>{mmss(time)}</span>
        <span>{lesson.len}</span>
      </div>

      <div style={{ display: 'flex', gap: 'var(--sp-4)', alignItems: 'center', marginTop: 'var(--sp-6)' }}>
        <button
          type="button"
          className="btn btn-secondary btn-icon"
          onClick={() => (showingExtra ? setExtra(extra - 1) : seek(cues[Math.max(0, index - 1)].at))}
          aria-label="Previous beat"
        >
          <ChevronLeft size={18} />
        </button>
        <button
          type="button"
          className="btn btn-primary"
          onClick={() => {
            const el = audioRef.current;
            if (!el) return;
            if (el.paused) void el.play();
            else el.pause();
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
          onClick={() => setSpeed(SPEEDS[(SPEEDS.indexOf(speed) + 1) % SPEEDS.length])}
          style={{ fontFamily: 'var(--font-heading)', fontSize: 'var(--type-sm)', width: 54, flex: 'none' }}
        >
          {speed}×
        </button>
      </div>

      <audio
        ref={audioRef}
        preload="metadata"
        src={asset(lesson.file)}
        onTimeUpdate={(e) => setTime(e.currentTarget.currentTime)}
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onEnded={() => {
          setPlaying(false);
          if (added.length > 0 && extra === 0) setExtra(1);
        }}
        style={{ display: 'none' }}
      >
        <track kind="captions" />
      </audio>

      {added.length > 0 && (
        <div
          style={{
            fontSize: 'var(--type-sm)',
            opacity: 0.65,
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
            padding: '10px 0',
            borderBottom: '1px solid var(--app-line)',
            textAlign: 'left',
            opacity: i === index ? 1 : 0.55,
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
            {mmss(c.at)}
          </span>
          <span style={{ flex: 1, minWidth: 0, fontSize: 'calc(13.5px * var(--text-scale, 1))', lineHeight: 1.35 }}>{c.text}</span>
        </button>
      ))}

      <div style={{ display: 'flex', gap: 'var(--sp-4)', marginTop: 18 }}>
        <button
          type="button"
          className="btn btn-secondary"
          disabled={prevUnit === null}
          onClick={() => prevUnit !== null && dispatch({ type: 'openLesson', unit: prevUnit })}
          style={{ flex: 1, height: 42, fontSize: 'var(--type-sm)', textTransform: 'uppercase', letterSpacing: '0.1em' }}
        >
          Previous unit
        </button>
        <button
          type="button"
          className="btn btn-secondary"
          disabled={nextUnit === null}
          onClick={() => nextUnit !== null && dispatch({ type: 'openLesson', unit: nextUnit })}
          style={{ flex: 1, height: 42, fontSize: 'var(--type-sm)', textTransform: 'uppercase', letterSpacing: '0.1em' }}
        >
          Next unit
        </button>
      </div>
    </Page>
  );
}
