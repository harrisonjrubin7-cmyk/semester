/**
 * What the app has downloaded to play offline, and how to get rid of it.
 *
 * ## What was wrong
 *
 * `public/sw.js` caches audio, decks and handouts on first play and keeps
 * them — deliberately, and it is the whole offline promise: a lesson on the
 * walk to class, a drill on a plane, the guide in a basement library. What it
 * had was no ceiling, no eviction and no way out. The site ships 212 MB of
 * audio; a student who works through the term plays their way to most of it,
 * sees the number climb in *Room on this device* — which reads
 * `navigator.storage.estimate()`, and therefore counts every byte of this —
 * and had nowhere to act on it.
 *
 * On iOS that matters more than the number suggests. Safari evicts by origin
 * under storage pressure, so media nobody chose to keep can take the shell and
 * the offline promise down with it. The lessons are the least valuable thing
 * in the cache and the largest, and they were the one thing that could not be
 * dropped on purpose.
 *
 * ## Why the page reads the cache rather than asking the worker
 *
 * Cache Storage is the page's API too. A worker round trip would add a
 * protocol, a message type on both sides, and a state where the worker is not
 * yet controlling the page and the screen has nothing to show — all to reach
 * the same `caches` object this file can open directly. The worker is what
 * *fills* the cache, because only it sees the fetches; nothing about reading
 * or emptying it needs to go through there.
 *
 * ## Why the cache is found by suffix
 *
 * `sw.js` names it `${VERSION}-media`, and the version is a constant that
 * someone will one day bump. Matching on the suffix means that bump does not
 * strand a screenful of files this is the only way to delete — and it takes in
 * the old worker's cache in the window before `activate` has swept it. It also
 * cannot touch the two caches that are not this screen's business: the shell,
 * which is what makes the app open at all, and `semester-shared`, which is a
 * file in mid-handover.
 */

/** What `sw.js` calls the cache it puts played media in. */
export const MEDIA_SUFFIX = '-media';

/**
 * The ceiling the worker holds the cache under, and the ledger it keeps.
 *
 * Both are `sw.js`'s, written there and read here. They are duplicated rather
 * than imported for the reason `lib/publichost.ts` gives about the calendar
 * host rule: a service worker is not a module this app can import from, and
 * the alternative — a build step that writes one file from the other — is more
 * machinery than one number and one string are worth. `downloads.test.ts`
 * reads `public/sw.js` and fails if either drifts.
 */
export const MEDIA_CAP = 150 * 1024 * 1024;

/** The ledger's key, minus the base the worker prefixes it with. */
export const LEDGER_NAME = '__media-ledger';

/** What the worker threw out to stay under the cap, and when. */
export interface Shed {
  at: number;
  bytes: number;
  paths: string[];
}

export type Kind = 'lesson' | 'edition' | 'deck' | 'handout' | 'other';

export interface Download {
  /** The cache key. Deleting one needs this rather than the path. */
  url: string;
  path: string;
  kind: Kind;
  /** The course id the path names, or `''` when it names none. */
  course: string;
  bytes: number;
}

export interface Shelf {
  course: string;
  bytes: number;
  count: number;
  /** "12 lessons · 3 podcast editions · a deck", built by `shelfLine`. */
  line: string;
}

/**
 * Which course a cached file belongs to and what sort of file it is.
 *
 * Every path the worker caches carries the course id, in one of four shapes,
 * and this is the only place that knows them:
 *
 *     audio/lessons/psci/unit-3.mp3   a lesson
 *     audio/psci-podcast.mp3          an edition — podcast, full, condensed, guide
 *     decks/psci.pptx                 the deck
 *     handouts/psci.pdf               a handout
 *
 * The base is not fixed — the app is served from `/` locally and `/semester/`
 * on Pages — so every match is anchored on the directory rather than on the
 * start of the path. Anything else that has landed in there is `other` with no
 * course, which keeps it counted and clearable without pretending to know what
 * it is.
 */
export function describe(path: string): { kind: Kind; course: string } {
  const lesson = /\/audio\/lessons\/([a-z0-9-]+)\/unit-\d+\.mp3$/i.exec(path);
  if (lesson) return { kind: 'lesson', course: lesson[1].toLowerCase() };

  const index = /\/audio\/lessons\/([a-z0-9-]+)\//i.exec(path);
  if (index) return { kind: 'other', course: index[1].toLowerCase() };

  const edition = /\/audio\/([a-z0-9]+)-[a-z0-9]+\.mp3$/i.exec(path);
  if (edition) return { kind: 'edition', course: edition[1].toLowerCase() };

  const deck = /\/decks\/([a-z0-9-]+)\.pptx$/i.exec(path);
  if (deck) return { kind: 'deck', course: deck[1].toLowerCase() };

  const handout = /\/handouts\/([a-z0-9-]+)\.(pdf|docx)$/i.exec(path);
  if (handout) return { kind: 'handout', course: handout[1].toLowerCase() };

  return { kind: 'other', course: '' };
}

/** `4` → `4 lessons`, `1` → `a lesson`. Nothing at all returns `''`. */
function counted(n: number, one: string, many: string): string {
  if (n <= 0) return '';
  return n === 1 ? `a ${one}` : `${n} ${many}`;
}

/** What a course's shelf holds, in the order somebody would say it. */
export function shelfLine(items: Download[]): string {
  const n = (k: Kind) => items.filter((i) => i.kind === k).length;
  return [
    counted(n('lesson'), 'lesson', 'lessons'),
    counted(n('edition'), 'podcast edition', 'podcast editions'),
    counted(n('deck'), 'deck', 'decks'),
    counted(n('handout'), 'handout', 'handouts'),
  ]
    .filter(Boolean)
    .join(' · ');
}

/**
 * One shelf per course, largest first, with anything uncoursed last.
 *
 * Largest first because the screen exists to answer "what is taking the room",
 * and the answer to that is a size rather than an alphabet.
 */
export function shelves(items: Download[]): Shelf[] {
  const by = new Map<string, Download[]>();
  for (const item of items) {
    const key = item.course;
    const held = by.get(key);
    if (held) held.push(item);
    else by.set(key, [item]);
  }
  return [...by.entries()]
    .map(([course, held]) => ({
      course,
      bytes: held.reduce((n, i) => n + i.bytes, 0),
      count: held.length,
      line: shelfLine(held) || counted(held.length, 'file', 'files'),
    }))
    .sort((a, b) => (a.course === '' ? 1 : b.course === '' ? -1 : b.bytes - a.bytes));
}

export function totalBytes(items: Download[]): number {
  return items.reduce((n, i) => n + i.bytes, 0);
}

/** The path a cache key names, so a key and a URL compare as the same thing. */
function pathOf(url: string): string {
  try {
    return new URL(url, 'http://local').pathname;
  } catch {
    return url;
  }
}

/**
 * How big a cached response is, without fetching anything.
 *
 * `content-length` first, because it is a header read and the entry was
 * cached from a static host that sends one. When it is absent — a response
 * that arrived chunked, or a browser that does not keep the header —
 * `.blob()` is the fallback: the bytes are already on this device, and a Blob
 * from Cache Storage is a handle to them rather than a copy in memory. It is
 * still the slower of the two, which is why it is second.
 */
async function bytesOf(res: Response): Promise<number> {
  const said = Number(res.headers.get('content-length') ?? '');
  if (Number.isFinite(said) && said > 0) return said;
  try {
    return (await res.blob()).size;
  } catch {
    return 0;
  }
}

/** The caches `sw.js` puts media in, and no others. See the note at the top. */
async function mediaCaches(store: CacheStorage): Promise<string[]> {
  const keys = await store.keys();
  return keys.filter((k) => k.endsWith(MEDIA_SUFFIX));
}

/**
 * Everything downloaded, measured.
 *
 * Resolves to an empty list rather than throwing on a browser with no Cache
 * Storage, in a window where it is not allowed, or when the read fails
 * halfway. The screen above this draws nothing for an empty list, which is
 * the right answer to all three: there is nothing downloaded that this can
 * show or clear.
 */
export async function readDownloads(store = globalThis.caches): Promise<Download[]> {
  if (!store) return [];
  const out: Download[] = [];
  try {
    for (const name of await mediaCaches(store)) {
      const cache = await store.open(name);
      for (const request of await cache.keys()) {
        const path = pathOf(request.url);
        // The worker's own bookkeeping, not a download. It is a few hundred
        // bytes and it is not something anybody chose to keep.
        if (path.endsWith(LEDGER_NAME)) continue;
        const res = await cache.match(request);
        if (!res) continue;
        out.push({ url: request.url, path, bytes: await bytesOf(res), ...describe(path) });
      }
    }
  } catch {
    // A cache that will not open is one this screen cannot report on. What was
    // read before it is still true, and is returned.
  }
  return out;
}

/**
 * Empty the media caches, and nothing else.
 *
 * The caches are deleted rather than emptied entry by entry: it is one call
 * per cache instead of one per file, and `sw.js` opens it again on the next
 * play. Answers whether it got through, because a button that says it cleared
 * something it did not is worse than one that failed.
 */
export async function clearDownloads(store = globalThis.caches): Promise<boolean> {
  if (!store) return false;
  try {
    for (const name of await mediaCaches(store)) await store.delete(name);
    return true;
  } catch {
    return false;
  }
}

/** The same for one course, which is entry by entry because it has to be. */
export async function clearCourse(course: string, store = globalThis.caches): Promise<boolean> {
  if (!store) return false;
  try {
    for (const name of await mediaCaches(store)) {
      const cache = await store.open(name);
      for (const request of await cache.keys()) {
        if (describe(pathOf(request.url)).course === course) await cache.delete(request);
      }
    }
    return true;
  } catch {
    return false;
  }
}

/**
 * What the worker last threw out to stay under the cap, or null.
 *
 * `lib/keep.ts` argues this about shedding a full store and the argument is
 * the same here: a cache that quietly threw away last month's lessons is the
 * same betrayal in a smaller coat. The worker writes what went; this is how
 * the screen gets to say so.
 *
 * One event, the most recent, replaced by the next and gone when downloads are
 * cleared. Not a log: a student does not need the history of their cache, they
 * need to know that the thing they are about to look for is not there.
 */
export async function readShed(store = globalThis.caches): Promise<Shed | null> {
  if (!store) return null;
  try {
    for (const name of await mediaCaches(store)) {
      const cache = await store.open(name);
      for (const request of await cache.keys()) {
        if (!pathOf(request.url).endsWith(LEDGER_NAME)) continue;
        const res = await cache.match(request);
        if (!res) continue;
        const held: unknown = await res.json();
        const shed = (held as { shed?: unknown } | null)?.shed;
        if (!shed || typeof shed !== 'object') continue;
        const { at, bytes, paths } = shed as Partial<Shed>;
        if (typeof at !== 'number' || typeof bytes !== 'number' || !Array.isArray(paths)) continue;
        return { at, bytes, paths: paths.filter((x): x is string => typeof x === 'string') };
      }
    }
  } catch {
    // No ledger, or one that will not parse. There is nothing to report, which
    // is also what a cache that has never been over the cap looks like.
  }
  return null;
}

/** "a, b and c" — a list inside a sentence rather than a list in a row. */
function prose(parts: string[]): string {
  if (parts.length <= 1) return parts[0] ?? '';
  return `${parts.slice(0, -1).join(', ')} and ${parts[parts.length - 1]}`;
}

/**
 * "2 lessons and a podcast edition from PSCI", or what there is of it.
 *
 * The same counts a shelf line gives, joined as prose rather than with the
 * shelf's middle dots. A shelf line sits in a row and reads as a list; this
 * sits inside a sentence, and `2 lessons · a podcast edition from BUS went`
 * is not a sentence. Written the other way first and changed on reading it in
 * the app.
 */
export function shedLine(shed: Shed): string {
  const items: Download[] = shed.paths.map((path) => ({
    url: path,
    path,
    bytes: 0,
    ...describe(path),
  }));
  const kinds = prose(shelfLine(items).split(' · ').filter(Boolean));
  const courses = [...new Set(items.map((i) => i.course).filter(Boolean))].map((c) =>
    c.toUpperCase(),
  );
  const from = courses.length ? ` from ${prose(courses)}` : '';
  return kinds ? `${kinds}${from}` : counted(shed.paths.length, 'file', 'files');
}
