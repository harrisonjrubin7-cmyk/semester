import { AbsoluteFill, Audio, interpolate, staticFile, useCurrentFrame, useVideoConfig } from 'remotion';
import { cueIndexAt } from '../../app/src/lib/beats';
import { tokensFor } from '../../app/src/lib/look';

/**
 * A documentary cut of a two-voice episode.
 *
 * The spine is the podcast every student already streams — 28 minutes for
 * ECON — and the picture is its chapter marks, drawn as lower-thirds that
 * arrive on the second the chapter does. Nothing is synthesised and no audio
 * is cut, the arrangement the shorts established.
 *
 * ## There are no captions, and that is not an oversight
 *
 * The roadmap specifies "Remotion lower-thirds and captions" for this format.
 * The lower-thirds are here; the captions are not, because the data for them
 * does not exist. `audio/synth.py` emits *chapter* marks — one every two
 * minutes or so — and nothing records where an individual line starts. The
 * transcript has the words and no times at all.
 *
 * Captions could be faked by spreading a chapter's lines evenly across its
 * duration, or by weighting them by word count. Both drift, and a caption
 * eight seconds out of step with the voice is worse than no caption: it reads
 * as a broken player rather than as an approximation. The honest fix is a
 * forced aligner over the rendered audio, which is real work and is not this.
 */

export interface DocumentaryChapter {
  /** Seconds into the episode. `audio/scripts/*.chapters.json` calls it `s`. */
  s: number;
  name: string;
  /** "12:34", as the chapter file writes it. */
  t: string;
}

export interface DocumentaryProps extends Record<string, unknown> {
  /** Course code, e.g. "ECON 1020". */
  code: string;
  /** The episode's title. */
  title: string;
  /** The podcast MP3, as the app addresses it: "/audio/econ-podcast.mp3". */
  file: string;
  chapters: DocumentaryChapter[];
  /** Length of the whole episode, in seconds. */
  seconds: number;
  /** Seconds of the episode this render covers, from the start. */
  render: number;
  ground: string;
  accent: string;
}

/** How long the chapter card takes to arrive. */
export const LOWER_THIRD_IN = 0.6;

export function Documentary({
  code,
  title,
  file,
  chapters,
  seconds: total,
  render,
  ground,
  accent,
}: DocumentaryProps) {
  const frame = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();
  const at = frame / fps;

  const tokens = tokensFor({ ground, accent }, false);

  /*
   * Which chapter is running.
   *
   * `cueIndexAt` again — the rule the lesson player and the lesson video both
   * ask, including the 150ms lead that puts type up just before the words. A
   * chapter mark is the same kind of thing as a cue: a second at which what is
   * on screen should change. Mapping `s` to `at` costs a line and means there
   * is still one implementation of "which one is showing".
   */
  const marks = chapters.map((c) => ({ at: c.s }));
  const index = cueIndexAt(marks, at);
  const chapter = chapters[index];

  /*
   * The chapter card arrives and then stays.
   *
   * The first cut faded it out after seven seconds, which on a 28-minute
   * episode with a chapter every two minutes meant twenty-six of those minutes
   * were a near-empty dark frame. That is the thing `--mp4` already did and
   * that step 1 of the roadmap existed to replace — "a dark rectangle is a
   * failure to launch, not a dark theme" — so shipping it here would have been
   * a regression wearing a new name. It animates in, then holds until the next
   * chapter takes over, and every frame of the episode says where you are.
   */
  const since = at - (chapter?.s ?? 0);
  const lower = interpolate(since, [0, LOWER_THIRD_IN], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  const pad = Math.round(width * 0.075);
  const progress = total > 0 ? Math.min(at / total, 1) : 0;

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
       * The whole episode, trimmed to the seconds this render covers.
       *
       * `trimAfter` rather than a shorter file: a 28-minute episode is not
       * re-encoded to look at its first minute, and the frames line up with
       * the chapter seconds either way.
       */}
      <Audio src={staticFile(file.replace(/^\//, ''))} trimAfter={Math.round(render * fps)} />

      <div>
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
        <div style={{ fontSize: Math.round(height * 0.03), marginTop: 8, opacity: 0.6 }}>
          {/*
           * Without the code, which is already on the line above. The chapter
           * files title an episode "ECON 1020 — Thinking at the Margin", so
           * printing both put the course code on screen twice.
           */}
          {withoutCode(title, code)}
        </div>
      </div>

      {/*
       * The middle is where an establishing shot would go.
       *
       * It is empty on purpose rather than filled with motion nobody chose:
       * `--broll none` is the only mode that exists today, and a decorative
       * gradient standing in for a shot that was never bought would make the
       * two modes hard to tell apart in a review.
       */}
      <div
        style={{
          flex: 1,
          minHeight: 0,
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'flex-end',
          paddingBottom: Math.round(height * 0.04),
        }}
      >
        {chapter && (
          <div style={{ opacity: lower, transform: `translateY(${(1 - lower) * 16}px)` }}>
            <div
              style={{
                width: Math.round(width * 0.06),
                height: 4,
                background: tokens['--app-accent'],
                marginBottom: Math.round(height * 0.022),
              }}
            />
            <div
              style={{
                fontSize: Math.round(height * 0.028),
                letterSpacing: '0.22em',
                textTransform: 'uppercase',
                color: tokens['--app-accent-deep'],
              }}
            >
              {`Chapter ${index + 1} of ${chapters.length} · ${chapter.t}`}
            </div>
            <div
              style={{
                fontSize: Math.round(height * 0.062),
                lineHeight: 1.1,
                marginTop: Math.round(height * 0.016),
                textWrap: 'pretty',
              }}
            >
              {chapter.name}
            </div>
          </div>
        )}
      </div>

      {/*
       * The spine: every chapter of the episode, the one running filled in.
       *
       * A documentary with no picture still has to say where you are. The
       * segments are proportional to the chapters' real lengths, so a long
       * middle chapter looks long.
       */}
      <div style={{ display: 'flex', gap: 3, height: 6, marginBottom: Math.round(height * 0.016) }}>
        {chapters.map((c, i) => {
          const next = chapters[i + 1];
          const span = (next ? next.s : total) - c.s;
          return (
            <div
              key={c.s}
              style={{
                flexGrow: Math.max(span, 1),
                background: i <= index ? tokens['--app-accent'] : tokens['--app-track'],
                opacity: i === index ? 1 : i < index ? 0.55 : 1,
                borderRadius: 3,
              }}
            />
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

/** An episode title with its course code taken off the front, if it is there. */
function withoutCode(title: string, code: string): string {
  const prefix = `${code} — `;
  return title.startsWith(prefix) ? title.slice(prefix.length) : title;
}

/** "28:17", the way the chapter files and the app both write a length. */
function mmss(seconds: number): string {
  const whole = Math.max(0, Math.floor(seconds));
  return `${Math.floor(whole / 60)}:${String(whole % 60).padStart(2, '0')}`;
}

export function documentaryDuration(renderSeconds: number, fps: number): number {
  return Math.max(1, Math.round(renderSeconds * fps));
}
