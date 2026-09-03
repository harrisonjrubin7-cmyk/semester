/**
 * Writing the email you have been putting off.
 *
 * Almost every email a student owes is one of about nine things, and the
 * reason they sit unsent for three days is not that they are hard to write —
 * it is the address, the register, and the opening line. So this does those
 * three parts and leaves the rest to you.
 *
 * Two limits, both deliberate.
 *
 * The app does not send. Mail is connected read-only, on purpose: something
 * that can post a message as you to your professor is a bigger promise than a
 * study app should make, and the failure mode is unrecoverable. The draft
 * opens in your own mail client, where you read it and press send yourself.
 *
 * And the draft does not invent facts about your life. An extension request
 * without a reason gets a marked blank, not a plausible illness — the model is
 * told plainly that making one up would put a lie in your name in a
 * professor's inbox, which is both a fabrication and, at a university with an
 * honour code, a much worse problem than a late paper. Everything factual in
 * the draft comes from your syllabus or from the lines you typed.
 */

import type { Course, DatedItem } from './types';

export interface Purpose {
  id: string;
  label: string;
  /** What this email is for, in the second person. */
  blurb: string;
  /** Told to the model as the job. */
  brief: string;
  /** What you have to supply, because the app cannot know it. */
  asks: string;
  /** True when a draft without your input would have to invent something. */
  needsFacts: boolean;
}

export const PURPOSES: Purpose[] = [
  {
    id: 'extension',
    label: 'Ask for an extension',
    blurb: 'You need more time, and the ask lands better if it names a date.',
    brief:
      'Ask for an extension on a specific deadline. Name the new date the student is proposing. ' +
      'Acknowledge that the answer may be no, and say what they will do either way.',
    asks: 'Why, and what new date you are proposing.',
    needsFacts: true,
  },
  {
    id: 'question',
    label: 'Ask about an assignment',
    blurb: 'A specific question about what is expected, asked so it can be answered fast.',
    brief:
      'Ask a specific question about an assignment. State what the student has already read or ' +
      'tried, so the professor does not answer something already covered in the syllabus.',
    asks: 'The question, and what you already checked.',
    needsFacts: true,
  },
  {
    id: 'meeting',
    label: 'Ask for a meeting',
    blurb: 'Office hours clash, or you need longer than office hours give.',
    brief:
      'Request a short meeting or office-hours slot. Offer specific windows rather than asking ' +
      'the professor to propose times. Say how long is needed and what it is about.',
    asks: 'What it is about, and two or three times you can make.',
    needsFacts: true,
  },
  {
    id: 'absence',
    label: 'Explain an absence',
    blurb: 'You missed a class, or you are about to.',
    brief:
      'Explain an absence, briefly and without over-explaining. Ask what was covered and how to ' +
      'catch up. Do not apologise more than once.',
    asks: 'Which class, and as much of the reason as you want to give.',
    needsFacts: true,
  },
  {
    id: 'grade',
    label: 'Ask about a grade',
    blurb: 'You want to understand a mark — not argue it in the first email.',
    brief:
      'Ask to understand a grade. The tone is curiosity, not challenge: the student is asking ' +
      'what they missed and how to do better, and requesting a conversation rather than ' +
      'relitigating the mark in writing. Never assert the grade was wrong.',
    asks: 'Which piece of work, and what you do not understand about the feedback.',
    needsFacts: true,
  },
  {
    id: 'recommendation',
    label: 'Ask for a recommendation',
    blurb: 'A letter, with enough notice and enough material to write from.',
    brief:
      'Ask for a letter of recommendation. Say what it is for and the deadline, remind them ' +
      'specifically where they know the student from, and offer to send a CV and a summary. ' +
      'Give them an easy way to say no.',
    asks: 'What the letter is for, the deadline, and what you did in their class.',
    needsFacts: true,
  },
  {
    id: 'followup',
    label: 'Follow up on silence',
    blurb: 'You wrote a week ago and heard nothing.',
    brief:
      'Follow up on an unanswered email. One short paragraph. Assume it was missed rather than ' +
      'ignored, restate the ask in one sentence, and make replying take ten seconds.',
    asks: 'When you wrote, and what you asked.',
    needsFacts: true,
  },
  {
    id: 'reply',
    label: 'Reply to a message',
    blurb: 'Something came in and needs an answer.',
    brief:
      'Write a reply to the message provided. Answer what was actually asked, in the order it ' +
      'was asked. Match the length of the incoming message — a two-line email gets a two-line ' +
      'reply.',
    asks: 'The message you are replying to, and what you want to say back.',
    needsFacts: true,
  },
  {
    id: 'thanks',
    label: 'Say thank you',
    blurb: 'Short, specific, and not creepy.',
    brief:
      'Write a brief thank-you. Name the specific thing. Three sentences at most, and no ' +
      'request attached — this email asks for nothing.',
    asks: 'What they did.',
    needsFacts: false,
  },
];

export function purpose(id: string): Purpose {
  return PURPOSES.find((p) => p.id === id) ?? PURPOSES[0];
}

/**
 * "Dear Professor Trounstine," from "Prof. Jessica Trounstine".
 *
 * Getting this wrong is the single most visible thing in a student email, and
 * the syllabus writes the name in about four different ways. Titles come off,
 * the last name stays, and a name with a particle or two surnames keeps both —
 * "Torres Colón" is one surname in two words and cutting it to "Colón" would
 * be worse than using the full name.
 */
export function salutation(prof: string): string {
  const name = prof.trim();
  if (!name) return 'Dear Professor,';
  const bare = name.replace(/^(prof(essor)?\.?|dr\.?|mr\.?|ms\.?|mrs\.?|mx\.?)\s+/i, '').trim();
  const parts = bare.split(/\s+/);
  // One word is already a surname. Otherwise drop the given name only.
  const surname = parts.length > 1 ? parts.slice(1).join(' ') : parts[0];
  return `Dear Professor ${surname},`;
}

/**
 * The address inside a From line, when there is one.
 *
 * Graph hands back a display name and Gmail hands back a raw header, so the
 * same field is sometimes "Dr John Stromme" and sometimes
 * '"Stromme, John" <john.stromme@vanderbilt.edu>'. A name is not an address
 * and guessing one from it would produce mail that silently goes nowhere, so
 * when there is no @ in the string this returns nothing and the To box stays
 * empty for you to fill.
 */
export function addressIn(from: string): string {
  const angled = /<([^>]+@[^>]+)>/.exec(from);
  if (angled) return angled[1].trim();
  const bare = /[^\s<>,;:"']+@[^\s<>,;:"']+\.[^\s<>,;:"']+/.exec(from);
  return bare ? bare[0].trim() : '';
}

/** Which mail client the draft is handed to. */
export type MailApp = 'gmail' | 'outlook' | 'default';

export interface Draft {
  to: string;
  subject: string;
  body: string;
}

/**
 * The compose URL, with the draft already in it.
 *
 * Gmail and Outlook both take a compose deep link, which is better than
 * mailto: because the draft lands in the account the student actually reads
 * rather than in whatever desktop client the OS thinks is default. mailto:
 * stays as the honest fallback — it is the only one that works on a phone with
 * an app that is neither of those.
 */
export function composeUrl(app: MailApp, d: Draft): string {
  const to = d.to.trim();
  if (app === 'gmail') {
    const q = new URLSearchParams({ view: 'cm', fs: '1', to, su: d.subject, body: d.body });
    return `https://mail.google.com/mail/?${q.toString()}`;
  }
  if (app === 'outlook') {
    const q = new URLSearchParams({ to, subject: d.subject, body: d.body });
    return `https://outlook.office.com/mail/deeplink/compose?${q.toString()}`;
  }
  const q = new URLSearchParams({ subject: d.subject, body: d.body });
  return `mailto:${encodeURIComponent(to)}?${q.toString()}`;
}

/**
 * Split "Subject: …" off the front of what came back.
 *
 * The model is asked for that shape, and mostly gives it. When it does not,
 * the whole thing becomes the body rather than the first line being silently
 * eaten — a draft missing its opening sentence is a worse failure than a draft
 * with an empty subject box.
 */
export function parseDraft(text: string): { subject: string; body: string } {
  const trimmed = text.trim();
  const match = /^subject:\s*(.+?)\s*\n/i.exec(trimmed);
  if (!match) return { subject: '', body: trimmed };
  return { subject: match[1].trim(), body: trimmed.slice(match[0].length).trim() };
}

export interface MailContext {
  course: Course | null;
  /** The deadline this is about, when there is one. */
  item: DatedItem | null;
  /** How the student signs off. Blank is allowed; the draft leaves a blank. */
  from: string;
  /** The message being replied to, pasted in. */
  incoming: string;
  /** The facts, in the student's own words. Nothing else may be invented. */
  facts: string;
}

/**
 * What the model is told about how to write.
 *
 * The rules are the whole feature. A model asked to write a student email
 * without them produces something with three paragraphs of throat-clearing, an
 * invented reason, and "I hope this email finds you well" — which is exactly
 * the email that does not get answered.
 */
export const SYSTEM = [
  'You draft emails from a university student to a professor, an instructor, a TA or a',
  'university office. You produce the draft only; the student reads it and sends it themselves.',
  '',
  'How to write:',
  '· Short. Most of these are three to six sentences. A professor reads it on a phone between',
  '  classes, and length is the main reason a student email goes unanswered.',
  '· The ask goes in the first two sentences. Context after, not before.',
  '· Plain and courteous. Not stiff, not chatty. No "I hope this email finds you well", no',
  '  "I wanted to reach out", no apologising twice.',
  '· Specific: name the course, the assignment and the date, because the professor teaches',
  '  several hundred students and cannot place the sender otherwise.',
  '· Make replying cheap — a yes or no, or a time to pick.',
  '',
  'What you must never do:',
  '· Never invent a fact about the student. Not an illness, not a family emergency, not a',
  '  clashing commitment, not something they have already done. If a reason is needed and the',
  '  student has not given one, write [say briefly why here] and leave it for them to fill in.',
  '  Putting an invented excuse in someone else’s name into a professor’s inbox is a lie',
  '  told on their behalf, and at a university it is a much more serious problem than the',
  '  thing they were emailing about.',
  '· Never invent a date, a grade, a policy or a quotation from a syllabus.',
  '· Never claim to have attached something.',
  '· Do not beg, do not grovel, and do not argue a grade in writing.',
  '',
  'Return the subject line first, on its own line, in the form "Subject: ...", then a blank',
  'line, then the body. No preamble, no commentary, no markdown.',
].join('\n');

/** The user turn: everything true that the app knows, and nothing more. */
export function brief(p: Purpose, ctx: MailContext): string {
  const lines: string[] = [`Job: ${p.brief}`, ''];

  if (ctx.course) {
    lines.push(`Course: ${ctx.course.code} — ${ctx.course.name}`);
    if (ctx.course.prof) lines.push(`Addressed to: ${ctx.course.prof}`);
    lines.push(`Opening line to use: ${salutation(ctx.course.prof)}`);
  }
  if (ctx.item) {
    lines.push(
      `The deadline in question: "${ctx.item.title}" (${ctx.item.kind}), due ${ctx.item.mon} ` +
        `${ctx.item.day} at ${ctx.item.dueTime}.`,
    );
  }
  lines.push(ctx.from ? `Signed: ${ctx.from}` : 'Signed: [your name] — leave this placeholder in.');

  if (ctx.incoming.trim()) {
    lines.push('', 'The message being replied to, in full:', '---', ctx.incoming.trim(), '---');
  }

  lines.push('', 'What the student says, in their own words:');
  lines.push(ctx.facts.trim() || '(they have said nothing yet)');

  if (p.needsFacts && !ctx.facts.trim()) {
    lines.push(
      '',
      'They have given you no facts. Write the skeleton with [square-bracket blanks] wherever a ' +
        'fact belongs. Do not fill any of them in.',
    );
  }

  return lines.join('\n');
}

/** A subject line worth having when the model gives none. */
export function fallbackSubject(p: Purpose, ctx: MailContext): string {
  const code = ctx.course?.code ?? '';
  const what = ctx.item?.title ?? p.label.replace(/^Ask (for |about )?/i, '');
  return [code, what].filter(Boolean).join(' — ');
}
