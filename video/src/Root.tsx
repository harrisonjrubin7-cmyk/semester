import { Composition } from 'remotion';
import { durationFor, LessonVideo, type LessonVideoProps } from './Lesson';
import { shortDuration, ShortVideo, type ShortVideoProps } from './Short';
import { Documentary, documentaryDuration, type DocumentaryProps } from './Documentary';
import {
  Persona,
  PERSONA_HEIGHT,
  PERSONA_WIDTH,
  type PersonaProps,
} from './Persona';
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

const PLACEHOLDER_DOC = {
  code: 'ECON 1020',
  title: 'ECON 1020 — Thinking at the Margin',
  file: '/audio/econ-podcast.mp3',
  chapters: [
    { s: 0, t: '0:00', name: 'Cold open' },
    { s: 35, t: '0:36', name: 'How to actually pass' },
  ],
  // The first four lines of the real episode, at the seconds
  // `pipeline/align-audio.mjs` recovered for them, so the studio opens on a
  // caption doing what a caption does rather than on lorem.
  times: [
    { i: 0, s: 0, e: 9.181 },
    { i: 1, s: 9.731, e: 21.028 },
    { i: 2, s: 21.578, e: 27.207 },
    { i: 3, s: 27.757, e: 34.443 },
  ],
  said: [
    { v: 'host', t: 'Eighty percent of this grade is three multiple-choice exams, in class, clo…' },
    { v: 'expert', t: 'Which is exactly what Stromme says separates the A students. Memorisers do…' },
    { v: 'host', t: 'So this episode is the blocks. Ten chapters, the formula sheet, and the tr…' },
    { v: 'expert', t: 'And a self-test at the end. But do the problem sets yourself — the connect…' },
  ],
  seconds: 1696,
  render: 60,
};

/*
 * A real persona, not a stand-in.
 *
 * `pipeline/persona-sheet.mjs --layout` passes the props; this is what
 * `npm run studio` opens on, and a sheet full of lorem would be the one
 * composition nobody could judge the design of.
 */
const PLACEHOLDER_PERSONA = {
  id: 'host-nell',
  name: 'Nell',
  role: 'host',
  label: 'The one asking',
  described:
    'a slight figure in their twenties, with tightly coiled hair, wearing an ' +
    'open overshirt, holding a notebook, warm in manner',
  note: 'leaning slightly in, mid-question, eyebrows up',
  panels: [
    { view: 'front', expression: 'neutral' },
    { view: 'three-quarter', expression: 'neutral' },
    { view: 'profile', expression: 'neutral' },
    { view: 'front', expression: 'explaining' },
    { view: 'three-quarter', expression: 'explaining' },
    { view: 'profile', expression: 'explaining' },
    { view: 'front', expression: 'pleased' },
    { view: 'three-quarter', expression: 'pleased' },
    { view: 'profile', expression: 'pleased' },
  ],
  ground: 'ink',
  accent: 'copper',
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
    <Composition
      id="Documentary"
      component={Documentary}
      durationInFrames={documentaryDuration(PLACEHOLDER_DOC.render, FPS)}
      fps={FPS}
      width={WIDTH}
      height={HEIGHT}
      defaultProps={{ ...PLACEHOLDER_DOC, ground: 'ink', accent: 'sterling' } as DocumentaryProps}
      calculateMetadata={({ props }) => ({
        durationInFrames: documentaryDuration(props.render, FPS),
      })}
    />
    <Composition
      id="Persona"
      component={Persona}
      durationInFrames={1}
      fps={FPS}
      width={PERSONA_WIDTH}
      height={PERSONA_HEIGHT}
      defaultProps={PLACEHOLDER_PERSONA as PersonaProps}
    />
    </>
  );
}
