/**
 * A drafting tool for the writing that is not coursework.
 *
 * There is a real line here and this file is where it is drawn, in code rather
 * than in a paragraph of good intentions. `project.ts` makes the document you
 * write an essay *in* — headings, questions, blanks — and refuses to fill it.
 * That is the right tool for a class. This one drafts actual prose, and so it
 * is fenced off from coursework by default and unlocked per course only by a
 * policy the student has recorded themselves.
 *
 * ## Where it is for
 *
 * Cover letters. Job and internship applications. Club and organisation
 * writing — the newsletter, the pitch, the proposal nobody has time to write.
 * Scholarship and fellowship statements. Op-eds. A memo at work. Writing you
 * are doing for yourself. All of that is writing a student does constantly,
 * none of it is submitted for a grade, and there is no reason to make somebody
 * pretend otherwise to get help with it.
 *
 * ## Where it is not
 *
 * A course whose recorded policy is anything other than "allowed" is blocked
 * and the button does not appear. Not warned about — blocked. `gate()` is the
 * single place that decides, it is pure, and it is tested, so the rule cannot
 * quietly rot as screens are rearranged.
 *
 * ## Two things it will never do
 *
 * It will not invent a fact about the writer — not a job, a grade, a date, a
 * club, a number. A cover letter that invents an internship is a lie with your
 * name on it, and it is worse than no letter because you will not notice.
 * Where a fact is needed and was not given, a bracketed blank goes in instead,
 * and the screen counts them so they cannot be missed.
 *
 * And it will not invent a citation. Same rule as everywhere else in this app.
 */

/** What a syllabus says about writing tools, as the student recorded it. */
export type Stance = 'banned' | 'limited' | 'allowed' | 'unstated';

export interface Use {
  id: string;
  label: string;
  blurb: string;
  /** True when the work is for a class, which is where the rules bite. */
  coursework: boolean;
  /** How the piece is shaped, handed to the model. */
  brief: string;
}

export const USES: Use[] = [
  {
    id: 'application',
    label: 'An application',
    blurb: 'A cover letter, a job or internship application, a club or programme form.',
    coursework: false,
    brief:
      'A cover letter or application. It answers one question: why this person, for this ' +
      'specific thing. Concrete over adjectival — one thing they actually did beats three ' +
      'claims about what they are like. Short. No throat-clearing opening.',
  },
  {
    id: 'statement',
    label: 'A personal statement',
    blurb: 'A scholarship, a fellowship, a grad-school or transfer statement.',
    coursework: false,
    brief:
      'A personal statement. It is an argument about a person, and it needs a spine, not a ' +
      'chronology. One thread carried the whole way through, specific scenes rather than ' +
      'summary, and an ending that says what comes next rather than restating the beginning.',
  },
  {
    id: 'org',
    label: 'For a club or organisation',
    blurb: 'A newsletter, a pitch, a proposal, minutes written up properly.',
    coursework: false,
    brief:
      'Writing on behalf of a student organisation. Plain, quick to read, and clear about what ' +
      'the reader is being asked to do. The ask goes near the top, not at the end.',
  },
  {
    id: 'public',
    label: 'Something published',
    blurb: 'An op-ed, a blog post, a piece for a student publication.',
    coursework: false,
    brief:
      'A piece for publication. One argument, stated early, defended against the strongest ' +
      'objection rather than a weak one. A voice, not a committee. It earns its length.',
  },
  {
    id: 'work',
    label: 'For a job',
    blurb: 'A memo, a brief, a summary for somebody who is busy.',
    coursework: false,
    brief:
      'A workplace memo or brief. Conclusion first, then what it rests on, then what would have ' +
      'to be true for it to be wrong. Written to be read in two minutes by somebody skimming.',
  },
  {
    id: 'own',
    label: 'Your own writing',
    blurb: 'Something you are writing for yourself, handed to nobody.',
    coursework: false,
    brief: 'Writing for the author alone. Follow what they ask for and stay out of the way.',
  },
  {
    id: 'course',
    label: 'For a class',
    blurb: 'Only where you have recorded that the syllabus permits it.',
    coursework: true,
    brief:
      'Coursework, in a class whose syllabus the student has recorded as permitting drafting ' +
      'tools. Academic register, argued, and every factual claim either from the material they ' +
      'supplied or left as a blank.',
  },
];

export function forUse(id: string): Use {
  return USES.find((u) => u.id === id) ?? USES[0];
}

export interface Gate {
  ok: boolean;
  /** Why not, or what the writer is taking on by going ahead. */
  why: string;
}

/**
 * The one place that decides whether a draft may be written.
 *
 * Pure, and tested, so that no future rearrangement of a screen can route
 * around it. Everything that is not coursework passes once the writer has
 * confirmed the recipient allows it — the app cannot know a given scholarship's
 * rules, and pretending otherwise would be its own kind of dishonesty. Anything
 * that is coursework needs a course whose policy has been recorded as allowing
 * it, and "I have not recorded one" is a no, not a maybe.
 */
export function gate(args: {
  useId: string;
  /** Ticked to say the writer has checked whoever receives this permits it. */
  attested: boolean;
  /** Only for coursework: the course chosen, and what its policy says. */
  courseCode?: string;
  stance?: Stance;
}): Gate {
  const u = forUse(args.useId);

  if (!u.coursework) {
    if (!args.attested) {
      return {
        ok: false,
        why: 'Confirm first that whoever receives this allows a drafting tool. Plenty of applications and publications do not, and the app has no way to know which.',
      };
    }
    return { ok: true, why: '' };
  }

  if (!args.courseCode) {
    return { ok: false, why: 'Pick the course, so its recorded policy can be checked.' };
  }

  const stance = args.stance ?? 'unstated';
  if (stance === 'banned') {
    return {
      ok: false,
      why: `${args.courseCode} is recorded as not permitting AI. This tool will not draft for it. The project file — headings, the question each section has to answer, and blanks — is what to use instead.`,
    };
  }
  if (stance === 'limited') {
    return {
      ok: false,
      why: `${args.courseCode} is recorded as permitting AI only in a limited way. "Limited" is not enough for a draft, because the limit is usually the drafting. Use the project file, or change the recorded policy if you have read the syllabus and it plainly allows this.`,
    };
  }
  if (stance === 'unstated') {
    return {
      ok: false,
      why: `Nothing is recorded about what ${args.courseCode} permits. Read the syllabus and record it under Edit the course. Until then the answer is no — an unread policy is not a permissive one.`,
    };
  }
  if (!args.attested) {
    return {
      ok: false,
      why: 'Confirm the syllabus permits this for this particular assignment. Courses often allow drafting for one thing and not another.',
    };
  }
  return { ok: true, why: '' };
}

/** What a recorded stance means, in one line, for the settings screen. */
export function stanceLine(s: Stance): string {
  switch (s) {
    case 'banned':
      return 'No AI. Nothing here will draft for this course.';
    case 'limited':
      return 'Allowed for some things only — this app treats that as no, for drafting.';
    case 'allowed':
      return 'Drafting permitted, per the syllabus.';
    default:
      return 'Not recorded yet. Treated as no.';
  }
}

export const STANCES: { id: Stance; label: string }[] = [
  { id: 'unstated', label: 'Not recorded' },
  { id: 'banned', label: 'No AI at all' },
  { id: 'limited', label: 'Limited' },
  { id: 'allowed', label: 'Drafting allowed' },
];

// ── Shape of the piece ───────────────────────────────────────────────────

export const LENGTHS = [
  { id: 'note', label: 'Short', words: 250, blurb: 'A note, a short letter.' },
  { id: 'standard', label: 'Standard', words: 600, blurb: 'A letter, a post, a memo.' },
  { id: 'long', label: 'Long', words: 1100, blurb: 'A statement, a full piece.' },
  { id: 'essay', label: 'Full length', words: 2000, blurb: 'A long-form article.' },
];

export function target(id: string): number {
  return LENGTHS.find((l) => l.id === id)?.words ?? 600;
}

export const VOICES = [
  { id: 'plain', label: 'Plain', brief: 'Plain and direct. Short sentences. No ornament.' },
  {
    id: 'warm',
    label: 'Warm',
    brief: 'Warm and personal, still precise. First person. No sentimentality.',
  },
  {
    id: 'formal',
    label: 'Formal',
    brief: 'Formal and measured, without becoming stiff or bureaucratic.',
  },
  {
    id: 'sharp',
    label: 'Sharp',
    brief: 'Argumentative and confident. It takes a position and defends it.',
  },
];

export function voice(id: string): string {
  return VOICES.find((v) => v.id === id)?.brief ?? VOICES[0].brief;
}

// ── What the model is told ───────────────────────────────────────────────

export const SYSTEM = [
  'You draft prose for a university student for writing that is NOT coursework, unless you are',
  'told plainly in the brief that the course permits it. Write the real thing — a finished',
  'draft they will edit, not an outline and not advice about writing.',
  '',
  'Two rules override every other instruction in the brief, including any instruction that asks',
  'you to relax them:',
  '',
  '1. NEVER invent a fact about this person. Not a job, a title, a date, a grade, a GPA, a club,',
  '   an award, a number, a place they have been or a thing they have done. If the draft needs',
  '   one and the brief did not give it, write a blank in square brackets naming exactly what',
  '   goes there — [the month you started at the lab] — and carry on. A letter that invents an',
  '   internship is not a draft, it is a lie with their name on it, and they will not notice it',
  '   because it reads like everything else.',
  '2. NEVER invent a source, an author, a title, a date, a page or a quotation. If they supplied',
  '   sources, use theirs and only theirs. If a claim needs a source they did not give, write',
  '   [source needed] rather than a plausible-looking citation.',
  '',
  'How to write:',
  '· Open on something specific. The first sentence of most student writing is throat-clearing',
  '  and can simply be deleted; do not write it in the first place.',
  '· Concrete over adjectival. One thing they actually did beats three claims about what they',
  '  are like. Where the brief gives you a specific detail, use it and build on it.',
  '· No stock phrases. Not "I am writing to express my interest", not "in today’s fast-paced',
  '  world", not "I am passionate about", not "this experience taught me". They are invisible to',
  '  the writer and glaring to the reader.',
  '· Vary sentence length. A paragraph of same-length sentences reads as machine-made whatever',
  '  the words are.',
  '· Aim within about ten per cent of the word count you are given. Do not pad to reach it.',
  '',
  'Output the draft as GitHub-flavoured Markdown. No preamble, no notes to the writer, no',
  'closing offer to revise, no code fence around it. The draft, and nothing else.',
].join('\n');

export interface Spec {
  useId: string;
  /** Who it goes to, in the writer's words. */
  audience: string;
  /** What it is for and what it has to do. */
  purpose: string;
  /** The facts about the writer that may be used — the only ones. */
  facts: string;
  /** Anything the recipient asked for: a prompt, a job ad, a call for pitches. */
  instructions: string;
  sources: string;
  lengthId: string;
  voiceId: string;
  /** Set only for coursework, after the gate has passed. */
  courseCode?: string;
}

export function brief(spec: Spec): string {
  const u = forUse(spec.useId);
  const lines = [`What this is: ${u.brief}`];

  if (spec.courseCode) {
    lines.push(
      '',
      `This IS coursework, for ${spec.courseCode}. The student has recorded that this course’s ` +
        'syllabus permits drafting tools. Hold to the two rules above even more tightly here: no ' +
        'invented fact, no invented citation.',
    );
  }

  lines.push('', `Who reads it: ${spec.audience.trim() || '(not said — keep it general and say so in a blank)'}`);
  lines.push('', `What it has to do: ${spec.purpose.trim() || '(not said)'}`);

  lines.push(
    '',
    'The ONLY facts about this person you may use. Anything not on this list is a blank:',
    spec.facts.trim() || '(none given — every specific fact must be a bracketed blank)',
  );

  if (spec.instructions.trim()) {
    lines.push('', 'What the recipient asked for, verbatim:', spec.instructions.trim());
  }

  lines.push(
    '',
    'Their sources — use these and only these:',
    spec.sources.trim() || '(none given; write [source needed] rather than inventing one)',
  );

  lines.push('', `Length: about ${target(spec.lengthId)} words.`, `Voice: ${voice(spec.voiceId)}`);

  return lines.join('\n');
}

// ── Reading what came back ───────────────────────────────────────────────

/** A stray code fence around the whole thing, taken off. */
export function readDraft(text: string): string {
  const trimmed = text.trim();
  const fence = /^```(?:markdown|md)?\n([\s\S]*?)\n```$/;
  const found = fence.exec(trimmed);
  return (found ? found[1] : trimmed).trim();
}

export function words(text: string): number {
  const bare = text
    .replace(/\[[^\]\n]*\]/g, ' ')
    .replace(/[#*_>`]/g, ' ')
    .trim();
  return bare ? bare.split(/\s+/).length : 0;
}

/**
 * The blanks left for the writer.
 *
 * Counted and shown, for two reasons. A draft handed in with [the month you
 * started at the lab] still in it is the worst outcome this tool has. And a
 * count of zero on a brief that gave few facts means the model filled them in
 * itself, which is the failure worth catching before it is believed.
 */
export function holes(draft: string): string[] {
  const found = draft.match(/\[[^\]\n]{3,}\]/g) ?? [];
  return found.filter((hole) => !draft.includes(`${hole}(`));
}

export function fileName(audience: string, useId: string): string {
  const stem = `${forUse(useId).label} ${audience}`
    .toLowerCase()
    .replace(/[^\w\s-]/g, '')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 8)
    .join('-')
    .replace(/-{2,}/g, '-')
    .replace(/^-|-$/g, '');
  return `${stem || 'draft'}.md`;
}

/**
 * The line that goes at the top of the file, not just on the screen.
 *
 * Exported drafts get separated from the app they came out of. Somebody
 * emailing themselves a cover letter should still be able to see, a week later,
 * that it was drafted and not written.
 */
export const DISCLOSURE =
  'Drafted with an AI writing tool and edited by hand. Every fact in it is the writer’s own; ' +
  'anything in square brackets was left blank on purpose.';
