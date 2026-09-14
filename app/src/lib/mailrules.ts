/**
 * Rules: a search you keep, and what it does to what it finds.
 *
 * The search box in this mailbox speaks most of Gmail's language — `from:`,
 * `subject:`, `label:`, `has:attachment`, `is:unread`, `in:`, `before:`,
 * `after:`, `course:`, and a leading minus for any of them. What it could not
 * do was remember. Every Monday the same four sentences got typed to find the
 * same four things, and the newsletter that is never read had to be archived
 * by hand a hundred and forty times a term. Both clients answered this the
 * same way twenty years ago: the filter is the search, saved, with actions on
 * it.
 *
 * So a rule is exactly the string somebody already typed into the box, and
 * that is the point of the design rather than a shortcut in it. There is no
 * second condition language to learn, no builder with its own idea of what
 * "from" means, and nothing that can drift from the search: a rule finds what
 * the box would have found, because it calls the same `parseQuery` and the
 * same `matches`.
 *
 * ## Why a rule cannot fight you
 *
 * Gmail runs a filter once, on arrival, and the difference matters here. This
 * app holds your mail read-only and fetches it per session — there is no
 * moment of delivery it owns, so "run once when it lands" has nothing to hang
 * on. Running them on every read instead has an obvious failure: un-star a
 * message a rule stars and the rule stars it again before the frame is drawn,
 * and the app is arguing with the person using it.
 *
 * The fix is layering rather than bookkeeping. `Marks` is already the record
 * of what *you* did to a message, so rule effects go **underneath** it, field
 * by field: a rule says "starred" and your mark saying "not starred" wins,
 * because unstarring writes an explicit `star: false` (see `onStar` in
 * `screens/Mail.tsx`). Nothing has to be remembered about which rules have
 * run on which messages — a store that would grow for as long as the mailbox
 * did — and the rule still applies to every message you have not had an
 * opinion about, which is all of them until you do.
 *
 * That also makes a rule reversible in the way people expect: turn it off and
 * what it was doing stops, everywhere, at once, because none of it was ever
 * written down as yours.
 */

import { matches, parseQuery, type Mail, type Mark, type Marks } from './mailbox';

/** What a rule may do. The subset of Gmail's list this mailbox can honour. */
export interface Rule {
  id: string;
  /** What to call it in the list. Empty falls back to the search itself. */
  name: string;
  /** The search that selects the messages, in the box's own language. */
  when: string;
  /** Star it. */
  star?: boolean;
  /** Mark it read — Gmail's "Mark as read". */
  read?: boolean;
  /** Skip the inbox, or bin it. Gmail's "Skip the Inbox" and "Delete it". */
  folder?: 'archive' | 'trash';
  /** A label to hang on it. */
  label?: string;
  /** Kept but not running. */
  off?: boolean;
  created: number;
}

/**
 * Whether a rule would do anything at all.
 *
 * A rule with a search and no actions is a saved search, which is a thing
 * worth having and not a thing this does — it would match every message and
 * change none of them, and then sit in the list looking broken. The form
 * refuses to save one and this is the predicate it asks.
 */
export function doesSomething(rule: Rule): boolean {
  return Boolean(rule.star || rule.read || rule.folder || rule.label?.trim());
}

/** The mark one rule lays on anything it matches. */
function markOf(rule: Rule): Mark {
  const mark: Mark = {};
  if (rule.star) mark.star = true;
  if (rule.read) mark.read = true;
  if (rule.folder) mark.folder = rule.folder;
  if (rule.label?.trim()) mark.labels = [rule.label.trim()];
  return mark;
}

/**
 * Every message a rule would catch, by id.
 *
 * Exported because the form needs it before the rule exists: "this matches 23
 * of the messages you have" is the difference between saving a rule and
 * finding out next week that `from:bio` also caught the biology professor.
 * Both clients show the count and it is the only part of a filter anybody
 * checks.
 */
export function caught(mails: Mail[], rule: Rule): string[] {
  const q = parseQuery(rule.when);
  // An empty search matches everything, which as a rule means "archive the
  // entire mailbox". Deliberately nothing: a rule has to say what it is for.
  if (!rule.when.trim()) return [];
  return mails.filter((m) => matches(m, q)).map((m) => m.id);
}

/**
 * The overlay every running rule produces over a set of messages.
 *
 * Later rules win where two touch the same field, which is the order the list
 * is in and the order both clients use — a filter further down the page is a
 * refinement of the ones above it. Labels are the exception and accumulate,
 * because two rules labelling one message is two true things about it rather
 * than a disagreement.
 */
export function ruleMarks(mails: Mail[], rules: Rule[]): Marks {
  const out: Marks = {};
  for (const rule of rules) {
    if (rule.off || !doesSomething(rule)) continue;
    const mark = markOf(rule);
    for (const id of caught(mails, rule)) {
      const had = out[id];
      out[id] = {
        ...had,
        ...mark,
        ...(mark.labels || had?.labels
          ? { labels: [...new Set([...(had?.labels ?? []), ...(mark.labels ?? [])])] }
          : {}),
      };
    }
  }
  return out;
}

/**
 * The rules' overlay with yours on top of it, field by field.
 *
 * The whole of the "a rule cannot fight you" argument, in one merge. Your
 * mark is spread second, so any field you have an opinion about is yours —
 * including the ones where your opinion is `false`, which is why unstarring
 * sticks. Labels are the exception again and union, because a label a rule
 * applied and a label you applied are both on the message.
 */
export function under(rules: Marks, yours: Marks): Marks {
  const out: Marks = { ...rules };
  for (const [id, mine] of Object.entries(yours)) {
    const below = out[id];
    if (!below) {
      out[id] = mine;
      continue;
    }
    out[id] = {
      ...below,
      ...mine,
      ...(below.labels || mine.labels
        ? { labels: [...new Set([...(below.labels ?? []), ...(mine.labels ?? [])])] }
        : {}),
    };
  }
  return out;
}

/** What a rule does, as a sentence — for the list and for the form's preview. */
export function describeRule(rule: Rule): string {
  const does: string[] = [];
  if (rule.folder === 'archive') does.push('skip the inbox');
  if (rule.folder === 'trash') does.push('go to the bin');
  if (rule.read) does.push('be marked read');
  if (rule.star) does.push('be starred');
  if (rule.label?.trim()) does.push(`be labelled ${rule.label.trim()}`);
  if (does.length === 0) return `Matching ${rule.when} — and doing nothing.`;
  const said =
    does.length === 1 ? does[0] : `${does.slice(0, -1).join(', ')} and ${does[does.length - 1]}`;
  return `Mail matching ${rule.when} will ${said}.`;
}

/** A new rule seeded from whatever is in the search box. */
export function ruleFrom(search: string, id: string, now: number): Rule {
  return { id, name: '', when: search.trim(), created: now };
}

/** What to call a rule in a list: its name, or the search it is. */
export function ruleName(rule: Rule): string {
  return rule.name.trim() || rule.when.trim() || 'Untitled rule';
}
