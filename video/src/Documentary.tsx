import {
  AbsoluteFill,
  Audio,
  interpolate,
  OffthreadVideo,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from 'remotion';
import { cueIndexAt } from '../../app/src/lib/beats';
import { tokensFor } from '../../app/src/lib/look';
import { shotAt, type DocumentaryShot } from './broll';
import { CAPTION_LEADING, captionIndexAt, captionType, type LineTime } from './captions';

/**
 * A documentary cut of a two-voice episode.
 *
 * The spine is the podcast every student already streams — 28 minutes for
 * ECON — and the picture is its chapter marks, drawn as lower-thirds that
 * arrive on the second the chapter does. Nothing is synthesised and no audio
 * is cut, the arrangement the shorts established.
 *
 * ## The captions, and what they cost to have
 *
 * This file used to say there were none, because `audio/synth.py` recorded
 * where a *chapter* started and nothing recorded where a line did. It also
 * said what the two cheap ways out would cost: spread a chapter's lines
 * evenly, or weight them by word count, and a caption ends up seconds out of
 * step, which reads as a broken player rather than as an approximation. That
 * was measured rather than guessed — given the first and last chapter mark of
 * each episode, word-count interpolation misses every one of the 47 marks in
 * between, by up to 21 seconds.
 *
 * `pipeline/align-audio.mjs` is the honest fix and it is now built. It finds
 * the inserted silences in the rendered audio — they are not performed, they
 * are three known lengths in an order the script fixes — and lands all 55
 * chapter marks across the four episodes inside the second they were recorded
 * in. `synth.py` writes the same times exactly for anything rendered since.
 *
 * So the captions are per *line*: a speaker's turn, three to nine seconds of
 * it, which is the resolution the times have. `captions.ts` has the argument
 * for not cutting them finer. An episode with no line track still renders —
 * the lower-thirds and the spine were never dependent on one.
 *
 * ## The B-roll is a panel, and that was a measurement rather than a taste
 *
 * The obvious cut is full-bleed footage with the lower third over it. It does
 * not survive contact with `lib/contrast.ts`. The kicker — "CHAPTER 4 OF 14" —
 * is `--app-accent-deep`, a deliberately quiet role that clears AA against the
 * app's own surfaces and has no margin left for an unknown image underneath.
 * Walked over all thirteen grounds and every accent, against white, black and
 * mid-grey footage, with a scrim of the ground colour at increasing alpha:
 *
 *     alpha 0.70   body text 5.63   accent-deep 2.25
 *     alpha 0.85   body text 9.57   accent-deep 3.66
 *     alpha 0.95   body text 12.30  accent-deep 4.62
 *
 * The kicker needs 0.95 to clear 4.5:1 in the worst case, and a scrim at 0.95
 * is a scrim with no footage visible through it. The alternative — hiding the
 * type while a shot runs — takes the captions off screen for six seconds at
 * every chapter open, which is the second a chapter's first line is being
 * spoken. So the clip is a bounded insert in the space the frame already left
 * empty, the type stays on solid ground, and nothing is measured against a
 * surface that flatters it.
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
  /** Per-line times, or empty when none have been recovered for this episode. */
  times: LineTime[];
  /**
   * B-roll that exists on disk, from `video/shots/<course>.json`. Empty is the
   * mode this format shipped in and still the default.
   */
  shots: DocumentaryShot[];
  /** The script's own words, indexed as `times` indexes them. */
  said: { v: string; t: string }[];
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
  times,
  said,
  shots,
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

  /*
   * The line being spoken, if this episode has a line track.
   *
   * `captionIndexAt` reaches `cueIndexAt` too, so the caption, the chapter
   * card, the lesson video and the app's own player are all one rule about
   * which thing is up — including the 150ms lead.
   */
  const spoken = captionIndexAt(times, at);
  const caption = spoken === -1 ? undefined : said[times[spoken].i];

  const running = shotAt(shots, at);

  const pad = Math.round(width * 0.075);
  /*
   * The caption box: a fixed size, chosen once for the longest line this
   * episode has. `captions.ts` has the argument for both halves of that —
   * the short version is that a box which grows walks the chapter title up
   * the frame, and the longest line in the four shipped scripts is 556
   * characters, which does not fit at any size a short one would want.
   */
  const label = Math.round(height * 0.02);
  const box = {
    width: Math.round((width - pad * 2) * 0.76),
    height: Math.round(height * 0.2) - label * 2,
  };
  const size = captionType(
    said.reduce((most, l) => Math.max(most, l.t.length), 0),
    box,
    Math.round(height * 0.034),
  );
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
        {/*
         * The establishing shot, when one was bought.
         *
         * Still empty otherwise, and on purpose rather than filled with motion
         * nobody chose: a decorative gradient standing in for a shot that was
         * never generated would make the two modes hard to tell apart in a
         * review. `trimBefore` is not needed — each clip is its own file, cut
         * to length by whoever generated it, and `shotAt` decides when it is
         * on screen.
         *
         * Full width and whatever height is left, which comes out around 7:1
         * — a strip rather than a window. That is the shape the frame has
         * spare, not a preference: the running head, the chapter card, the
         * caption box, the spine and the timeline are all committed, and a
         * 16:9 panel in the gap between them is 390 pixels across on a
         * 1920-wide frame, which reads as a thumbnail somebody forgot to
         * finish. `object-fit: cover` takes the crop, so a clip generated at
         * 16:9 loses its top and bottom rather than letterboxing.
         */}
        <div
          style={{
            flex: 1,
            minHeight: 0,
            paddingTop: Math.round(height * 0.03),
            paddingBottom: Math.round(height * 0.03),
          }}
        >
          {running && (
            <div
              style={{
                width: '100%',
                height: '100%',
                overflow: 'hidden',
                borderRadius: 6,
                opacity: running.opacity,
                background: tokens['--app-panel'],
              }}
            >
              <OffthreadVideo
                src={staticFile(running.shot.file.replace(/^\//, ''))}
                style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                muted
              />
            </div>
          )}
        </div>

        {chapter && (
          <div
            style={{
              opacity: lower,
              transform: `translateY(${(1 - lower) * 16}px)`,
              marginBottom: Math.round(height * 0.03),
            }}
          >
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

        {/*
          * The words, in a box that is there whether or not they are.
          *
          * The column stacks from the bottom, so a box that grew with its
          * contents would lift the chapter title every time a long line
          * followed a short one. Fixed height, and the type sized to the
          * longest line the episode has rather than the one on screen.
          */}
        <div style={{ height: Math.round(height * 0.2) }}>
          {caption && (
            <>
              <div
                style={{
                  fontSize: label,
                  letterSpacing: '0.22em',
                  textTransform: 'uppercase',
                  color: tokens['--app-accent'],
                  marginBottom: label,
                }}
              >
                {caption.v}
              </div>
              <div
                style={{
                  fontSize: size,
                  lineHeight: CAPTION_LEADING,
                  textWrap: 'pretty',
                  width: box.width,
                }}
              >
                {caption.t}
              </div>
            </>
          )}
        </div>
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
