/**
 * Sources from outside the syllabus, found rather than invented.
 *
 * Ask Claude is grounded in a course's own material on purpose — `ai/prompt.ts`
 * and `lib/context.ts` between them make sure an answer about ECON 1020 comes
 * out of ECON 1020. That is right for "what is due" and for "explain
 * elasticity", and it is exactly wrong for the thing a paper actually needs:
 * three sources the professor did not assign.
 *
 * The app's answer to that has been, correctly, to refuse. Four tools decline
 * to produce a citation and ask for yours instead, and `screens/Sources.tsx`
 * exists because that refusal was a repeated inconvenience. What none of them
 * could do was help you *find* one.
 *
 * ## Why this is possible now and was not before
 *
 * It looked like it needed a search back end, which this app does not have and
 * should not grow. It does not: the Messages API has a server-side web search
 * tool, so the searching happens on Anthropic's infrastructure and comes back
 * in the same response. There is no service to run, no key to hold, and no
 * index of anybody's reading list anywhere.
 *
 * ## The distinction this whole file rests on
 *
 * **A found source is not a generated one.** The failure everybody has seen
 * from a language model asked for references is the confident invention: a
 * plausible author, a plausible journal, a plausible year, and no such paper.
 * `screens/Sources.tsx` says in as many words that nothing on it generates a
 * citation, and that sentence is load-bearing.
 *
 * What comes back here is different in kind. Every row is a URL the search
 * returned — a page that exists, whose title is the page's own — and the model
 * is told to describe what it found rather than to compose a bibliography.
 * Nothing is written to your sources by this file: {@link asSource} builds a
 * row, the screen offers it, and you add it. That is the same shape every
 * other proposal in this app has, and `ai/prompt.ts` gives the reason.
 *
 * It still is not a substitute for reading the thing. The role field —
 * "what it is for in your argument" — is left empty on purpose: it is the one
 * field that earns marks, the one nobody keeps, and the one that cannot
 * honestly be filled in by something that has read a search result.
 */

import type { NewSource } from './sources';

/**
 * How many searches one question may run.
 *
 * Each one is billed. Five is enough for a question with two or three facets
 * and short of the runaway where a model decides to survey a literature; past
 * it the API stops and says so rather than continuing, which is the behaviour
 * worth having when the meter is somebody's own card.
 */
export const MOST_SEARCHES = 5;

/**
 * The models that take the current search tool.
 *
 * The tool's type string is dated and the newer one is not accepted by older
 * models, so the choice is per model rather than a constant. Of the four this
 * app offers, three are current; Haiku 4.5 predates the dated variant and
 * takes the basic one. Anything unrecognised gets the basic type too — it is
 * the conservative side of the guess, since the older type is accepted
 * everywhere the newer one is.
 */
const CURRENT = /^claude-(opus-(5|4-8|4-7|4-6)|sonnet-(5|4-6)|fable-5(-1)?|mythos-5(-1)?)$/;

/** The server-side search tool, as this model will accept it. */
export function searchTool(model: string): Record<string, unknown> {
  return {
    type: CURRENT.test(model.trim()) ? 'web_search_20260209' : 'web_search_20250305',
    name: 'web_search',
    max_uses: MOST_SEARCHES,
  };
}

/** One page the search turned up. */
export interface Found {
  title: string;
  url: string;
  /** The site it is on, read off the URL. Empty when the URL will not parse. */
  site: string;
}

/**
 * The rows out of a `web_search_tool_result` block, or the reason there are none.
 *
 * The branch is the point. A server tool does not throw: a failed search comes
 * back as HTTP 200 with a block whose `content` is an **object** carrying an
 * error code, where a successful one is an **array**. Code that indexes
 * straight into `content` gets `undefined` from the error case and reports no
 * results, which reads on screen as "nothing was found about this" — a
 * factual claim about the world, made from a failed request.
 */
export function readFound(block: unknown): { found: Found[]; error: string } {
  const content = (block as { content?: unknown } | null)?.content;

  if (content && !Array.isArray(content) && typeof content === 'object') {
    const code = (content as { error_code?: unknown }).error_code;
    return { found: [], error: explainSearch(typeof code === 'string' ? code : '') };
  }
  if (!Array.isArray(content)) return { found: [], error: '' };

  const found: Found[] = [];
  for (const row of content) {
    const r = row as { url?: unknown; title?: unknown } | null;
    if (!r || typeof r.url !== 'string' || !r.url.trim()) continue;
    const url = r.url.trim();
    found.push({
      url,
      title: typeof r.title === 'string' && r.title.trim() ? r.title.trim() : url,
      site: siteOf(url),
    });
  }
  return { found, error: '' };
}

/** The error codes the search tool returns, in words a student can act on. */
export function explainSearch(code: string): string {
  switch (code) {
    case 'max_uses_exceeded':
      return `That took more than ${MOST_SEARCHES} searches. Ask it something narrower.`;
    case 'too_many_requests':
      return 'The search is rate-limited right now. Try again in a minute.';
    case 'query_too_long':
      return 'That question is too long to search on. Shorten it.';
    case 'unavailable':
      return 'Search was unavailable for that request.';
    default:
      // Named rather than swallowed: an unknown code is still information,
      // and "something went wrong" is the sentence that teaches people the
      // app does not know what happened.
      return code ? `The search failed (${code}).` : 'The search failed.';
  }
}

/** The host, without `www.`, for showing beside a title. */
function siteOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return '';
  }
}

/**
 * One found page, as a row for the sources list.
 *
 * `raw` is what the student will read on the Sources screen and is built to be
 * a citation line they can correct rather than a finished one — title, site,
 * URL, in that order. The parser on that screen reads a quoted title and a URL
 * out of it and leaves the rest alone, which is the behaviour wanted here:
 * nothing is claimed about an author or a year, because a search result does
 * not reliably carry either, and a wrong author is worse than none.
 *
 * `role` stays empty. See the note at the top of this file.
 */
export function asSource(f: Found, courseId: string | null, project: string): NewSource {
  return {
    raw: [`“${f.title}”`, f.site, f.url].filter(Boolean).join('. '),
    author: '',
    year: '',
    title: f.title,
    container: f.site,
    url: f.url,
    role: '',
    courseId,
    project,
  };
}

/**
 * The same page twice is one page.
 *
 * A model running five searches on one question finds the same paper from
 * three of them, and three identical rows with three Add buttons is a list
 * nobody trusts. Keyed on the URL with the fragment and the tracking query
 * dropped, so the same article arriving from a search result and from a share
 * link is recognised as itself.
 */
export function dedupe(found: Found[]): Found[] {
  const seen = new Set<string>();
  const out: Found[] = [];
  for (const f of found) {
    const key = keyOf(f.url);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(f);
  }
  return out;
}

function keyOf(url: string): string {
  try {
    const u = new URL(url);
    u.hash = '';
    for (const p of [...u.searchParams.keys()]) {
      if (/^(utm_|fbclid|gclid|ref$|ref_)/i.test(p)) u.searchParams.delete(p);
    }
    return `${u.hostname.replace(/^www\./, '')}${u.pathname.replace(/\/$/, '')}${u.search}`.toLowerCase();
  } catch {
    return url.trim().toLowerCase();
  }
}

/**
 * What the model is for here, which is narrower than "research".
 *
 * Three things it says that are not decoration:
 *
 * - **Describe what you found; do not compose a bibliography.** The invented
 *   citation is the failure mode of this whole category, and the way it gets
 *   in is a prompt that asks for references rather than for an account of
 *   pages that were actually opened.
 * - **Say when a source is weak, or partisan, or a blog.** A student handing
 *   in a paper is graded on the quality of what they cite, and a list that
 *   presents a think-tank briefing and a peer-reviewed article as equals is
 *   worse than no list — it costs marks in a way they cannot see coming.
 * - **Say when you did not find much.** "Nothing solid came up" is a real and
 *   useful answer, and it is the one a model asked for sources will not give
 *   unless told it may.
 */
export const RESEARCH_SYSTEM = [
  'You are helping a university student find sources outside the material their course assigned —',
  'for a paper, a project, or a question their syllabus does not cover.',
  '',
  'Search the web, then write a short briefing on what you found. Not an essay: a few paragraphs',
  'that say what the main positions or findings are, who holds them, and where they disagree.',
  'Cite as you go, by naming the source in the sentence that uses it.',
  '',
  'What you must not do:',
  '· Never describe a source you did not open in this search. If you know of a paper from memory',
  '  and it did not come up, say so in those words rather than listing it as a result — an',
  '  invented citation is the one failure that costs a student marks and their credibility.',
  '· Never state an author, a year, a journal or a page number you did not see on the page.',
  '  Where a detail is not in what you read, leave it out and say it needs checking.',
  '· Never present a blog post, a think-tank briefing, a press release or a student essay as',
  '  though it were peer-reviewed. Say plainly what kind of thing each source is, and say when',
  '  one is partisan or is somebody with an interest in the answer.',
  '',
  'If the search turns up little of substance, say that. "There is not much good material on this',
  'in open sources" is a useful answer and an honest one; a thin list dressed up as a strong one',
  'is neither. Where the real answer is that they should be reading what their course assigned,',
  'or asking a librarian, say that too.',
  '',
  'Finish with one line on what is missing — the kind of source that would settle the question and',
  'did not come up.',
].join('\n');

/**
 * What to ask, from what the student typed.
 *
 * The course is given as context rather than as a filter. A student writing
 * about deterrence for PSCI 1104 wants the literature on deterrence, not
 * pages that mention their course code — and a search that included it would
 * return the syllabus, which is the one document they already have.
 */
export function brief(question: string, course: string): string {
  const lines = [question.trim()];
  if (course.trim()) {
    lines.push(
      '',
      `This is for ${course.trim()}. Use that for the level and the angle — it is context, not a search term.`,
    );
  }
  return lines.join('\n');
}
