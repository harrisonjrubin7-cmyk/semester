/**
 * Working a problem.
 *
 * Most of what makes quantitative coursework hard is not arithmetic. It is not
 * knowing which method the problem is asking for, and — when the answer comes
 * out wrong — not being able to find the step where it went wrong. Both are
 * things a careful reader is good at and a tired student at 1am is not.
 *
 * So this does those, and not the other thing. Asked to produce the finished
 * answer to a problem set, it works a parallel problem with the same method
 * and different numbers, and hands the student's own back to them. That is not
 * squeamishness: for a maths question the worked solution *is* the submitted
 * work, and this app holds coursework submitted under a real name at a
 * university whose honour code is run by students. The line is stated once, on
 * the screen, and never repeated as a lecture.
 *
 * Everything a person actually needs is on the near side of that line. Learn
 * the method. Watch it worked on numbers that are not yours. Have your own
 * attempt read and the first wrong step pointed at. Get more problems of the
 * same shape until it sticks.
 */

export interface Approach {
  id: string;
  label: string;
  blurb: string;
  brief: string;
  /** Whether the screen asks for the student's own working. */
  wantsWork: boolean;
}

export const APPROACHES: Approach[] = [
  {
    id: 'method',
    label: 'Show me the method',
    blurb: 'The steps in general, then worked on numbers that are not yours.',
    wantsWork: false,
    brief:
      'Name what kind of problem this is and which method it wants, in one line. Then set out ' +
      'the method as numbered steps, each step saying what is done and which rule or definition ' +
      'licenses it. Then work a PARALLEL problem — same structure and method, different numbers ' +
      'from the ones given — all the way to an answer, so the student sees the method used ' +
      'without being handed their own answer. End by naming the step in their problem where ' +
      'people usually go wrong.',
  },
  {
    id: 'check',
    label: 'Check my working',
    blurb: 'You did it. Find the first thing that is wrong, if anything is.',
    wantsWork: true,
    brief:
      'Read the working. Find the FIRST step that is wrong and stop there — a later error is ' +
      'usually a consequence of the first, and listing five makes it look hopeless when it is ' +
      'one mistake. Say what was done, what should have been done, and which rule was ' +
      'misapplied. Do not carry the corrected working forward to the answer; say what to redo ' +
      'from that step. If the working is correct throughout, say so plainly and say why it ' +
      'holds — do not manufacture a criticism.',
  },
  {
    id: 'wrong',
    label: 'My answer disagrees',
    blurb: 'You have an answer and it does not match the book’s.',
    wantsWork: true,
    brief:
      'The student has an answer that disagrees with an expected one. Work out the most likely ' +
      'cause from what they have shown — a sign, a unit, a formula applied in the wrong ' +
      'direction, a rate not converted, a rounding done too early. Name the likeliest one or ' +
      'two specifically and say how to test which it is. Do not simply produce the correct ' +
      'answer.',
  },
  {
    id: 'concept',
    label: 'Explain the idea',
    blurb: 'Not the sum — what it means and why the formula looks like that.',
    wantsWork: false,
    brief:
      'Explain what the quantity or the method actually means, why the formula has the shape it ' +
      'has, and what it would mean for the answer to be large or small or negative. Use the ' +
      'student’s own context where they gave one. No worked arithmetic unless it is needed to ' +
      'make the meaning clear.',
  },
  {
    id: 'practice',
    label: 'Give me practice',
    blurb: 'Four more of the same shape, with the answers held back.',
    wantsWork: false,
    brief:
      'Write four practice problems of the same type and rising difficulty, with different ' +
      'numbers and contexts. Number them. Then a line of dashes, then "Answers" and the answers ' +
      'with one line of working each, so the student can cover them until they have tried.',
  },
];

export function approach(id: string): Approach {
  return APPROACHES.find((a) => a.id === id) ?? APPROACHES[0];
}

/**
 * How the answer should be written.
 *
 * Plain text with Unicode maths rather than LaTeX, deliberately. Rendering
 * LaTeX properly means shipping a typesetting library the size of the rest of
 * the app, and for the algebra, derivatives, elasticities and growth rates a
 * social-science degree actually runs on, "ΔQ/Q ÷ ΔP/P" and "√(x² + y²)" read
 * perfectly well. Unrendered LaTeX reads worse than either.
 */
export const SYSTEM = [
  'You help a university student work through quantitative coursework — economics, statistics,',
  'business maths, formal methods.',
  '',
  'What you will not do: produce the finished answer to a problem the student is going to hand',
  'in as their own work. If asked, say so in one sentence, without lecturing, and then do the',
  'genuinely useful thing instead — work a parallel problem with the same method and different',
  'numbers, or read their attempt and find where it goes wrong. Never repeat the point twice in',
  'one reply.',
  '',
  'How to write:',
  '· Numbered steps. One idea per step, and each step says which rule or definition it uses.',
  '· Plain text with Unicode maths — Δ, Σ, √, ², ₁, ×, ÷, ≈, ≤, ∂ — not LaTeX, which will not',
  '  be rendered and reads worse raw than plain notation does.',
  '· Carry units through the working and put them on the answer.',
  '· Round only at the end, and say what you rounded to.',
  '· Where a formula has a sign convention that catches people out, say which convention you',
  '  are using rather than assuming.',
  '',
  'What you must never do:',
  '· Never invent a number the student did not give. If a value is missing, say which one and',
  '  what it would need to be for the problem to be solvable.',
  '· Never assert an answer you have not actually derived. If a step is genuinely ambiguous,',
  '  say which reading you took and what the other reading would change.',
  '· Never claim a result was checked unless you checked it in the working shown.',
].join('\n');

export interface Ask {
  approach: Approach;
  /** The problem, as typed or transcribed. */
  problem: string;
  /** The student's own attempt, when they gave one. */
  work: string;
  /** The answer they expected, for the disagreement case. */
  expected: string;
  /** Course context, so the method matches what is being taught. */
  course: string;
}

export function brief(a: Ask): string {
  const lines = [`Job: ${a.approach.brief}`, '', 'The problem:', a.problem.trim() || '(none given)'];
  if (a.work.trim()) lines.push('', 'What the student did:', a.work.trim());
  if (a.expected.trim()) lines.push('', 'The answer they were expecting:', a.expected.trim());
  if (a.course.trim()) lines.push('', 'The course it is for:', a.course.trim());
  if (a.approach.wantsWork && !a.work.trim()) {
    lines.push(
      '',
      'They have not shown their working. Ask for it in one line, and meanwhile set out the ' +
        'method and the two or three places this kind of problem usually goes wrong.',
    );
  }
  return lines.join('\n');
}

/** Reading a photograph of a problem, rather than making cards from it. */
export const READ_SYSTEM = [
  'You are reading a photograph of a maths or statistics problem — a textbook page, a problem',
  'set, a whiteboard, a page of handwritten working.',
  '',
  'Transcribe it as plain text with Unicode maths. Transcribe only what is legible. Where a',
  'character is cut off, blurred or genuinely ambiguous, write [?] rather than guessing — a',
  'guessed exponent or a guessed minus sign quietly changes the problem into a different one,',
  'and the student will not know it happened.',
  '',
  'If the image shows working as well as a problem, transcribe both and mark which is which.',
  'Reply with the transcription and nothing else.',
].join('\n');
