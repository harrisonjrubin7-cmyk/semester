/**
 * A rolling note of what went wrong, so somebody else's phone can be debugged.
 *
 * The app is used on devices nobody can attach a debugger to. When it misbehaves
 * for a person who is not you, the entire evidence available today is whatever
 * they think they remember doing. That is not enough to fix anything, and it is
 * why "it does that sometimes" bugs live forever.
 *
 * ## It stays on the device unless somebody sends it
 *
 * Nothing here is uploaded, and there is no error-reporting service. The log is
 * a ring buffer in `localStorage`, and the only way it leaves is a button that
 * saves a file the student can look at and then send. That is slower than
 * automatic reporting and it is the version somebody can consent to.
 *
 * ## It records what happened, not who
 *
 * Messages and stack traces, the screen, the build, the browser. Not the
 * content of a note, not a deadline title, not an email address. The dump is
 * something a person should be able to open, read, and send without having to
 * check what is in it — so nothing goes in that they would have to check.
 */

export interface Entry {
  at: number;
  /** 'error' for something thrown, 'note' for something worth knowing. */
  kind: 'error' | 'note';
  message: string;
  /** Where they were, which is the single most useful field. */
  screen: string;
  /** First few frames only. A full trace is mostly framework noise. */
  where?: string;
}

/** How many to keep. Enough to cover a session, small enough to never matter. */
export const KEEP = 50;

export const LOG_KEY = 'semester.log';

/** Trim a stack to the frames that name this app's own files. */
export function frames(stack: string | undefined, limit = 4): string {
  if (!stack) return '';
  return stack
    .split('\n')
    .slice(1)
    .map((l) => l.trim())
    .filter(Boolean)
    .slice(0, limit)
    .join(' ← ');
}

/**
 * Anything that could be somebody's own writing, removed.
 *
 * An error message can carry the text it failed on — a note's title in a JSON
 * parse error, a course code in a lookup. The dump has to be safe to send
 * without reading, so quoted runs and anything long are cut rather than trusted.
 */
export function scrub(message: string): string {
  return message
    .replace(/["'`][^"'`]{24,}["'`]/g, '"…"')
    .replace(/\b[\w.+-]+@[\w-]+\.[\w.]+\b/gi, '(an email address)')
    .replace(/\bsk-[A-Za-z0-9_-]{8,}/g, '(a key)')
    .replace(/\beyJ[A-Za-z0-9_-]{10,}/g, '(a token)')
    .slice(0, 300);
}

export function entry(
  kind: Entry['kind'],
  message: string,
  screen: string,
  stack?: string,
  at = Date.now(),
): Entry {
  const where = frames(stack);
  return { at, kind, message: scrub(message), screen, ...(where ? { where } : {}) };
}

/** The newest `KEEP`, oldest first. */
export function add(log: Entry[], e: Entry): Entry[] {
  return [...log, e].slice(-KEEP);
}

export function read(raw: string | null): Entry[] {
  if (!raw) return [];
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (e): e is Entry =>
        Boolean(e) && typeof e === 'object' && typeof e.message === 'string' && typeof e.at === 'number',
    );
  } catch {
    return [];
  }
}

export interface About {
  build: string;
  screen: string;
  language: string;
  agent: string;
  /** Whether an account is configured at all, not which one. */
  cloud: boolean;
  signedIn: boolean;
  storageUsed: number;
  schema: string;
}

/**
 * The dump, as text somebody can read before sending it.
 *
 * Plain text rather than JSON on purpose: a person deciding whether to send
 * this should be able to see what is in it, and JSON is not something most
 * people read. It is also what makes the promise above checkable by whoever
 * receives it.
 */
export function dump(about: About, log: Entry[], now = Date.now()): string {
  const when = (at: number) => new Date(at).toISOString().replace('T', ' ').slice(0, 19);
  const lines = [
    'Semester — diagnostics',
    `Written ${when(now)}`,
    '',
    'This file holds error messages and where they happened. It does not hold',
    'your notes, your deadlines, your grades or your email address.',
    '',
    `Build          ${about.build}`,
    `Screen         ${about.screen}`,
    `Stored shape   ${about.schema}`,
    `Account        ${about.cloud ? (about.signedIn ? 'signed in' : 'configured, signed out') : 'not configured in this build'}`,
    `Storage used   ${Math.round(about.storageUsed / 1024)} kB`,
    `Language       ${about.language}`,
    `Browser        ${about.agent}`,
    '',
    log.length === 0 ? 'Nothing has gone wrong since this device last cleared its log.' : `Last ${log.length}:`,
  ];
  for (const e of log) {
    lines.push('', `${when(e.at)}  ${e.kind === 'error' ? 'ERROR' : 'note '}  on ${e.screen || '?'}`);
    lines.push(`  ${e.message}`);
    if (e.where) lines.push(`  ${e.where}`);
  }
  return `${lines.join('\n')}\n`;
}

export function dumpName(at: number): string {
  const d = new Date(at);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `semester-diagnostics-${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}-${pad(
    d.getHours(),
  )}${pad(d.getMinutes())}.txt`;
}
