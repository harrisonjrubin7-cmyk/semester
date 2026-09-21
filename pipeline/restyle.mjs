/**
 * Everything about a restyle that can be checked without calling a model.
 *
 * Kept apart from `restyle-script.mjs` because this is the half that has to be
 * right. A rewrite pass is asked to change how a script sounds and to leave
 * what it says alone, and "leave it alone" is not something a prompt can
 * guarantee — it is something the output has to be measured against. So the
 * model's answer is not written to disk until it has survived `check()`.
 *
 * Pure: no SDK import, no network, no filesystem. `app/src/lib/restyle.test.ts`
 * reads it across the repo root so its guard runs in the suite CI already runs.
 */

/**
 * Numbers a synthesiser can say, spelled out.
 *
 * `audio/README.md` is explicit that a script is written for the ear —
 * "eighty percent", not "80%" — so a check that only looked for digits would
 * miss most of the figures in the four scripts that ship. ECON's opening line
 * is "Eighty percent of this grade is three multiple-choice exams".
 */
const WORD_VALUE = {
  zero: '0', one: '1', two: '2', three: '3', four: '4', five: '5', six: '6',
  seven: '7', eight: '8', nine: '9', ten: '10', eleven: '11', twelve: '12',
  thirteen: '13', fourteen: '14', fifteen: '15', sixteen: '16',
  seventeen: '17', eighteen: '18', nineteen: '19', twenty: '20',
  thirty: '30', forty: '40', fifty: '50', sixty: '60', seventy: '70',
  eighty: '80', ninety: '90', hundred: '100', thousand: '1000',
  million: '1000000', billion: '1000000000',
  /*
   * Proportions keep their own word. "a quarter" and "25" are the same
   * quantity in arithmetic and not the same claim in a sentence — one is a
   * share and the other could be anything — so collapsing them would let a
   * rewrite swap one for the other unnoticed. They compare word-to-word.
   */
  half: 'half', third: 'third', quarter: 'quarter',
  double: 'double', triple: 'triple',
};

const WORD_NUMBER_RE = new RegExp(`\\b(${Object.keys(WORD_VALUE).join('|')})\\b`, 'gi');

/**
 * Every quantity a passage states, normalised to one token per fact.
 *
 * A spelled-out number resolves to its digits, so "three exams" and "3 exams"
 * are the same entry. This is not a nicety: the scripts that ship are written
 * for the ear and say "eighty percent", while a rewrite numbering a self-test
 * may reasonably write "1." where the original said "One." — and the first
 * draft of this check called that both an invented number and a dropped one,
 * which would have rejected a correct restyle on a formatting choice.
 */
export function quantities(text) {
  const found = new Map();
  const add = (q, n = 1) => found.set(q, (found.get(q) ?? 0) + n);

  const src = String(text);
  // Thousands separators first, so 1,000 is one fact rather than 1 and 000.
  const grouped = [];
  for (const m of src.matchAll(/\d{1,3}(?:,\d{3})+/g)) grouped.push(m[0]);
  const rest = grouped.reduce((acc, g) => acc.split(g).join(' '), src);
  for (const g of grouped) add(g.replace(/,/g, ''));

  for (const m of rest.matchAll(/\d+(?:\.\d+)?/g)) add(m[0]);
  for (const m of rest.matchAll(WORD_NUMBER_RE)) add(WORD_VALUE[m[1].toLowerCase()]);
  return found;
}

/** The words of a script, all lines joined. */
function spoken(script) {
  return (script.lines ?? []).map((l) => l.t ?? '').join(' \n');
}

/** Chapter titles, in order. They are the episode's navigation. */
export function chapters(script) {
  return (script.lines ?? []).filter((l) => l.chapter).map((l) => l.chapter);
}

/**
 * What is wrong with a restyled script, as a list of sentences.
 *
 * Empty means it may be written. Every entry is a thing a rewrite pass is
 * known to do when it is trying to be helpful, and each one is worse than a
 * script that was never restyled:
 *
 * - **An invented number.** The single worst outcome. A student revising from
 *   a restyled episode is revising from a figure nobody checked, and it will
 *   sound exactly as confident as the real ones.
 * - **A dropped number.** The quieter version: "eighty percent of the grade"
 *   becomes "most of the grade", and the one figure that decides how somebody
 *   studies is gone.
 * - **Moved or renamed chapters.** `audio/synth.py` turns these into the
 *   chapter marks the app's Listen mode shows, and `chapters.py` exists
 *   because marks that are wrong are worse than marks that are missing.
 * - **An unknown voice.** `synth.py` looks each `v` up in the `voices` map and
 *   would throw on a speaker the rewrite invented.
 * - **A lost pause.** The seven-second gaps in a self-test are the format:
 *   they are where the listener answers. A rewrite that drops them turns a
 *   self-test into a list of answers.
 */
export function check(original, restyled) {
  const problems = [];

  if (!restyled || typeof restyled !== 'object' || !Array.isArray(restyled.lines)) {
    return ['The restyled script is not a script: no `lines` array.'];
  }
  if (restyled.lines.length === 0) {
    return ['The restyled script has no lines.'];
  }

  // ── the voices have to be the ones that exist ──────────────────────────
  const voices = Object.keys(original.voices ?? {});
  const unknown = new Set();
  for (const line of restyled.lines) {
    if (!line || typeof line.t !== 'string' || !line.t.trim()) {
      problems.push('A line has no spoken text.');
      break;
    }
    if (!voices.includes(line.v)) unknown.add(String(line.v));
  }
  for (const v of unknown) {
    problems.push(`Unknown speaker "${v}" — the voices are ${voices.join(' and ')}.`);
  }

  // ── the chapters are the navigation ────────────────────────────────────
  const was = chapters(original);
  const now = chapters(restyled);
  if (was.join('\u0000') !== now.join('\u0000')) {
    const lost = was.filter((c) => !now.includes(c));
    const gained = now.filter((c) => !was.includes(c));
    if (lost.length) problems.push(`Chapters lost: ${lost.join(', ')}.`);
    if (gained.length) problems.push(`Chapters invented: ${gained.join(', ')}.`);
    if (!lost.length && !gained.length) {
      problems.push('The chapters are the same but their order changed.');
    }
  }

  // ── the self-test's silences are the self-test ─────────────────────────
  const pausesBefore = (original.lines ?? []).filter((l) => l.pause).length;
  const pausesAfter = restyled.lines.filter((l) => l.pause).length;
  if (pausesAfter < pausesBefore) {
    problems.push(
      `${pausesBefore - pausesAfter} of ${pausesBefore} answer-pauses were dropped — ` +
        'a self-test with no gap to answer in is a list of answers.',
    );
  }

  /*
   * ── and the facts ────────────────────────────────────────────────────
   *
   * Counted, not merely present. The first version of this compared sets, and
   * against the real ECON episode that is close to no check at all: "eighty"
   * is said four times there, so softening three of them to "most of the
   * grade" left the fourth to vouch for all four and the script came back
   * clean. Every course script repeats its figures — "three" appears fifteen
   * times in that same episode.
   *
   * A count that *rises* is allowed. Repeating a figure for emphasis is a
   * thing several of these styles do on purpose, and it cannot introduce a
   * claim that was not already there.
   */
  const before = quantities(spoken(original));
  const after = quantities(spoken(restyled));

  const invented = [...after.keys()].filter((q) => !before.has(q));
  if (invented.length) {
    problems.push(
      `Numbers that are not in the original: ${invented.sort().join(', ')}. ` +
        'A restyle may not introduce a figure.',
    );
  }

  const dropped = [...before.entries()]
    .filter(([q, n]) => (after.get(q) ?? 0) < n)
    .map(([q, n]) => `${q} (${n} → ${after.get(q) ?? 0})`);
  if (dropped.length) {
    problems.push(
      `Numbers dropped from the original: ${dropped.sort().join(', ')}. ` +
        'A figure a student revises from cannot be styled away.',
    );
  }

  return problems;
}

/**
 * The id a restyled episode ships under.
 *
 * A new id rather than the original's, because it is a different recording of
 * the same material and both may exist at once — the app lists editions per
 * course, and two files claiming to be `econ-podcast` would be one file.
 */
export function restyledId(original, style) {
  return `${original.id}-${style}`;
}

/**
 * The instruction given to the rewrite pass.
 *
 * Built here rather than in the CLI so a reader can see, in one place, exactly
 * what the model is told — including the constraints `check()` will enforce
 * afterwards. Telling it the rules and then checking them is not redundant:
 * the prompt is what makes a good result likely, and the check is what makes a
 * bad one impossible to ship.
 */
export function prompt(original, style) {
  return [
    `Rewrite this two-voice podcast script in the following style.`,
    '',
    `STYLE — ${style.label}. ${style.blurb}`,
    ...style.rules.map((r) => `- ${r}`),
    '',
    'RULES THAT OVERRIDE THE STYLE. The script teaches a real university course',
    'and students revise from it.',
    '- Do not change any fact, figure, definition, or claim. You are changing how',
    '  it is said, not what is said.',
    '- Do not introduce a number that is not already in the script. Not as an',
    '  example, not as an illustration, not "roughly". This is checked, and a',
    '  script that invents one is discarded.',
    '- Do not drop a number that is in the script.',
    '- Keep every `chapter` exactly as written, on a line in the same position in',
    '  the running order. They become the episode\'s chapter marks.',
    '- Keep every `pause`. They are where a listener answers a self-test question.',
    `- Use only these speakers: ${Object.keys(original.voices ?? {}).join(', ')}.`,
    '- Do not name, imitate, or reference any real presenter, show, or public',
    '  figure. The style above is a structure, not a person.',
    '',
    'Return JSON only: {"lines": [{"chapter"?: string, "v": string, "t": string,',
    '"pause"?: number}, ...]}. No prose before or after.',
    '',
    'THE SCRIPT:',
    JSON.stringify({ title: original.title, lines: original.lines }, null, 1),
  ].join('\n');
}

/**
 * The script inside a model's reply.
 *
 * The prompt asks for JSON and nothing else, and mostly that is what comes
 * back — but "mostly" is the word that matters in a script that writes files.
 * A fenced code block is the one deviation common enough to be worth
 * unwrapping rather than failing on; anything else throws, and the caller
 * treats a throw exactly like a failed `check()`: nothing is written.
 *
 * Here rather than in the CLI because this is the seam between a model's
 * output and the repository's files, and a seam that cannot be tested without
 * a network call is a seam that never gets tested.
 */
export function parseReply(text) {
  const trimmed = String(text ?? '').trim();
  if (!trimmed) throw new Error('The model returned nothing.');

  // ```json … ``` or ``` … ```, with or without the trailing newline.
  const fenced = trimmed.match(/^```(?:json)?\s*\n([\s\S]*?)\n?```$/);
  const body = fenced ? fenced[1] : trimmed;

  let parsed;
  try {
    parsed = JSON.parse(body);
  } catch (error) {
    const why = error instanceof Error ? error.message : String(error);
    throw new Error(`The model's reply is not JSON: ${why}`);
  }
  return parsed;
}

/**
 * The file a passing restyle becomes.
 *
 * Everything the original had, with a new identity: a restyle is a different
 * recording of the same course, and the app lists editions per course rather
 * than replacing one with another. The voices carry over unchanged — the style
 * is in the words, and which Piper voice says them is a separate decision the
 * roadmap keeps for the two archetypes Piper cannot perform.
 */
export function restyledScript(original, styleId, style, lines) {
  return {
    ...original,
    id: restyledId(original, styleId),
    title: `${original.title} — ${style.label}`,
    lines,
  };
}
