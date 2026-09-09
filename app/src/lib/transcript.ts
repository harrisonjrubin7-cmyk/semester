/**
 * The words in the recording, as text on the page.
 *
 * Four podcasts, an hour and a half of speech, and no way to read a word of
 * it. That is a wall for anybody deaf or hard of hearing — the app offers a
 * study mode they cannot use — and it is a smaller, daily nuisance for
 * everybody else: audio cannot be skimmed, searched, quoted into an essay, or
 * followed on a bus with no headphones. WCAG puts a text alternative for
 * recorded audio at Level A, which is the bar below which a thing is not
 * considered usable at all.
 *
 * The remarkable part is that none of it had to be written. Every line was
 * already in this repository, in `audio/scripts/`, because that is what the
 * synthesiser reads to produce the MP3s. The recording and the transcript are
 * the same document; only one of them had been shown to anybody.
 *
 * ## Loaded when it is opened, and not before
 *
 * `data/transcripts/<course>.ts` is a module per course — 120KB of prose in
 * total, which is not something to put in front of a first paint for a phone
 * opening Today. `load()` is a dynamic import, so a transcript is a chunk
 * fetched the first time somebody opens Listen for that course, cached by the
 * service worker like any other, and never fetched at all by somebody who
 * does not.
 *
 * ## Joined by chapter
 *
 * An edition already has chapters, with the second each starts at, and the
 * script is already marked up with the same names — that is how the chapter
 * marks were made exact. So the transcript is grouped the way the audio is,
 * a chapter of text under the chapter you can press to hear it. Nothing here
 * invents a second structure for the same episode.
 */

/** One line, as spoken: which voice said it, and what it said. */
export interface Said {
  /** The voice in the script — `host`, `expert`. Named, not numbered. */
  who: string;
  text: string;
}

export interface TranscriptChapter {
  /** Matches a chapter `name` on the edition, which is what joins the two. */
  name: string;
  said: Said[];
}

export interface Transcript {
  /** The edition this is the transcript of — `econ-podcast`. */
  episode: string;
  voices: string[];
  chapters: TranscriptChapter[];
}

/**
 * The courses with a transcript, as a literal map of dynamic imports.
 *
 * A literal rather than a computed path: a bundler can only split what it can
 * see, and `import(`./transcripts/${id}.ts`)` is a path it cannot resolve at
 * build time — Vite either bundles every match into one chunk or gives up.
 * Written out, each course is its own chunk, which is the whole point.
 */
const LOADERS: Record<string, () => Promise<{ default: Transcript }>> = {
  bus: () => import('../data/transcripts/bus'),
  core: () => import('../data/transcripts/core'),
  econ: () => import('../data/transcripts/econ'),
  psci: () => import('../data/transcripts/psci'),
};

/** Whether an episode has a transcript at all, without fetching it. */
export function hasTranscript(courseId: string, episodeId: string): boolean {
  // The podcast editions are the ones spoken from a script. A "Full read" is
  // the study guide read aloud, and its text alternative is the guide itself —
  // already in the app, in Read and in Field guide. Saying otherwise here
  // would promise a transcript that does not exist rather than point at the
  // one that does.
  return courseId in LOADERS && episodeId.endsWith('-podcast');
}

/** The transcript for a course, or null where there is none. */
export async function load(courseId: string): Promise<Transcript | null> {
  const loader = LOADERS[courseId];
  if (!loader) return null;
  try {
    return (await loader()).default;
  } catch {
    // A chunk that will not load offline is a missing transcript, not a
    // broken screen: Listen goes on working and says nothing it cannot back
    // up. The audio itself is cached the same way and fails the same way.
    return null;
  }
}

/** How the speakers are named on the page. */
const SPOKEN: Record<string, string> = { host: 'Host', expert: 'Expert' };

/**
 * A voice's name, for the label beside what it said.
 *
 * A transcript that reads "host: … expert: …" is a script; one that names
 * them is a conversation. Unknown voices are title-cased rather than dropped,
 * so a third speaker added to a re-record is labelled rather than anonymous.
 */
export function speaker(who: string): string {
  return SPOKEN[who] ?? who.charAt(0).toUpperCase() + who.slice(1);
}

/** Roughly how long a chapter takes to read, for the line under its name. */
export function readingTime(said: Said[]): string {
  const words = said.reduce((n, l) => n + l.text.split(/\s+/).length, 0);
  // 200 wpm is the usual figure for silent reading of ordinary prose, and the
  // number is rounded up: "1 min" over a 20-second chapter is a kinder lie
  // than "0 min".
  return `${Math.max(1, Math.round(words / 200))} min read`;
}
