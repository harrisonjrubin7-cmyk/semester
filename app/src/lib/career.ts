import { isoDay, obj, textValue } from './device-library';
import { safeUrl } from './apply';

/**
 * The work of getting the next thing: what is open, what you have done, who
 * you have spoken to.
 *
 * Three bodies of data that are usually three products — a job board, a
 * résumé, a CRM — and are one here because for a student they are one task,
 * and because the second is the evidence the first and third are built from.
 * `coverLetter` is where that pays off: it opens the letter with the student's
 * own recorded experience rather than a blank page.
 *
 * ## The generated documents are scaffolds, and say so in brackets
 *
 * `resumeMarkdown` and `coverLetter` produce drafts with `[square brackets]`
 * where a person has to write something themselves — the specific interest in
 * the role, the connection between evidence and requirement. That is
 * deliberate and should survive editing. A letter this app could finish by
 * itself would be a letter that says nothing, sent to somebody who has read
 * two hundred of them.
 *
 * ## Contacts record permission, not just a name
 *
 * `CareerContact.permission` moves from "Not requested" through "Invitation
 * sent" to "Agreed to connect". It exists so a networking list cannot quietly
 * become a list of people who never agreed to be on one.
 */

export const OPPORTUNITY_KINDS = [
  'Internship',
  'Job',
  'Research',
  'Fellowship',
  'Campus employment',
  'Study abroad',
  'Career event',
] as const;

export const OPPORTUNITY_FORMATS = ['In person', 'Hybrid', 'Remote'] as const;

export const EXPERIENCE_TYPES = [
  'Experience',
  'Education',
  'Project',
  'Leadership',
  'Athletics',
  'Service',
  'Award',
  'Certification',
  'Skills',
] as const;

export const CONTACT_PERMISSIONS = ['Not requested', 'Invitation sent', 'Agreed to connect'] as const;

export interface Opportunity {
  id: string;
  title: string;
  organization: string;
  kind: (typeof OPPORTUNITY_KINDS)[number];
  location: string;
  format: (typeof OPPORTUNITY_FORMATS)[number];
  compensation: string;
  deadline: string;
  skills: string;
  description: string;
  requirements: string;
  url: string;
  country: string;
  term: string;
  cost: string;
  credit: string;
  saved: boolean;
}

export interface CareerExperience {
  id: string;
  category: (typeof EXPERIENCE_TYPES)[number];
  title: string;
  organization: string;
  dates: string;
  details: string;
}

export interface CareerContact {
  id: string;
  name: string;
  organization: string;
  interests: string;
  permission: (typeof CONTACT_PERMISSIONS)[number];
  next: string;
  nextDate: string;
  notes: string;
  /**
   * Where they studied and what in, as the student wrote it down.
   *
   * Optional, and absent from every note saved before these existed. Both are
   * one person's account of another person — nobody has confirmed either, and
   * a note that says "same school" says that two lines of free text overlap.
   */
  school?: string;
  major?: string;
}

export interface CareerLibrary {
  version: 1;
  opportunities: Opportunity[];
  name: string;
  headline: string;
  contact: string;
  experiences: CareerExperience[];
  contacts: CareerContact[];
  abroadSteps: Record<string, boolean>;
  /**
   * What the student says they are looking for, as their own words.
   *
   * Comma-separated, free text, and read by exactly one thing: the ordering on
   * the Discover tab. It is not a signal, it is not shown to anybody, and
   * nothing outside this device can see it — "Open to work" in this app is a
   * note to yourself about which of your own saved listings to read first.
   *
   * Empty by default, and empty in a library saved before these existed, which
   * is why `readCareer` fills them in rather than refusing the record.
   */
  targetRoles: string;
  targetLocations: string;
  /** The day they started looking, if they want it written down. Their claim. */
  lookingSince: string;
}

export const EMPTY_CAREER: CareerLibrary = {
  version: 1,
  opportunities: [],
  name: '',
  headline: '',
  contact: '',
  experiences: [],
  contacts: [],
  abroadSteps: {},
  targetRoles: '',
  targetLocations: '',
  lookingSince: '',
};

export const CAREER_LIMITS = {
  opportunities: 300,
  experiences: 100,
  contacts: 100,
  description: 16_000,
  requirements: 8000,
  notes: 6000,
  url: 2000,
  targets: 500,
} as const;

/**
 * Going abroad, in the order the deadlines actually fall.
 *
 * Every step that touches an authority says so — "with advisor", "from
 * official sources", "approved". Passport and visa requirements especially:
 * this app must never be the thing a student believed about a visa.
 */
export const ABROAD_STEPS = [
  'Review program requirements',
  'Confirm credit transfer with advisor',
  'Review official costs and funding',
  'Prepare application materials',
  'Confirm passport and visa requirements with official sources',
  'Complete approved health and safety preparation',
  'Confirm housing and travel',
  'Record local support contacts',
  'Request final transcript and credit review',
];

export function newOpportunity(): Opportunity {
  return {
    id: crypto.randomUUID(),
    title: '',
    organization: '',
    kind: 'Internship',
    location: '',
    format: 'In person',
    compensation: '',
    deadline: '',
    skills: '',
    description: '',
    requirements: '',
    url: '',
    country: '',
    term: '',
    cost: '',
    credit: '',
    saved: false,
  };
}

/**
 * A career library out of storage or a file, or an error.
 *
 * The URL check is the one that is load-bearing. An opportunity carries a link
 * a student will click, and these arrive by import — from a spreadsheet, a
 * careers-office export, a file somebody sent. `safeUrl` from `lib/apply.ts`
 * is the app's single answer to "is this a link we will put on screen", and
 * reusing it rather than writing a second one is what keeps the answer single.
 */
export function readCareer(v: unknown): CareerLibrary {
  /*
   * The three target fields arrived after libraries were already being saved,
   * so a stored record predating them is missing all three. Filled in before
   * the check rather than exempted from it: the validated value is what the
   * device library writes back, so one load normalises the record and every
   * later read is of a whole one.
   */
  const given: Record<string, unknown> = obj(v) ? v : {};
  // Asserted rather than trusted: the three checks at the top of `top` are
  // what make these casts honest, in the same order as every other field here.
  const targets = {
    targetRoles: (given.targetRoles ?? '') as string,
    targetLocations: (given.targetLocations ?? '') as string,
    lookingSince: (given.lookingSince ?? '') as string,
  };

  const top =
    obj(v) &&
    textValue(targets.targetRoles, CAREER_LIMITS.targets) &&
    textValue(targets.targetLocations, CAREER_LIMITS.targets) &&
    isoDay(targets.lookingSince) &&
    v.version === 1 &&
    Array.isArray(v.opportunities) &&
    v.opportunities.length <= CAREER_LIMITS.opportunities &&
    textValue(v.name, 160) &&
    textValue(v.headline, 300) &&
    textValue(v.contact, 500) &&
    Array.isArray(v.experiences) &&
    v.experiences.length <= CAREER_LIMITS.experiences &&
    Array.isArray(v.contacts) &&
    v.contacts.length <= CAREER_LIMITS.contacts &&
    obj(v.abroadSteps) &&
    Object.values(v.abroadSteps).every((x) => typeof x === 'boolean');
  if (!top) throw new Error('Invalid career library.');
  const lib = v as unknown as CareerLibrary;

  const ids = new Set<string>();
  for (const o of lib.opportunities) {
    const shaped =
      obj(o) &&
      textValue(o.id, 100) &&
      !ids.has(o.id) &&
      textValue(o.title, 160) &&
      !!o.title.trim() &&
      textValue(o.organization, 160) &&
      OPPORTUNITY_KINDS.includes(o.kind) &&
      OPPORTUNITY_FORMATS.includes(o.format) &&
      (['location', 'compensation', 'skills', 'country', 'term', 'cost', 'credit'] as const).every((k) =>
        textValue(o[k], 1000),
      ) &&
      textValue(o.description, CAREER_LIMITS.description) &&
      textValue(o.requirements, CAREER_LIMITS.requirements) &&
      isoDay(o.deadline) &&
      textValue(o.url, CAREER_LIMITS.url) &&
      (!o.url || safeUrl(o.url)) &&
      typeof o.saved === 'boolean';
    if (!shaped) throw new Error('Invalid opportunity. Check dates and use http(s) links.');
    ids.add(o.id);
  }

  for (const e of lib.experiences) {
    const shaped =
      obj(e) &&
      textValue(e.id, 100) &&
      EXPERIENCE_TYPES.includes(e.category) &&
      textValue(e.title, 160) &&
      textValue(e.organization, 160) &&
      textValue(e.dates, 100) &&
      textValue(e.details, 5000);
    if (!shaped) throw new Error('Invalid résumé entry.');
  }

  for (const c of lib.contacts) {
    const shaped =
      obj(c) &&
      (['id', 'name', 'organization', 'interests', 'next'] as const).every((k) => textValue(c[k], 500)) &&
      (['school', 'major'] as const).every((k) => textValue(c[k] ?? '', 200)) &&
      CONTACT_PERMISSIONS.includes(c.permission) &&
      isoDay(c.nextDate) &&
      textValue(c.notes, CAREER_LIMITS.notes);
    if (!shaped) throw new Error('Invalid networking note.');
  }

  return { ...lib, ...targets };
}

/**
 * What somebody typed into a target field, as terms to match on.
 *
 * Split on commas, because that is how people write a list of roles in one
 * box. Empty pieces and whitespace go; nothing is stemmed, expanded or
 * corrected, so "policy" does not quietly become "policies" and a student who
 * typed one word gets exactly that word.
 */
export const targetTerms = (text: string): string[] =>
  text
    .split(',')
    .map((t) => t.trim().toLowerCase())
    .filter(Boolean);

/**
 * How many of the student's own target terms this listing carries.
 *
 * Role terms are looked for in the title and the skills line, location terms
 * in the location and the country — matching a place against a job title would
 * find "Washington Fellow" for somebody who wants to work in Washington and
 * call it a location match, which is a coincidence dressed as an answer.
 *
 * The number leaves this function. It orders the list and is never drawn: a
 * "92% match" beside a listing is a claim about a job somebody typed in
 * themselves, from a fit this app has no way to judge. What the student gets
 * is their own listings, theirs-first.
 */
export function targetScore(o: Opportunity, c: CareerLibrary): number {
  const roles = `${o.title} ${o.skills}`.toLowerCase();
  const where = `${o.location} ${o.country}`.toLowerCase();
  return (
    targetTerms(c.targetRoles).filter((t) => roles.includes(t)).length +
    targetTerms(c.targetLocations).filter((t) => where.includes(t)).length
  );
}

/**
 * The two things a contact note can have in common with the student.
 *
 * Two, and they stop here. A tag for every field would turn a private list of
 * people into a set of axes to sort people on, which is the shape of every
 * network product that ends up ranking the people in it.
 */
export const SHARED_TAGS = [
  { id: 'school' as const, label: 'Same school' },
  { id: 'major' as const, label: 'Same major' },
];

export type SharedTag = (typeof SHARED_TAGS)[number]['id'];

/**
 * Whether what somebody wrote about a contact appears in what they wrote about
 * themselves.
 *
 * Both sides are free text one student typed — their own line under Pathway →
 * Profile, and the school or course they noted against a person. So this is a
 * substring test and is not pretending to be more: it says those two lines
 * overlap, which is the whole claim the chip makes.
 *
 * An empty field on either side shares nothing. Everybody has no school in
 * common with a blank, and a chip that matched on emptiness would offer to
 * filter a list down to the people nothing is known about.
 */
export const sharedWith = (education: string, value: string | undefined): boolean => {
  const v = (value ?? '').trim().toLowerCase();
  return !!v && !!education.trim() && education.toLowerCase().includes(v);
};

/** Which of the two this contact has in common, for the card and the filter. */
export const sharedTags = (education: string, c: CareerContact): SharedTag[] =>
  SHARED_TAGS.filter((t) => sharedWith(education, c[t.id])).map((t) => t.id);

/** Whether anything has been recorded for the ordering above to read. */
export const hasTargets = (c: CareerLibrary): boolean =>
  targetTerms(c.targetRoles).length > 0 || targetTerms(c.targetLocations).length > 0;

/**
 * Opportunities out of a file somebody chose.
 *
 * Every row gets a fresh id and `saved: false`, so an import can never
 * overwrite something already in the library or arrive pre-starred. Validated
 * by building a whole library around them and reading it back — one validator,
 * rather than a second that agrees with the first until it does not.
 */
export function readOpportunities(text: string): Opportunity[] {
  const v = JSON.parse(text);
  const rows = Array.isArray(v) ? v : v.opportunities;
  if (!Array.isArray(rows)) throw new Error('Provide a list of opportunities.');
  const mapped = rows.map((o) => ({ ...newOpportunity(), ...o, id: crypto.randomUUID(), saved: false }));
  return readCareer({ ...EMPTY_CAREER, opportunities: mapped }).opportunities;
}

/**
 * What "Build it in Write" calls the draft it makes.
 *
 * One expression, used by the button that writes the document and by the
 * readout that says whether one exists. Two spellings of the same title is how
 * the readout ends up saying "not built" about a draft sitting in Write.
 */
export const resumeDocumentTitle = (c: CareerLibrary) => `${c.name || 'My'} résumé`;

/**
 * Whether one of these documents is a résumé draft this screen built.
 *
 * By the title's ending rather than by an exact match, because the name on the
 * résumé is part of the title and somebody who corrects their name afterwards
 * has not un-built the draft.
 */
export const builtResume = (titles: readonly string[]) =>
  titles.some((t) => t.trim().toLowerCase().endsWith('résumé'));

/**
 * What is filled in, as four facts and no verdict.
 *
 * Every competing product puts a meter here — "Profile strength: Intermediate",
 * a percentage, a ring that fills. All of them are the same move: a number
 * derived from how much somebody has typed, presented as a measure of how they
 * are doing. It is not one. A student with two real jobs on a one-page résumé
 * scores below one with nine lines of padding, and the meter's advice is to
 * add the padding.
 *
 * So this counts and says, and stops. No score, no percentage, no band, no
 * colour, and nothing ordered by it — "Headline: not set" is a fact somebody
 * can act on or ignore, and it is the whole of what the app knows.
 */
export function resumeReadout(c: CareerLibrary, draft: boolean): string {
  const experiences = c.experiences.length;
  const contacts = c.contacts.length;
  return [
    `Headline: ${c.headline.trim() ? 'set' : 'not set'}`,
    `${experiences} experience ${experiences === 1 ? 'entry' : 'entries'}`,
    `${contacts} ${contacts === 1 ? 'contact' : 'contacts'} saved`,
    draft ? 'résumé draft built in Write' : 'no résumé draft built in Write yet',
  ].join(' · ');
}

/** The résumé as Markdown, for Write or an export. */
export function resumeMarkdown(c: CareerLibrary): string {
  const entries = c.experiences
    .map((e) =>
      [`## ${e.category} · ${e.title}`, [e.organization, e.dates].filter(Boolean).join(' · '), '', e.details].join(
        '\n',
      ),
    )
    .join('\n\n');
  return [`# ${c.name || 'Your name'}`, '', c.contact, '', c.headline, '', entries].join('\n');
}

/**
 * The one "where" box on a career-fair quick-add, as the two fields a listing
 * has.
 *
 * A poster gives you a room or a link and almost never both, so the form asks
 * once. What comes back decides which field it was: something already shaped
 * like an address goes to the link, and everything else is a place.
 *
 * The shape test is deliberately narrower than `safeUrl`, which is a question
 * about whether a link is safe to open rather than about whether this is a
 * link at all. `safeUrl('Sarratt')` answers `https://sarratt`, because a
 * hostname needs no dot — so a one-word venue would have been filed as a web
 * address nobody could open. A dot with no spaces around it, or a scheme
 * already typed, is what a student actually pastes.
 */
export function eventWhere(where: string): { location: string; url: string } {
  const s = where.trim();
  const shaped = /^https?:\/\//i.test(s) || /^\S+\.\S{2,}(?:[/?#]|$)/.test(s);
  const url = shaped ? safeUrl(s) : '';
  return url ? { location: '', url } : { location: s, url: '' };
}

/**
 * A career fair, from the four things a poster tells you.
 *
 * The full Discover form has sixteen fields, which is right for a job somebody
 * is going to apply to and wrong for a fair on Thursday — by the time you have
 * answered "Compensation, as listed" for a careers fair you have stopped
 * writing it down. This is the same record, reached in four answers, and it
 * lands in the same `opportunities` array with the same kind.
 */
export function careerEvent(fields: { name: string; date: string; where: string; note: string }): Opportunity {
  return {
    ...newOpportunity(),
    kind: 'Career event',
    title: fields.name.trim(),
    deadline: fields.date,
    description: fields.note,
    ...eventWhere(fields.where),
  };
}

/**
 * Three openings to one person, none of them sent.
 *
 * The same rule as `coverLetter`, and for the same reason: the brackets are
 * the feature. A message this app could finish by itself would be the message
 * two hundred other people sent, and the one sentence that gets an answer —
 * why this person and not somebody else — is the one only the student can
 * write. What is filled in is what the app actually knows: their name, where
 * they work, what the student recorded they have in common.
 *
 * Three because they are three different asks and the wrong one is obvious in
 * hindsight only: the first conversation with somebody you have a way in to,
 * the note afterwards, and the message to somebody you have never met. The
 * third is where the shared attribute belongs — it is the only one where "we
 * both studied X" is doing any work — and where there is none recorded, it
 * says so rather than inventing one.
 *
 * Nothing here sends anything, and the document says so at the top. The
 * permission this note carries is repeated there too, because "Not requested"
 * is exactly the state somebody is in when they are about to write a message.
 */
export function outreachDrafts(c: CareerContact, tags: SharedTag[]): string {
  const name = c.name || '[their name]';
  const shared = tags.includes('school')
    ? `We were both at ${c.school}.`
    : tags.includes('major')
      ? `We both studied ${c.major}.`
      : '[Say what you actually have in common. If it is nothing, say why you are writing to them anyway.]';

  return [
    `# Messages to ${name}`,
    '',
    [c.organization, `Permission recorded: ${c.permission}`].filter(Boolean).join(' · '),
    '',
    'Three drafts. Nothing has been sent, and this app cannot send anything — copy the one that fits into',
    'your own mail. Every line in brackets is one only you can write, and those are the lines that get a reply.',
    '',
    '## Asking for a first conversation',
    '',
    `Hello ${name},`,
    '',
    '[One true sentence on how you came to be writing to them.]',
    '',
    '[What you are doing now, and the actual question you are stuck on — not "advice about my career".]',
    '',
    'Would twenty minutes in the next few weeks be possible? I am happy to work around you.',
    '',
    '[Your name]',
    '',
    '## After you have spoken',
    '',
    `Hello ${name},`,
    '',
    '[Thank them for the specific thing you were glad of. Not "your insights" — the sentence you wrote down',
    'afterwards because it changed what you were going to do.]',
    '',
    '[The thing you are now going to do because of it, and when.]',
    '',
    '[Your name]',
    '',
    '## Writing to somebody you have not met',
    '',
    `Hello ${name},`,
    '',
    shared,
    '',
    '[Why them and not somebody else. One sentence, and it has to be true.]',
    '',
    '[The one question you would ask if you only got one.]',
    '',
    '[Your name]',
  ].join('\n');
}

/**
 * A cover letter opened for you, not written for you.
 *
 * The brackets are the feature. Four recorded experiences go in as evidence,
 * and every place where a person has to say something only they can say is
 * left as an instruction to them. See the note at the top of this file.
 */
export function coverLetter(c: CareerLibrary, o: Opportunity): string {
  const evidence = c.experiences
    .slice(0, 4)
    .map((e) => `${e.title}${e.organization ? ` — ${e.organization}` : ''}\n${e.details}`)
    .join('\n\n');

  return [
    `# ${o.organization} · ${o.title}`,
    '',
    c.name || '[Your name]',
    c.contact,
    '',
    'Dear Hiring Team,',
    '',
    `I am applying for the ${o.title} opportunity at ${o.organization || '[organization]'}. [Explain your specific interest in this position.]`,
    '',
    '[Choose and explain relevant evidence from your own record below. Remove anything not relevant.]',
    '',
    evidence,
    '',
    '[Connect this evidence to the role requirements in your own words.]',
    '',
    'Thank you for your consideration.',
    '',
    c.name || '[Your name]',
  ].join('\n');
}
