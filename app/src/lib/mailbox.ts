/**
 * The mailbox — the part of email that is not writing the email.
 *
 * `mail.ts` next door is about the draft: the address, the register, the
 * opening line. This is everything around it, and it is the shape every
 * student already has in front of them at nine in the morning: a rail of
 * folders, a list of rows you can scan in two seconds each, and the message
 * itself beside it. Gmail and Outlook agree about that shape to within a few
 * pixels, and a mailbox that invented its own would be a mailbox nobody could
 * use without reading instructions.
 *
 * So the layout is theirs, and so is the vocabulary — inbox, starred, archive,
 * spam, trash, labels, categories, conversations, `from:` in the search box.
 * Everything here is the machinery under that: what a message is, which folder
 * it is in, what a search means, how a date is written, how a reply is built.
 * All of it is pure, so it can be tested without a network, a provider or a
 * browser.
 *
 * ## One honest limit, stated everywhere it matters
 *
 * The app has your mail **read-only**, on purpose — the scopes in
 * `lib/connect.ts` are `gmail.readonly` and `Mail.Read`, and a study app that
 * could delete a professor's email or send one as you is a bigger promise than
 * this one makes.
 *
 * That does not mean the mailbox is a viewer. Reading, starring, archiving,
 * snoozing, labelling and deleting all work here — they are kept as *your*
 * marks over the provider's copy, in `Marks` below, and every list and count
 * in the app reads the message through them. What they do not do is reach back
 * into Gmail. So a message you archive here leaves your inbox here and stays
 * in the one on the web, and every row and reader carries a link to the real
 * message for when that is what you want. The screen says so in one sentence
 * rather than letting somebody find out.
 *
 * The drafts are the other way round: those are the app's own, they live in
 * the store, and Drafts and Sent are folders of real things you wrote.
 */

import type { CourseId } from './types';

/**
 * The eight folders, which are the same eight in both clients.
 *
 * Gmail calls the archive "All Mail" and Outlook calls the spam folder "Junk
 * Email"; those are the only two names that differ and neither is worth a
 * setting. `starred` and `snoozed` are views rather than places — a starred
 * message is still in the inbox — which is exactly how both clients treat
 * them, and why `folderOf` below reads marks rather than a field.
 */
export type FolderId =
  | 'inbox'
  | 'starred'
  | 'snoozed'
  | 'drafts'
  | 'sent'
  | 'archive'
  | 'spam'
  | 'trash';

export interface Folder {
  id: FolderId;
  label: string;
  /** What it is, for the rail's title attribute and the empty state. */
  blurb: string;
  /** True when the folder is a view over marks rather than a place. */
  view: boolean;
}

export const FOLDERS: Folder[] = [
  { id: 'inbox', label: 'Inbox', blurb: 'Everything that has arrived and not been dealt with.', view: false },
  { id: 'starred', label: 'Starred', blurb: 'The ones you marked to come back to.', view: true },
  { id: 'snoozed', label: 'Snoozed', blurb: 'Put off until a day you chose.', view: true },
  { id: 'drafts', label: 'Drafts', blurb: 'Written here and not sent yet.', view: false },
  { id: 'sent', label: 'Sent', blurb: 'Handed to your mail app, and what your account has sent.', view: false },
  { id: 'archive', label: 'Archive', blurb: 'Dealt with and kept.', view: false },
  { id: 'spam', label: 'Spam', blurb: 'What your provider thinks is junk.', view: false },
  { id: 'trash', label: 'Trash', blurb: 'Deleted here. Nothing is deleted from your account.', view: false },
];

export function folder(id: string): Folder {
  return FOLDERS.find((f) => f.id === id) ?? FOLDERS[0];
}

/** A name and an address, kept apart because a row shows one and a draft the other. */
export interface Address {
  name: string;
  address: string;
}

/**
 * One message, from a provider or from this app.
 *
 * `folder` is where the provider filed it and never changes; where *you* have
 * since put it is a mark. Reading a message through `marked()` below collapses
 * the two, and everything on the screen reads the collapsed one.
 */
export interface Mail {
  id: string;
  /** Which account it came from, or `local` for a draft written here. */
  source: 'google' | 'microsoft' | 'local';
  /** The conversation it belongs to. Its own id when the provider gives none. */
  threadId: string;
  from: Address;
  to: Address[];
  cc: Address[];
  subject: string;
  /** The first line or two, as the provider wrote it. */
  snippet: string;
  /** The message, as plain text. */
  body: string;
  /** Epoch ms. */
  at: number;
  unread: boolean;
  starred: boolean;
  folder: FolderId;
  /** Gmail labels and Outlook categories, minus the ones that are folders. */
  labels: string[];
  attachments: number;
  /** The message in the provider's own web client. */
  link: string;
  /** Which of your courses it is about, when it names one. */
  courseId: CourseId | null;
  /** Set when this is one of the app's own drafts, so it can be reopened. */
  draftId?: string;
}

/**
 * What you have done to a message that the provider does not know about.
 *
 * Small on purpose: this is persisted per message id for as long as the
 * mailbox remembers the message, and a mark that carried a copy of the body
 * would be a second inbox stored on the device. Absent fields mean "whatever
 * the message says".
 */
export interface Mark {
  read?: boolean;
  star?: boolean;
  /** Where you moved it: archive, trash, spam, inbox. */
  folder?: FolderId;
  /** Your own labels, added here. Provider labels stay on the message. */
  labels?: string[];
  /** Epoch ms it comes back. Until then it is in Snoozed and out of the inbox. */
  snooze?: number;
}

export type Marks = Record<string, Mark>;

/** The message as you have it — the provider's copy with your marks over it. */
export function marked(mail: Mail, marks: Marks): Mail {
  const m = marks[mail.id];
  if (!m) return mail;
  return {
    ...mail,
    unread: m.read === undefined ? mail.unread : !m.read,
    starred: m.star === undefined ? mail.starred : m.star,
    folder: m.folder ?? mail.folder,
    labels: m.labels ? [...mail.labels, ...m.labels.filter((l) => !mail.labels.includes(l))] : mail.labels,
  };
}

/** Every message with its marks applied, which is what every view reads. */
export function withMarks(mails: Mail[], marks: Marks): Mail[] {
  return mails.map((m) => marked(m, marks));
}

/**
 * Whether a snooze is still holding.
 *
 * A snooze that has run out is not a state to clean up on a timer — it is
 * simply a comparison against the clock, made wherever the message is read.
 * Nothing has to run for a message to come back.
 */
export function asleep(mark: Mark | undefined, now: number): boolean {
  return Boolean(mark?.snooze && mark.snooze > now);
}

/**
 * Which folder a message is in right now, for a person rather than a provider.
 *
 * The order is the order the clients use, and it matters: a starred message in
 * the trash is in the trash, and a snoozed one is snoozed even if it is
 * starred. Only after those does the inbox get it.
 */
export function inFolder(mail: Mail, id: FolderId, marks: Marks, now: number): boolean {
  const mark = marks[mail.id];
  const at = mark?.folder ?? mail.folder;
  if (id === 'starred') return marked(mail, marks).starred && at !== 'trash' && at !== 'spam';
  if (id === 'snoozed') return asleep(mark, now) && at !== 'trash';
  if (id === 'inbox') return at === 'inbox' && !asleep(mark, now);
  return at === id;
}

/**
 * Gmail's tabs, which are the one piece of its inbox that is genuinely useful
 * here rather than merely familiar.
 *
 * A student's inbox is nine tenths university announcements, shop receipts and
 * "your payment was declined". The tabs are what keeps the professor's reply
 * from being the fourth thing on the screen. Gmail's own answer comes back in
 * the labels, so where there is one it is used; the heuristics are for Outlook,
 * which categorises nothing.
 */
export type Category = 'primary' | 'social' | 'promotions' | 'updates';

export const CATEGORIES: { id: Category; label: string }[] = [
  { id: 'primary', label: 'Primary' },
  { id: 'social', label: 'Social' },
  { id: 'promotions', label: 'Promotions' },
  { id: 'updates', label: 'Updates' },
];

const SOCIAL = /facebook|instagram|twitter|x\.com|linkedin|tiktok|snapchat|discord|reddit|pinterest|youtube/i;
const ROBOT = /^(no-?reply|do-?not-?reply|notifications?|alerts?|mailer|bounce|support|billing|receipts?|info)@/i;

export function categoryOf(mail: Mail): Category {
  for (const label of mail.labels) {
    if (label === 'CATEGORY_PROMOTIONS') return 'promotions';
    if (label === 'CATEGORY_SOCIAL') return 'social';
    if (label === 'CATEGORY_UPDATES' || label === 'CATEGORY_FORUMS') return 'updates';
    if (label === 'CATEGORY_PERSONAL') return 'primary';
  }
  // A message that names one of your courses is never a promotion, whatever it
  // looks like — the whole reason the mailbox is in this app is that those are
  // the ones worth finding.
  if (mail.courseId) return 'primary';
  const address = mail.from.address.toLowerCase();
  if (SOCIAL.test(address)) return 'social';
  if (/unsubscribe|% off|sale ends|limited time|deal/i.test(`${mail.subject} ${mail.snippet}`))
    return 'promotions';
  if (ROBOT.test(address)) return 'updates';
  return 'primary';
}

// ── Addresses ─────────────────────────────────────────────────────────────

/** `Jake from GPTZero <jake@gptzero.me>` → the two halves of it. */
export function parseAddress(raw: string): Address {
  const text = raw.trim();
  const angled = /^(.*?)<([^>]+)>$/.exec(text);
  if (angled) {
    const name = angled[1].trim().replace(/^"(.*)"$/, '$1').trim();
    const address = angled[2].trim();
    return { name: name || address, address };
  }
  return { name: text, address: text };
}

/** A header's worth of addresses, comma separated, quoted names respected. */
export function parseAddresses(raw: string): Address[] {
  const out: Address[] = [];
  let at = 0;
  let quoted = false;
  let angle = false;
  for (let i = 0; i < raw.length; i += 1) {
    const ch = raw[i];
    if (ch === '"') quoted = !quoted;
    else if (ch === '<') angle = true;
    else if (ch === '>') angle = false;
    else if (ch === ',' && !quoted && !angle) {
      const piece = raw.slice(at, i).trim();
      if (piece) out.push(parseAddress(piece));
      at = i + 1;
    }
  }
  const last = raw.slice(at).trim();
  if (last) out.push(parseAddress(last));
  return out;
}

/** What the row shows: the name when there is one, else the address. */
export function shown(who: Address): string {
  return who.name || who.address;
}

/** The two letters in the round avatar, the way both clients draw it. */
export function initials(who: Address): string {
  // An address is one word with punctuation in it, not two names: splitting
  // `r@v.edu` on the dots and the @ produced "RE", which reads as somebody's
  // initials and is nobody's.
  const bare = shown(who).trim();
  if (!who.name || who.name === who.address || /@/.test(bare)) {
    const letter = /\p{L}|\p{N}/u.exec(bare);
    return letter ? letter[0].toUpperCase() : '?';
  }
  const name = bare.replace(/[^\p{L}\p{N} ]/gu, ' ').trim();
  if (!name) return '?';
  const parts = name.split(/\s+/).filter(Boolean);
  if (parts.length === 1) return parts[0].slice(0, 1).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

/** A list of people, shortened the way a conversation row shortens it. */
export function participants(mails: Mail[], limit = 3): string {
  const seen: string[] = [];
  for (const m of mails) {
    const name = shown(m.from).split(/[ ,]/)[0];
    if (name && !seen.includes(name)) seen.push(name);
  }
  if (seen.length <= limit) return seen.join(', ');
  return `${seen.slice(0, limit).join(', ')} +${seen.length - limit}`;
}

// ── Search ────────────────────────────────────────────────────────────────

/**
 * The search box, with the operators both clients take.
 *
 * `from:stromme is:unread` is not a power feature in a mailbox — it is how
 * anybody finds the message about the problem set among four hundred. The set
 * is deliberately the small one that both Gmail and Outlook share, so what a
 * student already types works: `from:`, `to:`, `subject:`, `label:`, `has:`,
 * `is:`, `in:`, quoted phrases, and everything else as free text.
 */
export interface Query {
  text: string[];
  from: string[];
  to: string[];
  subject: string[];
  label: string[];
  has: string[];
  is: string[];
  in: string[];
}

const EMPTY: Query = { text: [], from: [], to: [], subject: [], label: [], has: [], is: [], in: [] };

export function parseQuery(raw: string): Query {
  const q: Query = { text: [], from: [], to: [], subject: [], label: [], has: [], is: [], in: [] };
  // Quoted phrases first, so `subject:"problem set"` stays one term.
  const tokens = raw.match(/(?:[a-z]+:)?"[^"]*"|\S+/gi) ?? [];
  for (const token of tokens) {
    const op = /^([a-z]+):(.*)$/i.exec(token);
    const value = (op ? op[2] : token).replace(/^"(.*)"$/, '$1').trim().toLowerCase();
    if (!value) continue;
    const name = op ? op[1].toLowerCase() : '';
    if (name === 'from') q.from.push(value);
    else if (name === 'to') q.to.push(value);
    else if (name === 'subject') q.subject.push(value);
    else if (name === 'label') q.label.push(value);
    else if (name === 'has') q.has.push(value);
    else if (name === 'is') q.is.push(value);
    else if (name === 'in') q.in.push(value);
    else q.text.push(value);
  }
  return q;
}

export function isEmptyQuery(q: Query): boolean {
  return Object.keys(EMPTY).every((k) => q[k as keyof Query].length === 0);
}

const hit = (hay: string, needle: string) => hay.toLowerCase().includes(needle);

export function matches(mail: Mail, q: Query): boolean {
  const who = (list: Address[]) => list.map((a) => `${a.name} ${a.address}`).join(' ');
  if (!q.from.every((v) => hit(who([mail.from]), v))) return false;
  if (!q.to.every((v) => hit(who([...mail.to, ...mail.cc]), v))) return false;
  if (!q.subject.every((v) => hit(mail.subject, v))) return false;
  if (!q.label.every((v) => mail.labels.some((l) => hit(l, v)))) return false;
  if (!q.has.every((v) => (v === 'attachment' ? mail.attachments > 0 : hit(mail.body, v)))) return false;
  if (!q.in.every((v) => mail.folder === v)) return false;
  for (const flag of q.is) {
    if (flag === 'unread' && !mail.unread) return false;
    if (flag === 'read' && mail.unread) return false;
    if ((flag === 'starred' || flag === 'flagged') && !mail.starred) return false;
    if (flag === 'unstarred' && mail.starred) return false;
  }
  const all = `${shown(mail.from)} ${mail.from.address} ${mail.subject} ${mail.snippet} ${mail.body}`;
  return q.text.every((v) => hit(all, v));
}

/**
 * A folder, a tab and a search box, resolved in that order.
 *
 * Searching leaves the folder behind, which is what both clients do and what
 * anybody typing a professor's name into the box means: the message you are
 * looking for is as likely to be in the archive as in the inbox. Trash and
 * spam stay out of it unless you are standing in them, for the same reason
 * they do there — a deleted draft of the same email is not the one you want.
 */
export function listing(
  mails: Mail[],
  opts: { folder: FolderId; category?: Category | null; query?: string; marks?: Marks; now?: number },
): Mail[] {
  const marks = opts.marks ?? {};
  const now = opts.now ?? Date.now();
  const q = parseQuery(opts.query ?? '');
  const searching = !isEmptyQuery(q);
  const seen = withMarks(mails, marks);

  const kept = seen.filter((mail) => {
    if (searching) {
      const here = marks[mail.id]?.folder ?? mail.folder;
      const standing = opts.folder === 'trash' || opts.folder === 'spam';
      if (!standing && (here === 'trash' || here === 'spam')) return false;
      if (standing && here !== opts.folder) return false;
      return matches(mail, q);
    }
    if (!inFolder(mail, opts.folder, marks, now)) return false;
    if (opts.category && opts.folder === 'inbox' && categoryOf(mail) !== opts.category) return false;
    return true;
  });

  return kept.sort((a, b) => b.at - a.at);
}

/** How many unread are in a folder, for the count beside its name. */
export function unread(mails: Mail[], id: FolderId, marks: Marks, now: number): number {
  return listing(mails, { folder: id, marks, now }).filter((m) => m.unread).length;
}

// ── Conversations ─────────────────────────────────────────────────────────

export interface Thread {
  id: string;
  /** Oldest first, the way a thread is read. */
  mails: Mail[];
  /** The most recent message, which is what the row shows. */
  last: Mail;
  subject: string;
  unread: boolean;
  starred: boolean;
  attachments: number;
  at: number;
}

/**
 * Messages gathered into conversations.
 *
 * Both providers hand back a thread id, so this is a grouping rather than the
 * guesswork that subject-matching would be — "Re: Re: Fwd: syllabus" from two
 * different people is two conversations, and only the provider knows that.
 */
export function conversations(mails: Mail[]): Thread[] {
  const by = new Map<string, Mail[]>();
  for (const mail of mails) {
    const list = by.get(mail.threadId);
    if (list) list.push(mail);
    else by.set(mail.threadId, [mail]);
  }
  const out: Thread[] = [];
  for (const [id, list] of by) {
    const ordered = [...list].sort((a, b) => a.at - b.at);
    const last = ordered[ordered.length - 1];
    out.push({
      id,
      mails: ordered,
      last,
      subject: ordered[0].subject,
      unread: ordered.some((m) => m.unread),
      starred: ordered.some((m) => m.starred),
      attachments: ordered.reduce((n, m) => n + m.attachments, 0),
      at: last.at,
    });
  }
  return out.sort((a, b) => b.at - a.at);
}

// ── Dates ─────────────────────────────────────────────────────────────────

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function sameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate()
  );
}

/** `9:01 AM`, written out rather than left to a locale the suite cannot pin. */
export function clockTime(d: Date): string {
  const h = d.getHours();
  const hour = h % 12 === 0 ? 12 : h % 12;
  return `${hour}:${String(d.getMinutes()).padStart(2, '0')} ${h < 12 ? 'AM' : 'PM'}`;
}

/**
 * The right-hand column of a row: the time today, the date this year, the
 * year before that. Both clients do exactly this, and it is the reason a
 * mailbox can be scanned — a column of full dates is a column nobody reads.
 */
export function stamp(at: number, now: Date): string {
  const d = new Date(at);
  if (sameDay(d, now)) return clockTime(d);
  if (d.getFullYear() === now.getFullYear()) return `${MONTHS[d.getMonth()]} ${d.getDate()}`;
  return `${d.getMonth() + 1}/${d.getDate()}/${String(d.getFullYear()).slice(2)}`;
}

/** The reader's line: `Thu, Sep 10, 2026, 9:01 AM`. */
export function fullStamp(at: number): string {
  const d = new Date(at);
  return `${DAYS[d.getDay()]}, ${MONTHS[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}, ${clockTime(d)}`;
}

/**
 * Outlook's date headings, which Gmail does not draw and should.
 *
 * A list broken into Today / Yesterday / This week is a list you can tell the
 * shape of at a glance — how much arrived since you last looked — where an
 * unbroken run of five hundred rows is a wall.
 */
export function bucket(at: number, now: Date): string {
  const d = new Date(at);
  if (sameDay(d, now)) return 'Today';
  const yesterday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1);
  if (sameDay(d, yesterday)) return 'Yesterday';
  const week = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 7);
  if (d >= week) return 'This week';
  const month = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 30);
  if (d >= month) return 'This month';
  if (d.getFullYear() === now.getFullYear()) return 'Earlier this year';
  return 'Older';
}

/** The list, cut into the headed runs the screen draws. */
export function buckets(mails: Mail[], now: Date): { label: string; mails: Mail[] }[] {
  const out: { label: string; mails: Mail[] }[] = [];
  for (const mail of mails) {
    const label = bucket(mail.at, now);
    const last = out[out.length - 1];
    if (last && last.label === label) last.mails.push(mail);
    else out.push({ label, mails: [mail] });
  }
  return out;
}

/**
 * The snooze menu, in the four shapes anybody actually picks.
 *
 * Times rather than durations: "tomorrow morning" means eight o'clock, not
 * twenty-four hours from now, and a message that came back at 11:41pm because
 * that is when you snoozed it is a message you will miss.
 */
export function snoozeOptions(now: Date): { label: string; at: number }[] {
  const at = (days: number, hour: number) =>
    new Date(now.getFullYear(), now.getMonth(), now.getDate() + days, hour, 0, 0, 0).getTime();
  const laterToday = new Date(now.getTime() + 3 * 3600 * 1000).getTime();
  const monday = (8 - now.getDay()) % 7 || 7;
  return [
    { label: 'Later today', at: laterToday },
    { label: 'Tomorrow, 8am', at: at(1, 8) },
    { label: 'Monday, 8am', at: at(monday, 8) },
    { label: 'Next week', at: at(7, 8) },
  ];
}

// ── Paging ────────────────────────────────────────────────────────────────

/** `1–50 of 566`, in the corner where both clients put it. */
export function pageLabel(total: number, at: number, per: number): string {
  if (total === 0) return '0';
  const first = at * per + 1;
  const last = Math.min(total, (at + 1) * per);
  return `${first}–${last} of ${total}`;
}

export function pages(total: number, per: number): number {
  return Math.max(1, Math.ceil(total / per));
}

// ── Replying ──────────────────────────────────────────────────────────────

/** `Re:` once, however many times it has been round. */
export function reSubject(subject: string, prefix: 'Re:' | 'Fwd:'): string {
  const bare = subject.replace(/^((re|fwd|fw)\s*:\s*)+/i, '').trim();
  return `${prefix} ${bare || '(no subject)'}`;
}

/** The quoted original, in the form every client has agreed on since 1995. */
export function quoted(mail: Mail): string {
  const head = `On ${fullStamp(mail.at)}, ${shown(mail.from)} <${mail.from.address}> wrote:`;
  const body = (mail.body || mail.snippet)
    .split('\n')
    .map((line) => `> ${line}`)
    .join('\n');
  return `${head}\n\n${body}`;
}

/**
 * The new part of a message, and the thread hanging off the bottom of it.
 *
 * Every reply carries the whole conversation under it, and by the fourth round
 * that is nine screens of text below two lines of new writing. Clients fold it
 * behind a small control; this finds the fold. The marker is either a run of
 * quoted lines or the attribution line above them, and the split is only taken
 * when there is something above it — a forwarded message is all quote, and
 * hiding the whole of it would leave a blank reader.
 */
export function splitQuote(body: string): { said: string; quote: string } {
  const lines = body.split('\n');
  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i].trim();
    const attribution = /^on .+ wrote:$/i.test(line) || /^-{2,} ?(original|forwarded) message/i.test(line);
    const quoted = line.startsWith('>');
    if (!attribution && !quoted) continue;
    const said = lines.slice(0, i).join('\n').trim();
    if (!said) return { said: body.trim(), quote: '' };
    return { said, quote: lines.slice(i).join('\n').trim() };
  }
  return { said: body.trim(), quote: '' };
}

export interface Prefill {
  to: string;
  cc: string;
  subject: string;
  body: string;
}

/**
 * Reply, reply-all and forward, filled in from the message.
 *
 * `me` is dropped from the recipients of a reply-all, which is the one piece
 * of this that clients get wrong often enough to be worth naming: a reply-all
 * that cc's you is a copy of your own email in your own inbox.
 */
export function prefill(mail: Mail, mode: 'reply' | 'replyAll' | 'forward', me = ''): Prefill {
  const mine = me.trim().toLowerCase();
  const not = (a: Address) => a.address.toLowerCase() !== mine;
  if (mode === 'forward') {
    return {
      to: '',
      cc: '',
      subject: reSubject(mail.subject, 'Fwd:'),
      body: `\n\n---------- Forwarded message ----------\n${quoted(mail)}`,
    };
  }
  const to = [mail.from].filter(not);
  const cc = mode === 'replyAll' ? [...mail.to, ...mail.cc].filter(not).filter((a) => a.address !== mail.from.address) : [];
  return {
    to: to.map((a) => a.address).join(', '),
    cc: cc.map((a) => a.address).join(', '),
    subject: reSubject(mail.subject, 'Re:'),
    body: `\n\n${quoted(mail)}`,
  };
}

// ── The app's own drafts, as mail ─────────────────────────────────────────

/**
 * A draft written on this screen.
 *
 * Persisted, because the commonest thing that happens to a student email is
 * that it gets half written and abandoned, and the second commonest is that
 * the tab is closed. `sent` is not a claim that the app sent anything — it is
 * the moment you pressed *Open in Gmail* and the draft was handed over, which
 * is the last thing this app can honestly know about it.
 */
export interface MailDraft {
  id: string;
  to: string;
  cc: string;
  bcc: string;
  subject: string;
  body: string;
  courseId: CourseId | '';
  /** Which of `mail.ts`'s purposes it was started from, for reopening it. */
  purposeId: string;
  /** Epoch ms. */
  updated: number;
  /** Epoch ms it was handed to a mail app, or null while it is a draft. */
  handed: number | null;
}

/** A draft, as a row in the list — so Drafts and Sent are ordinary folders. */
export function draftAsMail(draft: MailDraft, me: Address): Mail {
  const to = parseAddresses(draft.to);
  return {
    id: `draft:${draft.id}`,
    source: 'local',
    threadId: `draft:${draft.id}`,
    from: me,
    to,
    cc: parseAddresses(draft.cc),
    subject: draft.subject || '(no subject)',
    snippet: draft.body.slice(0, 240).replace(/\s+/g, ' ').trim(),
    body: draft.body,
    at: draft.handed ?? draft.updated,
    unread: false,
    starred: false,
    folder: draft.handed ? 'sent' : 'drafts',
    labels: [],
    attachments: 0,
    link: '',
    courseId: draft.courseId || null,
    draftId: draft.id,
  };
}

/** A blank one. `id` and `updated` come from the reducer, which owns the clock. */
export function emptyDraft(): Omit<MailDraft, 'id' | 'updated'> {
  return { to: '', cc: '', bcc: '', subject: '', body: '', courseId: '', purposeId: 'question', handed: null };
}
