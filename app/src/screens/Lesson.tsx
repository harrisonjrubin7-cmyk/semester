import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useStore } from '../state/store';
import { useLive } from '../lib/live';
import { Blueprint } from '../components/Blueprint';
import { SectionLabel } from '../components/ui';
import { ChevronLeft, ChevronRight } from '../components/Icons';
import { FigureCard } from '../components/FigureCard';
import { asset } from '../lib/asset';
import type { LessonCue } from '../lib/types';

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
export function LessonPlayer() {
  const { state, dispatch } = useStore();
  const { guide, lessons, figures, onUnit } = useLive(state.guideId);
  const unit = state.lessonUnit;
  const lesson = lessons[unit];

  const audioRef = useRef<HTMLAudioElement>(null);
  const [time, setTime] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(1);
  const [extra, setExtra] = useState(0);

  const cues: LessonCue[] = useMemo(() => lesson?.cues ?? [], [lesson]);
  const index = useMemo(() => {
    let i = 0;
    for (let n = 0; n < cues.length; n += 1) if (cues[n].at <= time + 0.15) i = n;
    return i;
  }, [cues, time]);

  const added = onUnit(unit).flatMap((u) => u.cards);
  const figure = figures[unit];

  const seek = useCallback((seconds: number) => {
    const el = audioRef.current;
    if (!el) return;
    el.currentTime = Math.max(0, seconds);
    setTime(el.currentTime);
    void el.play();
  }, []);

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
      <div style={{ padding: 18 }}>
        <Blueprint style={{ padding: 16, background: 'var(--app-hero)' }}>
          <div className="kicker">No lesson yet</div>
          <div className="chrome-text" style={{ fontSize: 26, marginTop: 8, lineHeight: 1.1 }}>
            {guide.units[unit]?.name ?? 'This unit'} has not been recorded
          </div>
          <div style={{ fontSize: 13, opacity: 0.75, marginTop: 8, lineHeight: 1.5 }}>
            Lessons are rendered by the pipeline, one per unit:{' '}
            <code style={{ fontSize: 12 }}>python3 pipeline/lessons.py {state.guideId}</code>
          </div>
        </Blueprint>
      </div>
    );
  }

  const cue = cues[index];
  const pct = lesson.seconds ? Math.min(100, (time / lesson.seconds) * 100) : 0;
  const finished = time >= lesson.seconds - 0.5;
  const showingExtra = finished && added.length > 0 && extra > 0;
  const extraCard = showingExtra ? added[Math.min(extra - 1, added.length - 1)] : null;

  return (
    <div style={{ padding: 18 }}>
      <div className="kicker">
        Unit {unit + 1} of {guide.units.length} · {lesson.len}
      </div>
      <div style={{ fontSize: 15, lineHeight: 1.3, marginTop: 3 }}>{lesson.title}</div>

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
        {extraCard ? (
          <>
            <div className="kicker" style={{ color: 'var(--app-accent)' }}>
              Added since this was recorded · {extra} of {added.length}
            </div>
            <div
              style={{
                fontFamily: 'var(--font-heading)',
                fontSize: 22,
                lineHeight: 1.15,
                marginTop: 10,
                textWrap: 'pretty',
              }}
            >
              {extraCard.q}
            </div>
            <div style={{ fontSize: 14.5, lineHeight: 1.55, opacity: 0.82, marginTop: 10 }}>
              {extraCard.a}
            </div>
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
                style={{ fontSize: 30, lineHeight: 1.08, marginTop: 10, textWrap: 'pretty' }}
              >
                {cue.text}
              </div>
            ) : (
              <>
                <div
                  style={{
                    fontFamily: 'var(--font-heading)',
                    fontSize: 22,
                    lineHeight: 1.15,
                    marginTop: 10,
                    textWrap: 'pretty',
                    opacity: cue?.kind === 'a' ? 0.55 : 1,
                  }}
                >
                  {cue?.kind === 'a' ? cues[index - 1]?.text : cue?.text}
                </div>
                {cue?.kind === 'a' && (
                  <div
                    style={{
                      fontSize: 15,
                      lineHeight: 1.55,
                      marginTop: 12,
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
        style={{ height: 4, background: 'var(--app-track)', marginTop: 12, cursor: 'pointer' }}
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
          fontSize: 11,
          letterSpacing: '0.1em',
          opacity: 0.5,
          marginTop: 5,
        }}
      >
        <span>{mmss(time)}</span>
        <span>{lesson.len}</span>
      </div>

      <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 12 }}>
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
            fontSize: 14,
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
          style={{ fontFamily: 'var(--font-heading)', fontSize: 12, width: 54, flex: 'none' }}
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
            fontSize: 12,
            opacity: 0.65,
            marginTop: 10,
            lineHeight: 1.45,
            textWrap: 'pretty',
          }}
        >
          {added.length} {added.length === 1 ? 'card was' : 'cards were'} added to this unit after
          the narration was recorded. They play as slides at the end — re-render the lesson to have
          them read aloud.
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
            gap: 12,
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
              fontSize: 13,
              color: i === index ? 'var(--app-accent)' : 'inherit',
            }}
          >
            {mmss(c.at)}
          </span>
          <span style={{ flex: 1, minWidth: 0, fontSize: 13.5, lineHeight: 1.35 }}>{c.text}</span>
        </button>
      ))}

      <div style={{ display: 'flex', gap: 8, marginTop: 18 }}>
        <button
          type="button"
          className="btn btn-secondary"
          disabled={prevUnit === null}
          onClick={() => prevUnit !== null && dispatch({ type: 'openLesson', unit: prevUnit })}
          style={{ flex: 1, height: 42, fontSize: 12, textTransform: 'uppercase', letterSpacing: '0.1em' }}
        >
          Previous unit
        </button>
        <button
          type="button"
          className="btn btn-secondary"
          disabled={nextUnit === null}
          onClick={() => nextUnit !== null && dispatch({ type: 'openLesson', unit: nextUnit })}
          style={{ flex: 1, height: 42, fontSize: 12, textTransform: 'uppercase', letterSpacing: '0.1em' }}
        >
          Next unit
        </button>
      </div>
      <div style={{ height: 22 }} />
    </div>
  );
}
