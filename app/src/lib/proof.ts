/**
 * Reading your own writing back to you, before somebody else does.
 *
 * The app takes prose in a dozen places — an email to a professor, a note, a
 * discussion post, a cover letter — and had nothing whatever to say about any
 * of it. The browser underlines misspellings in a text box and stops there: it
 * says nothing about a doubled word, a comma with a space in front of it, an
 * unclosed bracket, or "should of".
 *
 * ## It is not a spell checker, and says so
 *
 * There is no dictionary here. Shipping one means several hundred kilobytes in
 * every bundle for a job the browser already does, and a *short* dictionary is
 * worse than none — it flags every proper noun and every term of art in a
 * syllabus, and a checker that cries wolf gets switched off in a week.
 *
 * What is here instead is a list of frequent *misspellings*, which is a
 * different object: "definately" is wrong in every context, so flagging it
 * needs no dictionary and produces no false alarm. Everything else is left to
 * the browser's own underlining, and the screen says which is doing what.
 *
 * ## Every rule is one somebody could check by hand
 *
 * That is the bar, and it is why there is no readability score, no grade
 * level, and no opinion about the passive voice. Those are judgements dressed
 * as measurements, and this app does not make those anywhere else either. A
 * sentence being fifty-two words long is a fact; a sentence being *bad* is not
 * something a regular expression knows.
 *
 * A rule earns its place only if it is right nearly always. "Their" for
 * "there" is a real and common error and there is no reliable way to catch it
 * without understanding the sentence, so it is not here — a wrong flag on
 * correct writing costs more trust than a missed one costs anything.
 */

export type ProofKind =
  | 'repeat'
  | 'spelling'
  | 'spacing'
  | 'capital'
  | 'pairs'
  | 'confusion'
  | 'length';

export interface Finding {
  /** Index into the text, so a screen can point at it. */
  at: number;
  /** How much of it is the problem. */
  len: number;
  kind: ProofKind;
  /** The text as written. */
  found: string;
  /** What is wrong, in one clause. */
  says: string;
  /** What it should be, where there is exactly one answer. Empty otherwise. */
  fix: string;
}

/** A sentence longer than this is reported as a count, never as a verdict. */
export const LONG_SENTENCE = 45;

/**
 * Misspellings, not a dictionary.
 *
 * Every left-hand side is wrong in every context, which is what makes a list
 * this short worth having: there is no sentence in which "definately" is
 * right, so there is no false alarm to trade off against. Kept deliberately to
 * the ones that turn up in student writing week after week.
 */
export const MISSPELLINGS: Record<string, string> = {
  teh: 'the',
  adn: 'and',
  alot: 'a lot',
  definately: 'definitely',
  seperate: 'separate',
  seperately: 'separately',
  recieve: 'receive',
  recieved: 'received',
  occured: 'occurred',
  occurence: 'occurrence',
  untill: 'until',
  wich: 'which',
  becuase: 'because',
  becasue: 'because',
  arguement: 'argument',
  goverment: 'government',
  enviroment: 'environment',
  neccessary: 'necessary',
  necesary: 'necessary',
  accomodate: 'accommodate',
  publically: 'publicly',
  independant: 'independent',
  existance: 'existence',
  maintainance: 'maintenance',
  refered: 'referred',
  begining: 'beginning',
  writen: 'written',
  concious: 'conscious',
  responsability: 'responsibility',
  aquire: 'acquire',
  calender: 'calendar',
  cemetary: 'cemetery',
  collegue: 'colleague',
  commited: 'committed',
  concensus: 'consensus',
  embarass: 'embarrass',
  greatful: 'grateful',
  harrass: 'harass',
  liason: 'liaison',
  millenium: 'millennium',
  noticable: 'noticeable',
  occassion: 'occasion',
  persistant: 'persistent',
  posession: 'possession',
  priviledge: 'privilege',
  reccomend: 'recommend',
  refering: 'referring',
  relevent: 'relevant',
  succesful: 'successful',
  succesfully: 'successfully',
  supercede: 'supersede',
  tommorow: 'tomorrow',
  wierd: 'weird',
  thier: 'their',
  freind: 'friend',
  beleive: 'believe',
  acheive: 'achieve',
  arguemnet: 'argument',
  analysys: 'analysis',
  buisness: 'business',
  managment: 'management',
  proffesor: 'professor',
  profesor: 'professor',
  sylabus: 'syllabus',
  sylabbus: 'syllabus',
  assigment: 'assignment',
  assignement: 'assignment',
  semister: 'semester',
  univeristy: 'university',
  goverance: 'governance',
  economoic: 'economic',
  poltical: 'political',
  politcal: 'political',
};

/**
 * Phrases that are wrong however they are used.
 *
 * The same bar as the misspellings: "should of" is never right, so there is
 * nothing to weigh. Things that are only *sometimes* wrong — "their" for
 * "there", "affect" for "effect" — are not here, because catching those needs
 * the sentence's meaning and a wrong flag on correct writing costs more trust
 * than a missed one costs anything.
 */
export const PHRASES: [RegExp, string, string][] = [
  [/\b(should|could|would|must|might)\s+of\b/gi, "$1 have", '“of” for “have”'],
  [/\bits'\s/g, "its ", '“its’” is not a word — it is “its” or “it’s”'],
  [/\ba\s+lot\s+of\s+(?:a\s+)?lot\b/gi, 'a lot', 'said twice'],
  [/\brather\s+then\b/gi, 'rather than', '“then” for “than”'],
  // Comparatives are listed rather than matched as "any word ending in -er",
  // which would flag "we gather then disperse" and "consider then act". A
  // named list is longer and never wrong.
  [
    /\b(better|worse|more|less|fewer|greater|larger|smaller|higher|lower|older|younger|harder|easier|faster|slower|longer|shorter|stronger|weaker|bigger|cheaper|sooner|closer|wider|deeper|safer|simpler|clearer|other|different)\s+then\b/gi,
    '$1 than',
    '“then” for “than”',
  ],
  [/\bfor\s+all\s+intensive\s+purposes\b/gi, 'for all intents and purposes', 'misheard phrase'],
  [/\bwould\s+of\s+went\b/gi, 'would have gone', '“of” for “have”'],
  [/\bper\s+say\b/gi, 'per se', 'misheard phrase'],
  [/\bsupposably\b/gi, 'supposedly', 'not a word'],
  [/\birregardless\b/gi, 'regardless', 'not a word'],
];

/**
 * Where a run of text sits outside anything that should not be checked.
 *
 * URLs, email addresses, code in backticks and numbers with decimal points all
 * look like punctuation errors to every rule below. Skipping them is the
 * difference between a checker that is used and one that is switched off.
 */
function maskedRanges(text: string): [number, number][] {
  const out: [number, number][] = [];
  const patterns = [
    /https?:\/\/\S+/g,
    /\bwww\.\S+/g,
    /[\w.+-]+@[\w-]+\.[\w.]+/g,
    /`[^`]*`/g,
    /\b\d+(?:[.,]\d+)+\b/g,
    // "e.g." and friends: a full stop that does not end a sentence.
    /\b(?:e\.g|i\.e|etc|vs|Dr|Mr|Mrs|Ms|Prof|St|Jr|Sr|Ph\.D|U\.S|a\.m|p\.m)\./gi,
  ];
  for (const re of patterns) {
    for (const m of text.matchAll(re)) out.push([m.index, m.index + m[0].length]);
  }
  return out;
}

function inside(ranges: [number, number][], at: number): boolean {
  return ranges.some(([a, b]) => at >= a && at < b);
}

/**
 * Everything the rules can find, in the order it appears.
 *
 * Pure, so the screen showing it can be trusted not to have its own opinion,
 * and so every rule below is testable without a browser.
 */
export function proofread(text: string): Finding[] {
  const out: Finding[] = [];
  const masked = maskedRanges(text);
  const add = (f: Finding) => {
    if (!inside(masked, f.at)) out.push(f);
  };

  // A word said twice. The commonest error in anything written at midnight,
  // and the one the eye is worst at catching, because it reads what it expects.
  for (const m of text.matchAll(/\b([A-Za-z']+)(\s+)(\1)\b/gi)) {
    // "had had" and "that that" are real English. Everything else at midnight
    // is a slip.
    const word = m[1].toLowerCase();
    if (word === 'had' || word === 'that') continue;
    add({
      at: m.index,
      len: m[0].length,
      kind: 'repeat',
      found: m[0],
      says: `“${m[1]}” twice`,
      fix: m[1],
    });
  }

  for (const m of text.matchAll(/\b[A-Za-z]+\b/g)) {
    const right = MISSPELLINGS[m[0].toLowerCase()];
    if (!right) continue;
    // Match the capital the writer used, so a fix can be applied as-is.
    const fix = m[0][0] === m[0][0].toUpperCase() ? right[0].toUpperCase() + right.slice(1) : right;
    add({
      at: m.index,
      len: m[0].length,
      kind: 'spelling',
      found: m[0],
      says: 'a common misspelling',
      fix,
    });
  }

  for (const [re, replacement, why] of PHRASES) {
    for (const m of text.matchAll(re)) {
      add({
        at: m.index,
        len: m[0].length,
        kind: 'confusion',
        found: m[0],
        says: why,
        fix: m[0].replace(new RegExp(re.source, re.flags.replace('g', '')), replacement),
      });
    }
  }

  // A space in front of a comma. Almost always a stray keystroke, never right.
  for (const m of text.matchAll(/\s+([,;:.!?])/g)) {
    add({
      at: m.index,
      len: m[0].length,
      kind: 'spacing',
      found: m[0],
      says: `a space before the ${nameOf(m[1])}`,
      fix: m[1],
    });
  }

  // No space after one. Skipped inside URLs, decimals and abbreviations above.
  for (const m of text.matchAll(/([,;:])(?=[A-Za-z])/g)) {
    add({
      at: m.index,
      len: 1,
      kind: 'spacing',
      found: m[0],
      says: `no space after the ${nameOf(m[1])}`,
      fix: `${m[1]} `,
    });
  }
  for (const m of text.matchAll(/([.!?])(?=[A-Za-z]{2})/g)) {
    add({
      at: m.index,
      len: 1,
      kind: 'spacing',
      found: m[0],
      says: `no space after the ${nameOf(m[1])}`,
      fix: `${m[1]} `,
    });
  }

  // Two spaces between words. Harmless in a typewriter's world and visible in
  // a proportional one, which is every place this app puts text.
  for (const m of text.matchAll(/\S(  +)\S/g)) {
    add({
      at: m.index + 1,
      len: m[1].length,
      kind: 'spacing',
      found: m[1],
      says: 'more than one space',
      fix: ' ',
    });
  }

  for (const m of text.matchAll(/([!?,;:])\1+/g)) {
    add({
      at: m.index,
      len: m[0].length,
      kind: 'spacing',
      found: m[0],
      says: `the ${nameOf(m[1])} repeated`,
      fix: m[1],
    });
  }

  // A sentence starting in lower case. Not applied to the first character of
  // the whole text, which is often a fragment somebody is still writing.
  for (const m of text.matchAll(/[.!?]\s+([a-z])/g)) {
    add({
      at: m.index + m[0].length - 1,
      len: 1,
      kind: 'capital',
      found: m[1],
      says: 'a sentence starting in lower case',
      fix: m[1].toUpperCase(),
    });
  }

  // A lone "i". There is no sentence in which it is right.
  for (const m of text.matchAll(/\bi\b(?![.\w])/g)) {
    add({ at: m.index, len: 1, kind: 'capital', found: 'i', says: '“I” is capitalised', fix: 'I' });
  }

  out.push(...unbalanced(text));
  out.push(...longSentences(text));

  return out.sort((a, b) => a.at - b.at);
}

function nameOf(mark: string): string {
  return (
    {
      ',': 'comma',
      '.': 'full stop',
      ';': 'semicolon',
      ':': 'colon',
      '!': 'exclamation mark',
      '?': 'question mark',
    }[mark] ?? 'punctuation'
  );
}

/**
 * Brackets and quotes that never close.
 *
 * Reported at the one that was left open, not at the end of the document,
 * because "you have an unclosed bracket somewhere in nine hundred words" is
 * not help.
 */
export function unbalanced(text: string): Finding[] {
  const out: Finding[] = [];
  const pairs: Record<string, string> = { '(': ')', '[': ']', '{': '}' };
  const open: { char: string; at: number }[] = [];

  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (pairs[c]) open.push({ char: c, at: i });
    else if (c === ')' || c === ']' || c === '}') {
      const last = open.pop();
      if (!last || pairs[last.char] !== c) {
        out.push({
          at: i,
          len: 1,
          kind: 'pairs',
          found: c,
          says: `a ${c} with nothing it closes`,
          fix: '',
        });
        if (last) open.push(last);
      }
    }
  }
  for (const o of open) {
    out.push({
      at: o.at,
      len: 1,
      kind: 'pairs',
      found: o.char,
      says: `a ${o.char} that is never closed`,
      fix: '',
    });
  }

  // Quotation marks are counted rather than matched: a straight " is both an
  // opener and a closer, so the only honest thing to say is that there is an
  // odd number of them.
  const straight = (text.match(/"/g) ?? []).length;
  if (straight % 2 === 1) {
    const at = text.lastIndexOf('"');
    out.push({
      at,
      len: 1,
      kind: 'pairs',
      found: '"',
      says: 'an odd number of quotation marks',
      fix: '',
    });
  }
  return out;
}

/**
 * Sentences past `LONG_SENTENCE` words.
 *
 * A count, never a verdict. A fifty-word sentence can be the best one in a
 * paper; what the app can honestly say is how long it is and let the writer
 * look at it.
 */
export function longSentences(text: string): Finding[] {
  const out: Finding[] = [];
  const re = /[^.!?]+[.!?]*/g;
  for (const m of text.matchAll(re)) {
    const words = m[0].trim().split(/\s+/).filter(Boolean).length;
    if (words <= LONG_SENTENCE) continue;
    out.push({
      at: m.index + (m[0].length - m[0].trimStart().length),
      len: m[0].trim().length,
      kind: 'length',
      found: m[0].trim().slice(0, 60),
      says: `${words} words in one sentence — worth a look, not necessarily a change`,
      fix: '',
    });
  }
  return out;
}

/** Words, the way a word count means it. */
export function wordCount(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

/**
 * What the panel says at the top.
 *
 * Says nothing found rather than "looks good": the rules cover what they
 * cover, and the difference between "no rule fired" and "this is well written"
 * is the whole difference between a tool and a flatterer.
 */
export function proofLine(findings: Finding[], text: string): string {
  const words = wordCount(text);
  if (words === 0) return 'Nothing to check yet.';
  const n = findings.length;
  if (n === 0) return `${words} words. No rule here found anything.`;
  return `${words} words, ${n} ${n === 1 ? 'thing' : 'things'} worth a look.`;
}

/** Findings grouped for a list, hardest first. */
export const KIND_ORDER: ProofKind[] = [
  'spelling',
  'confusion',
  'repeat',
  'pairs',
  'capital',
  'spacing',
  'length',
];

export const KIND_LABEL: Record<ProofKind, string> = {
  spelling: 'Misspelled',
  confusion: 'Wrong word',
  repeat: 'Said twice',
  pairs: 'Unclosed',
  capital: 'Capitals',
  spacing: 'Spacing',
  length: 'Long sentences',
};

export function byKind(findings: Finding[]): [ProofKind, Finding[]][] {
  return KIND_ORDER.map(
    (kind) => [kind, findings.filter((f) => f.kind === kind)] as [ProofKind, Finding[]],
  ).filter(([, list]) => list.length > 0);
}

/**
 * One finding applied.
 *
 * Applied by position rather than by search-and-replace: the same misspelling
 * can appear four times and fixing the third should not silently fix the
 * first. Returns the text unchanged if the finding no longer matches what is
 * there, which is what happens when somebody edits while the panel is open.
 */
export function applyFix(text: string, f: Finding): string {
  if (!f.fix) return text;
  if (text.slice(f.at, f.at + f.len) !== f.found) return text;
  return text.slice(0, f.at) + f.fix + text.slice(f.at + f.len);
}

/**
 * The instruction for a second pass by Claude, where the student has one.
 *
 * Deliberately a reader, not a rewriter. It returns a list of problems in the
 * writer's own text — the same shape the rules above return — and never a
 * corrected version, because a corrected version is a draft and drafting is
 * fenced off from coursework by `lib/essay.ts` for reasons that do not stop
 * applying because the tool is called a proofreader.
 */
export const AI_SYSTEM = [
  'You are proofreading a student\'s own writing.',
  'List concrete problems only: spelling, grammar, punctuation, agreement, tense, and sentences whose meaning is unclear.',
  'For each, quote the exact phrase from the text, then say what is wrong in one short clause, then give the corrected phrase.',
  'One per line, in the form: "quoted phrase" — what is wrong — corrected phrase',
  'Do not rewrite the text. Do not produce a corrected version of any sentence longer than the phrase at fault.',
  'Do not comment on the argument, the ideas, the structure or the style.',
  'If you find nothing, say exactly: Nothing found.',
].join(' ');

/**
 * Whether a course's recorded policy allows even this.
 *
 * A proofreader is not a drafting tool and the fence is set accordingly: a
 * course recorded as banning AI outright bans this too, and everything else
 * permits it, because a spelling check is what "limited" nearly always means
 * it permits. Where nothing is recorded the answer is still yes — unlike
 * drafting — since a policy nobody has read is not evidence that the most
 * ordinary use of all is forbidden.
 *
 * The rules in this file run regardless. They are arithmetic on a string and
 * involve no model at all, which is worth saying on the screen.
 */
export function aiAllowed(stance: string | undefined): { ok: boolean; why: string } {
  if (stance === 'banned') {
    return {
      ok: false,
      why: 'This course is recorded as not permitting AI, so the second pass is off for it. The checks above still run — they are rules in this app, not a model.',
    };
  }
  return { ok: true, why: '' };
}
