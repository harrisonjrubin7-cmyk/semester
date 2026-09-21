import {
  AbsoluteFill,
  Audio,
  interpolate,
  Sequence,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from 'remotion';
import { cueIndexAt } from '../../app/src/lib/beats';
import { tokensFor } from '../../app/src/lib/look';
import { Slide } from './Slide';
import type { LessonCue } from '../../app/src/lib/types';

/**
 * A run of a course's units as one YouTube-length video.
 *
 * §3 of `docs/VIDEO_PODCAST_ROADMAP.md`: "8–15 min, hook in the first 15s,
 * chapter marks". Nothing is synthesised — the audio is the unit MP3s every
 * student already streams, sequenced, and the cue list is those units' own
 * cues offset onto one timeline. `pipeline/explainer.mjs` does that arithmetic
 * and says why an explainer is always a truncation.
 *
 * The slide is `Slide.tsx`, which is the lesson video's slide, because an
 * explainer *is* a run of lessons and two compositions setting the same
 * sentence differently would tell a viewer the pipeline is two pipelines.
 */

export interface ExplainerUnit {
  unit: number;
  title: string;
  /** As the app addresses it: "/audio/lessons/econ/unit-3.mp3". */
  file: string;
  /** Second of the whole explainer this unit starts on. */
  at: number;
  seconds: number;
}

export interface ExplainerCue extends LessonCue {
  /** Which unit this cue came from, so the running head can name it. */
  unit: number;
}

export interface ExplainerProps extends Record<string, unknown> {
  code: string;
  title: string;
  units: ExplainerUnit[];
  cues: ExplainerCue[];
  /** Where the hook ends, and what it promises. */
  hook: { until: number; questions: string[] };
  seconds: number;
  ground: string;
  accent: string;
}

/** A tail past the last word, so the closing slide is read rather than cut. */
export const TAIL_SECONDS = 1.5;

export function explainerDuration(seconds: number, fps: number): number {
  return Math.max(1, Math.round((seconds + TAIL_SECONDS) * fps));
}

export function Explainer({
  code,
  title,
  units,
  cues,
  hook,
  seconds: total,
  ground,
  accent,
}: ExplainerProps) {
  const frame = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();
  const at = frame / fps;
  const tokens = tokensFor({ ground, accent }, false);

  const index = cueIndexAt(cues, at);
  /*
   * Which unit is playing. `cueIndexAt` again — the rule the app's player, the
   * lesson video and the documentary's chapter cards all ask, including the
   * 150ms lead. A unit boundary is the same kind of thing as a cue: a second
   * at which what is on screen should change.
   */
  const where = cueIndexAt(units.map((u) => ({ at: u.at })), at);
  const unit = units[where];

  const pad = Math.round(width * 0.075);
  const progress = total > 0 ? Math.min(at / total, 1) : 0;
  const inHook = at < hook.until;

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
      {/*
       * One `Audio` per unit, each starting on its own frame.
       *
       * No file is written and none is re-encoded: a ten-unit explainer plays
       * the ten MP3s the app already serves, in order, with the beat between
       * them that `UNIT_GAP` puts in the timeline. `remotion.config.ts` points
       * the public directory at `app/public`, so these are the same bytes the
       * player streams.
       */}
      {units.map((u) => (
        <Sequence key={u.unit} from={Math.round(u.at * fps)} durationInFrames={Math.round(u.seconds * fps)}>
          <Audio src={staticFile(u.file.replace(/^\//, ''))} />
        </Sequence>
      ))}

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
        {/*
          * The total is on the time row already, so the hook does not repeat
          * it — the first cut had 3:10 in two corners of the same frame.
          */}
        <div style={{ fontSize: Math.round(height * 0.024), opacity: 0.55 }}>
          {inHook ? `${units.length} units` : `Unit ${where + 1} of ${units.length}`}
        </div>
      </div>
      <div
        style={{
          fontSize: Math.round(height * 0.032),
          marginTop: Math.round(height * 0.012),
          opacity: 0.72,
        }}
      >
        {inHook ? title : (unit?.title ?? '')}
      </div>

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
        {inHook ? (
          <Hook at={at} until={hook.until} questions={hook.questions} tokens={tokens} height={height} />
        ) : (
          <Slide
            cues={cues}
            index={index}
            seconds={at}
            tokens={tokens}
            width={width}
            height={height}
            pad={pad}
            // What the running head, the spine and the time row leave.
            available={height - 2 * pad - Math.round(height * 0.16)}
          />
        )}
      </div>

      {/*
       * The spine: every unit, the one playing filled in.
       *
       * Proportional to real lengths, the way the documentary's is, so a long
       * unit looks long. It is also the chapter list a viewer will see under
       * the video, drawn — `pipeline/explainer.mjs` writes the same marks as
       * text for the description box.
       */}
      <div style={{ display: 'flex', gap: 3, height: 6, marginBottom: Math.round(height * 0.016) }}>
        {units.map((u, i) => {
          /*
           * The unit being played fills as it plays, rather than filling the
           * moment it starts.
           *
           * The documentary's spine fills a chapter whole because a chapter is
           * one of fourteen and the overstatement is small. An explainer has
           * five to ten units, so seven seconds into a two-unit cut the bar
           * read 43% of the way along a video that was 4% done. A spine that
           * disagrees with the percentage beside it is worse than no spine.
           */
          const through = i < where ? 1 : i > where ? 0 : Math.min(1, Math.max(0, (at - u.at) / u.seconds));
          return (
            <div
              key={u.unit}
              style={{
                flexGrow: Math.max(u.seconds, 1),
                background: tokens['--app-track'],
                borderRadius: 3,
                overflow: 'hidden',
              }}
            >
              <div
                style={{
                  width: `${through * 100}%`,
                  height: '100%',
                  background: tokens['--app-accent'],
                  opacity: i === where ? 1 : 0.55,
                }}
              />
            </div>
          );
        })}
      </div>

      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          fontSize: Math.round(height * 0.022),
          opacity: 0.5,
        }}
      >
        <span>{mmss(at)}</span>
        <span>{`${Math.round(progress * 100)}%`}</span>
        <span>{mmss(total)}</span>
      </div>
    </AbsoluteFill>
  );
}

/**
 * The hook: what this video is about to answer.
 *
 * The questions come from the units *after* the first, and that rule is the
 * whole design — the narration underneath is already asking and answering
 * something, and listing the question being answered right now would be
 * reading the viewer their own subtitles. `explainer.mjs` picks them.
 *
 * They arrive one at a time across the hook's length rather than all at once,
 * because a list that is complete in the first frame has stopped being a build
 * and become a slide.
 */
function Hook({
  at,
  until,
  questions,
  tokens,
  height,
}: {
  at: number;
  until: number;
  questions: string[];
  tokens: Record<string, string>;
  height: number;
}) {
  // The last question lands with a fifth of the hook still to run, so the
  // finished list is readable before the cut rather than arriving on it.
  const span = Math.max(until * 0.8, 0.1);
  const step = span / Math.max(questions.length, 1);

  return (
    <div style={{ width: '100%' }}>
      <div
        style={{
          fontSize: Math.round(height * 0.026),
          letterSpacing: '0.22em',
          textTransform: 'uppercase',
          color: tokens['--app-accent-deep'],
          marginBottom: Math.round(height * 0.03),
        }}
      >
        What this answers
      </div>
      {questions.map((question, i) => {
        const shown = interpolate(at, [i * step, i * step + 0.35], [0, 1], {
          extrapolateLeft: 'clamp',
          extrapolateRight: 'clamp',
        });
        return (
          <div
            key={question}
            style={{
              fontSize: Math.round(height * 0.052),
              lineHeight: 1.25,
              marginBottom: Math.round(height * 0.022),
              textWrap: 'pretty',
              opacity: shown,
              transform: `translateY(${(1 - shown) * 14}px)`,
            }}
          >
            {question}
          </div>
        );
      })}
    </div>
  );
}

/** "12:35", the way every other file here writes a length. */
function mmss(seconds: number): string {
  const whole = Math.max(0, Math.floor(seconds));
  return `${Math.floor(whole / 60)}:${String(whole % 60).padStart(2, '0')}`;
}
