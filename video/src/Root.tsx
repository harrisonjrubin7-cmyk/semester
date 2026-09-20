import { Composition } from 'remotion';
import { durationFor, LessonVideo, type LessonVideoProps } from './Lesson';
import { shortDuration, ShortVideo, type ShortVideoProps } from './Short';
import type { Lesson } from '../../app/src/lib/types';

/**
 * One composition, parameterised by which lesson to draw.
 *
 * Every course and unit is the same video with different words in it, so
 * registering a composition per unit would be forty-four entries that drift.
 * `render.mjs` passes the lesson in; the placeholder below is what Remotion
 * Studio opens on when somebody runs `npm run studio` to look at the design.
 */

export const FPS = 30;
export const WIDTH = 1920;
export const HEIGHT = 1080;

/** Vertical, for the shorts. 9:16 at the resolution every platform accepts. */
export const SHORT_WIDTH = 1080;
export const SHORT_HEIGHT = 1920;

/** A lesson-shaped stand-in, so the studio opens on something rather than a crash. */
const PLACEHOLDER: Lesson = {
  unit: 0,
  title: 'Open a real unit with `npm run render`',
  file: '/audio/lessons/econ/unit-0.mp3',
  seconds: 20,
  len: '0:20',
  cues: [
    { at: 0, kind: 'title', text: 'Thinking at the margin' },
    { at: 6, kind: 'q', text: 'What does a sunk cost change about the next decision?' },
    { at: 12, kind: 'a', text: 'Nothing. It is spent either way, so it is not part of the comparison.' },
    { at: 18, kind: 'close', text: 'That is the unit' },
  ],
};

const PLACEHOLDER_SHORT = {
  unit: 3,
  card: 0,
  question: 'What does a sunk cost change about the next decision?',
  answer: 'Nothing. It is spent either way, so it is not part of the comparison.',
  start: 6,
  answerAt: 12,
  end: 20,
};

export function Root() {
  return (
    <>
    <Composition
      id="Lesson"
      component={LessonVideo}
      durationInFrames={durationFor(PLACEHOLDER, FPS)}
      fps={FPS}
      width={WIDTH}
      height={HEIGHT}
      defaultProps={
        { lesson: PLACEHOLDER, code: 'ECON 1020', ground: 'ink', accent: 'sterling' } as LessonVideoProps
      }
      calculateMetadata={({ props }) => ({
        durationInFrames: durationFor(props.lesson, FPS),
      })}
    />
    <Composition
      id="Short"
      component={ShortVideo}
      durationInFrames={shortDuration(PLACEHOLDER_SHORT, FPS)}
      fps={FPS}
      width={SHORT_WIDTH}
      height={SHORT_HEIGHT}
      defaultProps={
        {
          short: PLACEHOLDER_SHORT,
          code: 'ECON 1020',
          unitTitle: 'Thinking at the margin',
          file: '/audio/lessons/econ/unit-0.mp3',
          ground: 'ink',
          accent: 'sterling',
        } as ShortVideoProps
      }
      calculateMetadata={({ props }) => ({
        durationInFrames: shortDuration(props.short, FPS),
      })}
    />
    </>
  );
}
