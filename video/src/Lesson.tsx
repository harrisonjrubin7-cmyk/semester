import {
  AbsoluteFill,
  Audio,
  interpolate,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from 'remotion';
import { cueIndexAt } from '../../app/src/lib/beats';
import { tokensFor } from '../../app/src/lib/look';
import type { Lesson, LessonCue } from '../../app/src/lib/types';
import { slideScale } from './fit';

/**
 * A narrated lesson, as a real video.
 *
 * `pipeline/lessons.py --mp4` already wrote an MP4, and what it drew was a
 * flat `0x0a0b0e` rectangle with the voice over it — its own comment says the
 * app renders the real thing. This is the real thing, rendered: the same type
 * the player draws, on the same surfaces, moving on the same cues.
 *
 * Nothing here decides *what* is on screen or *when*. The slide is chosen by
 * `cueIndexAt`, which the player itself calls, and the colours come out of
 * `tokensFor`, which is where every surface in the app comes from. Both are
 * imported across the repo root rather than copied, because a video that
 * disagrees with the app about which answer goes with which question is worse
 * than no video — and a palette retyped here would be a thirteenth ground
 * nobody audited. `lib/contrast.test.ts` walks the real ones.
 */

/*
 * Extends `Record<string, unknown>` because Remotion's `Composition` requires
 * it: props cross into the renderer as JSON, so the type has to admit being
 * an object of unknown values. The four fields below are still checked.
 */
export interface LessonVideoProps extends Record<string, unknown> {
  lesson: Lesson;
  /** Course code, e.g. "ECON 1020" — the one thing not in the lesson. */
  code: string;
  /** Ground and accent ids, as `lib/look.ts` names them. */
  ground: string;
  accent: string;
}

/** The seconds a cue is on screen, for the animation that introduces it. */
function cueStart(cues: readonly LessonCue[], index: number): number {
  return cues[index]?.at ?? 0;
}

/**
 * The kicker over each slide.
 *
 * Lifted from the player rather than reworded: "Question" over a question and
 * "Answer" over an answer is what a student reading along already knows.
 */
function kickerFor(kind: LessonCue['kind'] | undefined): string {
  if (kind === 'title') return 'Lesson';
  if (kind === 'close') return 'That is the unit';
  if (kind === 'q') return 'Question';
  return 'Answer';
}

export function LessonVideo({ lesson, code, ground, accent }: LessonVideoProps) {
  const frame = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();
  const seconds = frame / fps;

  const cues = lesson.cues ?? [];
  const index = cueIndexAt(cues, seconds);
  const cue = cues[index];
  const tokens = tokensFor({ ground, accent }, false);

  /*
   * The slide arrives rather than cutting.
   *
   * 0.42s from the cue's own second, which is inside the gap the renderer
   * leaves between beats (`GAP_TURN` in `pipeline/lessons.py`), so the motion
   * finishes before the next sentence starts and never runs under one.
   */
  const since = seconds - cueStart(cues, index);
  const enter = interpolate(since, [0, 0.42], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const rise = interpolate(enter, [0, 1], [18, 0]);

  const progress = lesson.seconds > 0 ? Math.min(seconds / lesson.seconds, 1) : 0;

  const fg = tokens['--app-fg'];
  const pad = Math.round(width * 0.075);
  const cardPad = Math.round(width * 0.055);

  /*
   * Shrink the type when the words need it, and only then. See `fit.ts` —
   * the numbers below are the frame this composition actually draws, so the
   * estimate is made against the real geometry rather than a nominal one.
   */
  const question = cue?.kind === 'a' ? (cues[index - 1]?.text ?? '') : '';
  const body = cue?.text ?? '';
  const bodySize = Math.round(height * 0.042);
  const headSize = Math.round(height * 0.052);
  const scale = slideScale({
    chars: body.length + question.length,
    innerWidth: width - 2 * pad - 2 * cardPad,
    // What is left once the running head and the progress track have taken
    // theirs, and the card's own padding with it.
    available: height - 2 * pad - Math.round(height * 0.11) - 2 * cardPad,
    bodySize,
    lineHeight: 1.5,
    overhead: Math.round(height * 0.026) + headSize * 1.15 + Math.round(height * 0.058),
  });
  const big = (px: number) => Math.round(px * scale);

  return (
    <AbsoluteFill
      style={{
        background: tokens['--app-bg'],
        color: fg,
        fontFamily: 'Barlow, system-ui, sans-serif',
        padding: pad,
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      {/*
       * The audio is the lesson; everything above is drawn to it.
       *
       * `lesson.file` is the path the app plays — "/audio/lessons/econ/unit-3.mp3".
       * `remotion.config.ts` points the public directory at `app/public`, so the
       * same string addresses the same file and the 46MB of MP3s are not copied
       * into a second place to go stale.
       */}
      <Audio src={staticFile(lesson.file.replace(/^\//, ''))} />

      {/*
       * Running head: which course, which unit. Steady, so the eye ignores it.
       *
       * A row in the column rather than a layer over it. As an `AbsoluteFill`
       * this floated above a slide that was centred in the whole frame, so the
       * two were only ever *nearly* colliding — 45px apart on the longest ECON
       * answer, and the longest slide in the four courses is half as long
       * again. Laid out as siblings, the card takes the space that is left and
       * the overlap cannot happen at any length.
       */}
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
          <div
            style={{
              fontSize: Math.round(height * 0.024),
              letterSpacing: '0.22em',
              textTransform: 'uppercase',
              color: tokens['--app-accent-deep'],
            }}
          >
            {code}
          </div>
          <div style={{ fontSize: Math.round(height * 0.024), opacity: 0.55 }}>{lesson.len}</div>
        </div>
        <div
          style={{
            fontSize: Math.round(height * 0.032),
            marginTop: Math.round(height * 0.012),
            opacity: 0.72,
          }}
        >
          {lesson.title}
        </div>
      </div>

      {/* The slide, centred in whatever the head and the track leave. */}
      <div
        style={{
          flex: 1,
          minHeight: 0,
          display: 'flex',
          alignItems: 'center',
          paddingTop: Math.round(height * 0.02),
          paddingBottom: Math.round(height * 0.02),
        }}
      >
        <div
          style={{
            width: '100%',
            background: tokens['--app-hero'],
            borderRadius: 18,
            padding: cardPad,
            transform: `translateY(${rise}px)`,
            opacity: enter,
          }}
        >
          <div
            style={{
              fontSize: big(Math.round(height * 0.026)),
              letterSpacing: '0.22em',
              textTransform: 'uppercase',
              color: tokens['--app-accent-deep'],
            }}
          >
            {kickerFor(cue?.kind)}
          </div>

          {cue?.kind === 'title' || cue?.kind === 'close' ? (
            <div
              style={{
                fontSize: big(Math.round(height * 0.082)),
                lineHeight: 1.08,
                marginTop: big(Math.round(height * 0.03)),
                textWrap: 'pretty',
              }}
            >
              {cue.text}
            </div>
          ) : (
            <>
              {/*
               * An answer keeps its question above it, faded — the player does
               * this, and on a screen you cannot scroll back it matters more:
               * an answer alone is a sentence with no subject.
               */}
              <div
                style={{
                  fontSize: big(headSize),
                  lineHeight: 1.15,
                  marginTop: big(Math.round(height * 0.03)),
                  textWrap: 'pretty',
                  opacity: cue?.kind === 'a' ? 0.55 : 1,
                }}
              >
                {cue?.kind === 'a' ? cues[index - 1]?.text : cue?.text}
              </div>
              {cue?.kind === 'a' && (
                <div
                  style={{
                    fontSize: big(bodySize),
                    lineHeight: 1.5,
                    marginTop: big(Math.round(height * 0.028)),
                    textWrap: 'pretty',
                  }}
                >
                  {cue.text}
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* How far in, on the track the app uses for the same job. */}
      <div style={{ height: 6, background: tokens['--app-track'], borderRadius: 3 }}>
        <div
          style={{
            height: 6,
            width: `${progress * 100}%`,
            background: tokens['--app-accent'],
            borderRadius: 3,
          }}
        />
      </div>
    </AbsoluteFill>
  );
}

/**
 * Remotion needs a frame count before it renders, and the lesson knows it.
 *
 * A tail beyond the narration so the closing slide is readable rather than
 * cut on the last syllable.
 */
export const TAIL_SECONDS = 1.5;

export function durationFor(lesson: Lesson, fps: number): number {
  return Math.max(1, Math.round((lesson.seconds + TAIL_SECONDS) * fps));
}

