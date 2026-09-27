/**
 * Taking a question to an AI service Semester does not run.
 *
 * Semester's own assistant is the one the school configures: its provider,
 * its key, its policy (`lib/assistant.ts`, `server/institution/`). Students
 * also use Claude, ChatGPT, Perplexity and Grok on their own accounts, and
 * pretending otherwise just means they copy course material into them by
 * hand with no idea what went along with it. This is the other route: the
 * student picks what goes, reads exactly what will be sent, and the service
 * opens in a new tab with that and nothing else.
 *
 * What this deliberately is not:
 *
 *  · **Not a connection.** There is no sign-in, no token and no API call.
 *    Nothing is read back out of the other service, and its conversations
 *    never come into Semester. The only thing that crosses is the text in the
 *    link, which the student has read.
 *  · **Not automatic.** Every handoff is one press, after a review that lists
 *    what goes and what does not. There is no "always allow".
 *  · **Not official.** The review says the other service's own privacy terms
 *    apply, and nothing it answers is shown inside Semester as course
 *    guidance.
 *
 * ## What can go
 *
 * `prepare` takes exactly three things — the student's question, one course's
 * code and title, and an excerpt the student pasted — and the preview is
 * built from the same pieces as the prompt, so the two cannot disagree
 * (`aihandoff.test.ts` rebuilds the prompt from the preview to prove it). There
 * is no parameter for grades, enrolment, other courses, a name or an email,
 * so there is no code path that could add them.
 *
 * ## Grok
 *
 * Listed, and not offered. The school has not reviewed it, and a handoff
 * that a school has not reviewed is still Semester pointing a student at it.
 * It is named so a student looking for it is told why it is missing rather
 * than left to wonder.
 */

export type ExternalAiId = 'claude' | 'chatgpt' | 'perplexity' | 'grok';

export interface ExternalAi {
  id: ExternalAiId;
  name: string;
  /** What it is good for, in one line. */
  role: string;
  /** Whether the school has looked at it. Only `reviewed` is offered. */
  review: 'reviewed' | 'not-reviewed';
  /** Said on the review screen, under the list of what goes. */
  note: string;
  /** The page that opens, with the prompt filled in. */
  url: (prompt: string) => string;
}

export const EXTERNAL_AI: Record<ExternalAiId, ExternalAi> = {
  claude: {
    id: 'claude',
    name: 'Claude',
    role: 'Explaining an idea, working through a problem, feedback on your own draft.',
    review: 'reviewed',
    note: 'Opens claude.ai with your question filled in. You press send there.',
    url: (p) => `https://claude.ai/new?q=${encodeURIComponent(p)}`,
  },
  chatgpt: {
    id: 'chatgpt',
    name: 'ChatGPT',
    role: 'Explaining an idea, practice questions, feedback on your own outline.',
    review: 'reviewed',
    note: 'Opens chatgpt.com with your question filled in. You press send there.',
    url: (p) => `https://chatgpt.com/?q=${encodeURIComponent(p)}`,
  },
  perplexity: {
    id: 'perplexity',
    name: 'Perplexity',
    role: 'Finding sources to read. Check each one yourself before you cite it.',
    review: 'reviewed',
    note: 'Its results are not library sources. Open the original before you cite anything it finds.',
    url: (p) => `https://www.perplexity.ai/search?q=${encodeURIComponent(p)}`,
  },
  grok: {
    id: 'grok',
    name: 'Grok',
    role: 'Not offered: your school has not reviewed it.',
    review: 'not-reviewed',
    note: 'Semester does not open services your school has not reviewed.',
    url: (p) => `https://grok.com/?q=${encodeURIComponent(p)}`,
  },
};

export const EXTERNAL_AI_ORDER: ExternalAiId[] = ['claude', 'chatgpt', 'perplexity', 'grok'];

export function offered(id: ExternalAiId): boolean {
  return EXTERNAL_AI[id].review === 'reviewed';
}

/**
 * What never goes, whatever is selected. Shown on every review, because
 * "only what you chose" is easier to believe beside a list of what you
 * could not have chosen.
 */
export const NEVER_SHARED = [
  'Your grades',
  'Your enrolment record',
  'Your name and email',
  'Your other courses',
  'Notes and files you did not paste here',
  'Your connected accounts',
] as const;

/** Words of pasted excerpt that go, at most. */
export const EXCERPT_WORDS = 200;

export interface HandoffInput {
  question: string;
  course?: { code: string; title: string };
  excerpt?: string;
}

export interface SharedPiece {
  label: 'Your question' | 'Course' | 'Excerpt you pasted';
  value: string;
}

export interface Prepared {
  /** In the order they appear in the prompt. */
  shared: SharedPiece[];
  prompt: string;
  /** True when the excerpt was cut to `EXCERPT_WORDS`. */
  cut: boolean;
}

function words(text: string): string[] {
  return text.trim().split(/\s+/).filter(Boolean);
}

/** The prompt, from the pieces. `prepare` and the test both go through this. */
export function compose(shared: SharedPiece[]): string {
  return shared
    .map((p) =>
      p.label === 'Your question'
        ? p.value
        : p.label === 'Course'
          ? `Course: ${p.value}`
          : `From my course notes:\n"""\n${p.value}\n"""`,
    )
    .join('\n\n');
}

export function prepare(input: HandoffInput): Prepared | null {
  const question = input.question.trim();
  if (!question) return null;
  const shared: SharedPiece[] = [{ label: 'Your question', value: question }];
  if (input.course) shared.push({ label: 'Course', value: `${input.course.code} — ${input.course.title}` });
  let cut = false;
  const pasted = words(input.excerpt ?? '');
  if (pasted.length > 0) {
    cut = pasted.length > EXCERPT_WORDS;
    shared.push({ label: 'Excerpt you pasted', value: pasted.slice(0, EXCERPT_WORDS).join(' ') });
  }
  return { shared, prompt: compose(shared), cut };
}

// ── What was sent, kept on this device ──────────────────────────────────────

const LOG_KEY = 'semester.handoffs.v1';
const LOG_MAX = 20;

export interface HandoffRecord {
  to: ExternalAiId;
  /** Epoch ms. */
  at: number;
  /** The labels of what went — not the text itself. */
  shared: SharedPiece['label'][];
  course?: string;
}

export function handoffs(): HandoffRecord[] {
  try {
    const raw = JSON.parse(localStorage.getItem(LOG_KEY) ?? '[]') as unknown;
    return Array.isArray(raw) ? (raw as HandoffRecord[]) : [];
  } catch {
    return [];
  }
}

export function record(to: ExternalAiId, prepared: Prepared, now: number = Date.now()): void {
  const course = prepared.shared.find((p) => p.label === 'Course')?.value.split(' — ')[0];
  const entry: HandoffRecord = { to, at: now, shared: prepared.shared.map((p) => p.label), ...(course ? { course } : {}) };
  try {
    localStorage.setItem(LOG_KEY, JSON.stringify([entry, ...handoffs()].slice(0, LOG_MAX)));
  } catch {
    // Storage full or blocked: the handoff still happened, the log just misses it.
  }
}

export function clearHandoffs(): void {
  try {
    localStorage.removeItem(LOG_KEY);
  } catch {
    // Nothing to do.
  }
}

/**
 * Open the service and log it. A service the school has not reviewed is
 * refused here as well as hidden on screen, so a caller that forgets to
 * check cannot open it.
 *
 * `window.open` with `noopener` returns null even when the tab opened, so
 * its result says nothing and is not read.
 */
export function send(
  id: ExternalAiId,
  prepared: Prepared,
  open: (url: string, target: string, features: string) => unknown = (u, t, f) => window.open(u, t, f),
): boolean {
  if (!offered(id)) return false;
  open(EXTERNAL_AI[id].url(prepared.prompt), '_blank', 'noopener,noreferrer');
  record(id, prepared);
  return true;
}
