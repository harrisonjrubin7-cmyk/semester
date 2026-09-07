/**
 * Whether an answer sounds like an assistant or like a person who knows.
 *
 * ## Why this is code and not a note in the prompt
 *
 * "Write plainly" is the instruction every prompt already contains, and the
 * reason it keeps not working is that nobody can tell whether it worked.
 * Voice is the one part of a system prompt with no test under it, so it is
 * the part that quietly rots: a line gets added for a different reason, the
 * answers drift back to "Great question! Let me help you with that", and
 * nothing fails.
 *
 * So the rules are here, as patterns, and `check` runs over an answer and
 * says which ones it broke and where. That makes two things possible that a
 * paragraph of guidance does not: a test can assert that a set of answers is
 * clean, and a disagreement about whether an answer is too chatty becomes a
 * disagreement about a specific line rather than a matter of taste.
 *
 * ## What it does not do
 *
 * It does not run in the app. Nothing here filters, rewrites or blocks an
 * answer on its way to the screen — an assistant that silently edits what the
 * model said is worse than one that occasionally says "I hope this helps",
 * because then neither the student nor the person maintaining it knows what
 * was actually returned. This is a measuring instrument, used in tests and
 * when the prompt is being worked on.
 *
 * It also cannot tell whether an answer is *true*, which is the failure that
 * matters more. `lib/context.ts` and the grounding rules deal with that. This
 * is only about how it sounds.
 */

export interface Slip {
  /** Which rule, by its id below. */
  rule: string;
  /** The line it happened on, 1-based, for pointing at. */
  line: number;
  /** The text that tripped it. */
  found: string;
  /** What is wrong with it, in a sentence. */
  why: string;
}

interface Rule {
  id: string;
  why: string;
  /** Where in the answer it applies. */
  where: 'opening' | 'closing' | 'anywhere';
  test: RegExp;
}

/**
 * The openings.
 *
 * All of these are the same move: a sentence that happens before the answer
 * starts. The cost is not politeness, it is that the first line of a reply on
 * a phone is most of what gets read, and spending it on "Great question"
 * spends the whole of it.
 */
const OPENERS: Rule[] = [
  {
    id: 'opening-compliment',
    where: 'opening',
    why: 'Opens by praising the question instead of answering it.',
    test: /^\s*(great|good|excellent|interesting|fair|smart|nice)\s+(question|point|catch|call|thinking)\b/i,
  },
  {
    id: 'opening-acknowledgement',
    where: 'opening',
    why: 'Opens by agreeing to answer rather than answering.',
    test: /^\s*(sure|certainly|absolutely|of course|no problem|happy to|i'd be happy to|i'll help|i can help|let me help|let's|let me take a look|let me check|i'd suggest starting)\b/i,
  },
  {
    id: 'opening-restatement',
    where: 'opening',
    why: 'Opens by repeating the question back.',
    test: /^\s*(so\s+)?(you('re| are)\s+asking|you want to know|if i understand|to answer your question|regarding your question|as for your question)\b/i,
  },
  {
    id: 'opening-preamble',
    where: 'opening',
    why: 'Opens by narrating what the answer is about to do.',
    test: /^\s*(here('s| is)\s+(a|the|what|how)|i'll (walk|break|go)|let me (break|walk|explain)|below (is|you)|the short answer is that i)\b/i,
  },
];

/**
 * The endings.
 *
 * A closing offer is the tell that the thing answering is a service rather
 * than someone who knows the answer. It is also, here, a lie about the
 * interface: "let me know if you'd like me to add that" reads as an offer to
 * act, and this assistant cannot act — it proposes, and the student taps. A
 * real offer is a proposal card with a button on it, and the model asking in
 * prose for permission it already has a mechanism for is the failure that
 * makes the mechanism look broken.
 *
 * ## The line these do not cross
 *
 * Naming a specific action is allowed and is the point of the tools: "opening
 * Mail with her name filled in" is a sentence describing a card that is about
 * to appear with a button on it. What is banned is the offer with no
 * mechanism behind it — "let me know if you'd like me to draft that" — where
 * the student replies "yes please" to something that will never read it. The
 * patterns are written to that line: they match the asking, not the naming.
 * The prompt says the same thing in the same words, because a rule enforced
 * here and not stated there would only ever be discovered as a mystery.
 */
const CLOSERS: Rule[] = [
  {
    id: 'closing-offer',
    where: 'closing',
    why: 'Ends by offering more help, which the buttons already do.',
    test: /\b(let me know if|feel free to (ask|reach|let)|don'?t hesitate|if you(?:'d| would) like,? i can|would you like me to|want me to|shall i|happy to (help|dig|go)|just ask|anything else)\b/i,
  },
  {
    id: 'closing-wish',
    where: 'closing',
    why: 'Ends with a pleasantry rather than with the answer.',
    test: /\b(i hope (this|that) helps|hope that helps|good luck|you'?ve got this|best of luck|happy studying)\b/i,
  },
  {
    id: 'closing-summary',
    where: 'closing',
    why: 'Ends by summarising an answer short enough to reread.',
    test: /^\s*(in (summary|short|conclusion)|to (summarise|summarize|sum up|recap)|overall,|the bottom line)\b/i,
  },
];

/**
 * The rest, anywhere in the answer.
 *
 * These are the habits rather than the bookends. The hedge stack is the one
 * that does real damage: "you might want to consider possibly starting" is
 * four words of retreat around one word of advice, and a student reading it
 * cannot tell whether the assistant knows and is being careful or does not
 * know and is covering.
 */
const HABITS: Rule[] = [
  {
    id: 'hedge-stack',
    where: 'anywhere',
    why: 'Two or more hedges on one verb; say it, or say you are unsure and why.',
    test: /\b(?:might|may|could|perhaps|possibly|potentially)\s+(?:want to\s+|like to\s+)?(?:consider\s+)?(?:perhaps|possibly|potentially|probably|maybe|might|could)\b/i,
  },
  {
    id: 'not-x-but-y',
    where: 'anywhere',
    why: "The \"it's not X, it's Y\" construction, used for emphasis rather than contrast.",
    test: /\bit(?:'s| is)\s+not\s+(?:just\s+|only\s+|merely\s+|simply\s+)?(?:about\s+)?\w[\w '-]{0,30},\s*it(?:'s| is)\b/i,
  },
  {
    id: 'delve',
    where: 'anywhere',
    why: 'Reaching for the ornamental verb where a plain one fits.',
    test: /\b(delve into|dive deep|unpack|leverage|utilise|utilize|navigate the|embark on|realm of|landscape of|tapestry)\b/i,
  },
  {
    id: 'as-an-ai',
    where: 'anywhere',
    why: 'Talks about itself instead of about the term.',
    test: /\b(as an ai|as a language model|i(?:'m| am) (?:just )?an ai|i don'?t have (?:personal )?(?:feelings|opinions))\b/i,
  },
  {
    id: 'exclamation',
    where: 'anywhere',
    why: 'Exclamation mark. Nothing in a syllabus warrants one.',
    test: /!(?:\s|$)/,
  },
  {
    id: 'feelings',
    where: 'anywhere',
    why: 'Reads a mental state off a timetable. The app holds a schedule, not a person.',
    test: /\b(you must be (?:feeling|stressed|overwhelmed|anxious)|don'?t (?:stress|panic|worry)|take care of yourself|that sounds (?:stressful|exhausting|tough)|burn(?:t|ed)? out|mental health)\b/i,
  },
  {
    id: 'claimed-action',
    where: 'anywhere',
    why: 'Says it did something. Nothing happens until the student taps the button.',
    test: /\bi(?:'ve| have)\s+(?:now\s+)?(?:added|created|set|scheduled|updated|removed|deleted|sent|marked|moved|saved)\b/i,
  },
];

export const RULES: Rule[] = [...OPENERS, ...CLOSERS, ...HABITS];

/**
 * How much of an answer counts as its opening and its closing.
 *
 * One line each, not one sentence: the failures this is looking for are
 * whole lines — a greeting on its own, a sign-off on its own — and a
 * sentence-splitter that has to cope with "e.g.", "Dr." and "3.5" would be
 * more machinery than the thing it is measuring.
 *
 * A heading does not count as the opening. An answer that begins "## Where
 * you stand" has started answering; the line after it is the first thing
 * said.
 */
function edges(text: string): { first: number; last: number; lines: string[] } {
  const lines = text.split('\n');
  const meaningful = (s: string) => s.trim() !== '' && !/^#{1,6}\s/.test(s) && !/^\s*```/.test(s);
  const first = lines.findIndex(meaningful);
  let last = -1;
  for (let i = lines.length - 1; i >= 0; i -= 1) {
    if (meaningful(lines[i])) {
      last = i;
      break;
    }
  }
  return { first, last, lines };
}

/**
 * Every rule an answer breaks.
 *
 * Empty means it reads like somebody who knows the answer. It does not mean
 * the answer is right.
 */
export function check(text: string): Slip[] {
  const { first, last, lines } = edges(text);
  if (first === -1) return [];
  const slips: Slip[] = [];

  for (const rule of RULES) {
    const scope =
      rule.where === 'opening'
        ? [first]
        : rule.where === 'closing'
          ? [last]
          : lines.map((_, i) => i);

    for (const i of scope) {
      const line = lines[i];
      if (line === undefined) continue;
      /*
       * Not inside a code fence.
       *
       * An answer about writing a shell script contains exclamation marks,
       * and an answer about React contains `useState`. Flagging the sample
       * would make the rubric something to work around rather than something
       * to pass.
       */
      if (inFence(lines, i)) continue;
      const m = rule.test.exec(line);
      if (m) slips.push({ rule: rule.id, line: i + 1, found: m[0].trim(), why: rule.why });
    }
  }
  return slips.sort((a, b) => a.line - b.line);
}

function inFence(lines: string[], at: number): boolean {
  let open = false;
  for (let i = 0; i < at; i += 1) if (/^\s*```/.test(lines[i])) open = !open;
  return open;
}

/**
 * One line per answer, for reading a batch of them at once.
 *
 * The format is deliberately the same shape as a compiler's: a count, then
 * `line: rule` for each, so a run over ten answers can be skimmed for the
 * ones that need looking at.
 */
export function report(name: string, text: string): string {
  const slips = check(text);
  if (slips.length === 0) return `  ok   ${name}`;
  const detail = slips.map((s) => `${s.line}: ${s.rule} (“${s.found}”)`).join('; ');
  return ` SLIP  ${name} — ${detail}`;
}
