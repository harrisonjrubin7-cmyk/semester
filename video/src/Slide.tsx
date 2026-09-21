import { cueEntrance } from '../../app/src/lib/beats';
import { slideScale } from './fit';
import type { LessonCue } from '../../app/src/lib/types';

/**
 * The card a lesson's words are set on.
 *
 * Extracted from `Lesson.tsx` when the explainer arrived, because an explainer
 * *is* a run of lessons — the same narration, the same cue list, offset — and
 * two compositions drawing the same sentence differently would be the clearest
 * possible way to tell a viewer the pipeline is two pipelines. `cueIndexAt`
 * and `tokensFor` are shared for the same reason and `video/README.md` makes
 * the argument at length.
 *
 * What is *not* here is the chrome around it: the running head, the progress
 * track, the chapter spine. Those differ on purpose — a lesson names a unit, an
 * explainer names which unit of how many — and folding them in would have meant
 * a component with a mode switch, which is two components with extra steps.
 */

export interface SlideProps {
  /** The whole cue list, so the card can find the question above an answer. */
  cues: readonly LessonCue[];
  /** Which cue is up, from `cueIndexAt`. */
  index: number;
  /** Seconds into the video, for the entrance. */
  seconds: number;
  tokens: Record<string, string>;
  width: number;
  height: number;
  /** The frame's own padding, which the card sits inside. */
  pad: number;
  /** Vertical space the card may occupy, once the chrome has taken its share. */
  available: number;
}

/** How long a cue takes to arrive. */
export const SLIDE_IN = 0.42;

/** What the kicker says, by what kind of cue is up. */
export function kickerFor(kind: LessonCue['kind'] | undefined): string {
  if (kind === 'q') return 'Question';
  if (kind === 'a') return 'Answer';
  if (kind === 'close') return 'In short';
  return 'Unit';
}

export function Slide({ cues, index, seconds, tokens, width, height, pad, available }: SlideProps) {
  const cue = cues[index];
  const asked = cue?.kind === 'a' ? (cues[index - 1]?.text ?? '') : '';
  /*
   * From `beats.ts`, beside `cueIndexAt` and `CUE_LEAD`, because the three are
   * one rule. Computed here rather than passed in: the first cut took `enter`
   * as a prop and two compositions each worked it out from `cue.at`, which is
   * 150ms earlier than the cue was selected and left the frame blank for
   * exactly that long. `cueEntrance` has the whole story.
   */
  const enter = cueEntrance(cues, index, seconds, SLIDE_IN);
  const cardPad = Math.round(width * 0.055);
  const bodySize = Math.round(height * 0.042);
  const headSize = Math.round(height * 0.052);
  const body = cue?.text ?? '';

  /*
   * The type shrinks to fit and never grows to fill: `fit.ts` has the whole
   * argument, including why it is estimated from the text rather than measured
   * out of the DOM. A frame has no scrollbar, so a slide that does not fit is a
   * slide with its last line missing.
   */
  const scale = slideScale({
    chars: body.length + asked.length,
    innerWidth: width - 2 * pad - 2 * cardPad,
    available: available - 2 * cardPad,
    bodySize,
    lineHeight: 1.5,
    overhead: Math.round(height * 0.026) + headSize * 1.15 + Math.round(height * 0.058),
  });
  const big = (px: number) => Math.round(px * scale);
  const rise = (1 - enter) * 18;

  return (
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
           * this, and on a screen you cannot scroll back it matters more: an
           * answer alone is a sentence with no subject.
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
            {cue?.kind === 'a' ? asked : (cue?.text ?? '')}
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
  );
}
