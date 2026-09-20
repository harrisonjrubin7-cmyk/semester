import { AbsoluteFill, Audio, interpolate, staticFile, useCurrentFrame, useVideoConfig } from 'remotion';
import { tokensFor } from '../../app/src/lib/look';
import { slideScale } from './fit';
import type { Short } from './shorts';

/**
 * One flashcard, as a vertical short.
 *
 * The question is up before the first word of it is spoken and holds alone
 * through the two-second pause `lesson_script` leaves after every question —
 * which on a lecture is a beat to answer in your head, and here is the hook
 * holding before the payoff. Then the answer lands.
 *
 * The audio is the unit's own MP3, trimmed. Nothing is synthesised, nothing is
 * cut, and no new file is written: `trimBefore`/`trimAfter` play the seconds
 * this card occupies inside the lesson every student already streams.
 *
 * The words on screen are the words being spoken, which is what makes these
 * captioned without a captioning pass. It is per-beat, not per-word — the cue
 * list records where a *line* starts, not a syllable — so nothing here claims
 * to bounce along with the voice, and the roadmap's "exact word timing" was
 * wrong about the data it was describing.
 */

export interface ShortVideoProps extends Record<string, unknown> {
  short: Short;
  /** Course code, e.g. "ECON 1020". */
  code: string;
  /** The unit this card belongs to, for the line under the code. */
  unitTitle: string;
  /** The unit's MP3, as the app addresses it. */
  file: string;
  ground: string;
  accent: string;
}

export function ShortVideo({ short, code, unitTitle, file, ground, accent }: ShortVideoProps) {
  const frame = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();
  const seconds = frame / fps;

  const tokens = tokensFor({ ground, accent }, false);
  const length = short.end - short.start;

  /*
   * Where the answer begins, measured from the start of the short rather than
   * from the start of the unit — the only conversion in this file, and the
   * reason `Short` carries absolute seconds: the trim wants them absolute and
   * the animation wants them relative, so one of the two has to do the
   * subtraction and the data keeps the form the cue list gave it.
   */
  const answerAt = short.answerAt - short.start;

  const pad = Math.round(width * 0.075);
  const cardPad = Math.round(width * 0.06);

  /*
   * The question gives up the middle as the answer arrives.
   *
   * The movement runs in the 0.45s *before* the answer's first word rather
   * than after it, and the difference is not pedantry: started on the cue, the
   * card was still sliding while the voice was two words into explaining, so
   * the eye was tracking type instead of reading it. `lesson_script` leaves a
   * two-second pause after every question, which is where this now happens.
   */
  const REVEAL = 0.45;
  const reveal = interpolate(seconds - (answerAt - REVEAL), [0, REVEAL], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  /*
   * The answer is not laid out until it is about to be seen.
   *
   * Rendered at `opacity: 0` it still took its height, so through the whole
   * hook the question sat wherever the answer's card left room for it — high,
   * with a third of a vertical frame empty underneath. On a phone that reads
   * as something that failed to load, and the hook is the one frame in a short
   * that has to work.
   */
  const laidOut = seconds >= answerAt - REVEAL;
  const enter = interpolate(seconds, [0, 0.4], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  const innerWidth = width - 2 * pad - 2 * cardPad;

  /*
   * A vertical frame is 918px wide inside its padding against the lesson's
   * 1708, so the same sentence wraps to roughly twice as many lines. Both
   * halves are fitted against the space each actually gets: the question has
   * the whole frame until the answer arrives and a third of it afterwards.
   */
  const qSize = Math.round(width * 0.062);
  const aSize = Math.round(width * 0.052);
  const qScale = slideScale({
    chars: short.question.length,
    innerWidth,
    available: Math.round(height * (laidOut ? 0.3 : 0.52)),
    bodySize: qSize,
    lineHeight: 1.2,
    overhead: Math.round(height * 0.03),
  });
  const aScale = slideScale({
    chars: short.answer.length,
    innerWidth,
    available: Math.round(height * 0.42),
    bodySize: aSize,
    lineHeight: 1.45,
    overhead: Math.round(height * 0.03),
  });

  const progress = length > 0 ? Math.min(seconds / length, 1) : 0;

  return (
    <AbsoluteFill
      style={{
        background: tokens['--app-bg'],
        color: tokens['--app-fg'],
        fontFamily: 'Barlow, system-ui, sans-serif',
        padding: pad,
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      <Audio
        src={staticFile(file.replace(/^\//, ''))}
        trimBefore={Math.round(short.start * fps)}
        trimAfter={Math.round(short.end * fps)}
      />

      {/* Which course this is, for a viewer who arrived from nowhere. */}
      <div style={{ opacity: enter }}>
        <div
          style={{
            fontSize: Math.round(width * 0.03),
            letterSpacing: '0.22em',
            textTransform: 'uppercase',
            color: tokens['--app-accent-deep'],
          }}
        >
          {code}
        </div>
        <div
          style={{
            fontSize: Math.round(width * 0.032),
            marginTop: Math.round(height * 0.006),
            opacity: 0.6,
          }}
        >
          {unitTitle}
        </div>
      </div>

      <div
        style={{
          flex: 1,
          minHeight: 0,
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          gap: Math.round(height * 0.022),
        }}
      >
        {/* The hook. On screen from the first frame, alone through the pause. */}
        <div
          style={{
            fontSize: Math.round(qSize * qScale),
            lineHeight: 1.2,
            textWrap: 'pretty',
            opacity: enter * (1 - 0.35 * reveal),
            transform: `translateY(${interpolate(enter, [0, 1], [24, 0])}px)`,
          }}
        >
          {short.question}
        </div>

        {/* The payoff. */}
        {laidOut && (
        <div
          style={{
            background: tokens['--app-hero'],
            borderRadius: 22,
            padding: cardPad,
            opacity: reveal,
            transform: `translateY(${interpolate(reveal, [0, 1], [28, 0])}px)`,
          }}
        >
          <div
            style={{
              fontSize: Math.round(width * 0.028),
              letterSpacing: '0.22em',
              textTransform: 'uppercase',
              color: tokens['--app-accent-deep'],
            }}
          >
            Answer
          </div>
          <div
            style={{
              fontSize: Math.round(aSize * aScale),
              lineHeight: 1.45,
              marginTop: Math.round(height * 0.014),
              textWrap: 'pretty',
            }}
          >
            {short.answer}
          </div>
        </div>
        )}
      </div>

      <div style={{ height: 8, background: tokens['--app-track'], borderRadius: 4 }}>
        <div
          style={{
            height: 8,
            width: `${progress * 100}%`,
            background: tokens['--app-accent'],
            borderRadius: 4,
          }}
        />
      </div>
    </AbsoluteFill>
  );
}

/** A short runs exactly as long as the card it was cut from, plus a beat to read. */
export const SHORT_TAIL_SECONDS = 0.6;

export function shortDuration(short: Short, fps: number): number {
  return Math.max(1, Math.round((short.end - short.start + SHORT_TAIL_SECONDS) * fps));
}
