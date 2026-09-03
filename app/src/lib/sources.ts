/**
 * The sources you have, kept once instead of retyped every time.
 *
 * Four tools in this app refuse to invent a citation and ask for yours
 * instead — the project file, the drafting tool, the deck builder, the
 * practice paper. That refusal is right and it is also, as built, a repeated
 * inconvenience: the same six readings get pasted into a textarea every
 * session, from memory, with the page numbers wrong.
 *
 * So they get collected. Per course and per project rather than per session,
 * with a line about what each one is *for* — which is the field that actually
 * improves an essay and the one nobody keeps.
 *
 * ## Still never invented
 *
 * Nothing here generates a citation. A source enters this list because you
 * typed it or pasted it. `parse` reads a pasted line into fields where it
 * safely can and leaves everything else in `raw`, because a parser that
 * guesses an author from an ambiguous line produces a bibliography that is
 * wrong in a way nobody proofreads.
 *
 * ## BibTeX
 *
 * Exported, not imported-and-normalised. The point is to get what you already
 * have into Zotero or Overleaf without retyping, and a citation key that is
 * stable and readable does that. A field the app does not know is omitted
 * rather than filled in.
 */

export interface Source {
  id: string;
  /** Exactly as you entered it, and never overwritten by the parser. */
  raw: string;
  /** Read out of `raw` where that is unambiguous. Blank otherwise. */
  author: string;
  year: string;
  title: string;
  container: string;
  url: string;
  /** What this source is for in your argument — the field that earns marks. */
  role: string;
  courseId: string | null;
  /** A project or paper name, so one course's sources can be grouped. */
  project: string;
  created: number;
}

export type NewSource = Omit<Source, 'id' | 'created'>;

/**
 * A pasted line, read into fields where that is safe.
 *
 * Deliberately conservative. It takes a four-digit year in parentheses or
 * after a comma, a quoted or italicised title, and a URL — three things whose
 * shape is unambiguous. Everything else stays in `raw` and shows there, rather
 * than being split into an author and a title on a guess.
 *
 * A wrong author in a bibliography is worse than no author, because the raw
 * line is right there to read and a parsed field looks like it was checked.
 */
export function parse(raw: string): Omit<NewSource, 'role' | 'courseId' | 'project'> {
  const text = raw.trim();

  const url = /(https?:\/\/[^\s,;)"']+)/.exec(text)?.[1] ?? '';

  // A year is only a year when it is bracketed or fenced by punctuation —
  // otherwise "Chapter 1984 of" would become a date.
  const year =
    /\((\d{4})[a-z]?\)/.exec(text)?.[1] ??
    /(?:^|[,.]\s)(\d{4})[a-z]?(?=[,.)\s]|$)/.exec(text)?.[1] ??
    '';

  // A quoted title, or one in the position a title takes after the year.
  const quoted = /[“"']([^“”"']{4,})[”"']/.exec(text)?.[1] ?? '';
  const title = quoted.trim();

  // An author is the run before the first period or bracketed year — but only
  // when it looks like names rather than a sentence. Names carry a comma
  // ("Trounstine, J") or are short; "The lecture slides from week three" is
  // thirty-four characters, capitalised, and not an author, and an early
  // version of this happily filed it as one.
  let author = '';
  const head = text.split(/\s*[(.]\s*/)[0]?.trim() ?? '';
  const looksLikeNames =
    head.length > 0 &&
    head.length <= 60 &&
    /^[\p{Lu}]/u.test(head) &&
    // No leading article, and no ordinary sentence connective anywhere in it.
    !/^(the|a|an)\s/i.test(head) &&
    !/\s(the|a|an|is|are|was|were|and|of|for|from|with|about|in|on|at|by)\s/i.test(head) &&
    // Either "Surname, Initial" shape, or few enough words to be a name list.
    (head.includes(',') || head.split(/\s+/).length <= 3);
  if (looksLikeNames) author = head;

  return { raw: text, author, year, title, container: '', url };
}

/** Sources for a course, or every source when no course is named. */
export function forCourse(all: Source[], courseId: string | null): Source[] {
  const list = courseId === null ? all : all.filter((s) => s.courseId === courseId);
  return [...list].sort((a, b) => b.created - a.created);
}

/** The distinct project names in a list, for grouping. */
export function projects(all: Source[]): string[] {
  const seen = new Set<string>();
  for (const s of all) if (s.project.trim()) seen.add(s.project.trim());
  return [...seen].sort((a, b) => a.localeCompare(b));
}

/**
 * The list as the tools want it: one source per line, raw.
 *
 * Raw rather than reformatted, because what the model is being handed is what
 * the student actually has, and a citation the app tidied is a citation the
 * app has altered.
 */
export function asLines(list: Source[]): string {
  return list.map((s) => (s.role.trim() ? `${s.raw} — for: ${s.role.trim()}` : s.raw)).join('\n');
}

/**
 * A citation key: surname, year, first word of the title.
 *
 * Readable, stable, and made only from fields that were entered. Where there
 * is no author it falls back to the title, and where there is neither it uses
 * the id — a key nobody likes beats two entries silently sharing one, which
 * is how a bibliography loses a reference.
 */
export function citeKey(s: Source, taken: Set<string> = new Set()): string {
  const surname = s.author
    .split(/[,;]/)[0]
    .trim()
    .split(/\s+/)
    .pop();
  const word = s.title
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, '')
    .split(/\s+/)
    .find((w) => w.length > 3);

  const stem =
    [surname, s.year, word]
      .filter(Boolean)
      .join('')
      .replace(/[^\p{L}\p{N}]/gu, '') || `source${s.id.slice(0, 6)}`;

  let key = stem.toLowerCase();
  for (let n = 2; taken.has(key); n++) key = `${stem.toLowerCase()}${n}`;
  return key;
}

function escapeBib(text: string): string {
  // Braces and backslashes are BibTeX's own syntax; a stray one in a title
  // breaks the entry and every entry after it.
  return text.replace(/[\\{}]/g, '');
}

/**
 * BibTeX, from what was actually entered.
 *
 * A field the app does not have is left out rather than guessed. Where a
 * source was never parsed into fields at all, the raw line goes in as `note`
 * so nothing is lost — an entry you have to finish is better than a reference
 * that silently did not export.
 */
export function toBibtex(list: Source[]): string {
  const taken = new Set<string>();
  return list
    .map((s) => {
      const key = citeKey(s, taken);
      taken.add(key);

      const fields: string[] = [];
      if (s.author) fields.push(`  author = {${escapeBib(s.author)}}`);
      if (s.title) fields.push(`  title = {${escapeBib(s.title)}}`);
      if (s.container) fields.push(`  journal = {${escapeBib(s.container)}}`);
      if (s.year) fields.push(`  year = {${escapeBib(s.year)}}`);
      if (s.url) fields.push(`  url = {${escapeBib(s.url)}}`);
      // The raw line always goes in. It is the only field guaranteed correct.
      fields.push(`  note = {${escapeBib(s.raw)}}`);

      const type = s.url && !s.container ? 'misc' : s.container ? 'article' : 'misc';
      return `@${type}{${key},\n${fields.join(',\n')}\n}`;
    })
    .join('\n\n');
}

/** The list as a markdown reading list, with what each is for. */
export function toMarkdown(list: Source[], heading: string): string {
  const lines = [`# ${heading}`, ''];
  for (const s of list) {
    lines.push(`- ${s.raw}`);
    if (s.role.trim()) lines.push(`  - **For:** ${s.role.trim()}`);
  }
  return lines.join('\n');
}

/** What is missing from a source, for the screen to nudge about. */
export function gaps(s: Source): string[] {
  const out: string[] = [];
  if (!s.role.trim()) out.push('what it is for');
  if (!s.author && !s.title) out.push('an author or a title');
  if (!s.year) out.push('a year');
  return out;
}

/** How complete the list is, said without a score. */
export function completeness(list: Source[]): string {
  if (list.length === 0) return 'Nothing here yet.';
  const noRole = list.filter((s) => !s.role.trim()).length;
  if (noRole === 0) {
    return `${list.length} ${list.length === 1 ? 'source' : 'sources'}, and every one says what it is for.`;
  }
  return `${list.length} ${list.length === 1 ? 'source' : 'sources'}. ${noRole} ${
    noRole === 1 ? 'does not say' : 'do not say'
  } what it is for — that line is the one that earns marks.`;
}
