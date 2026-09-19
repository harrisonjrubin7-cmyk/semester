/**
 * A university's own data, as a file it can hand over.
 *
 * The app already has two ways to learn where somebody studies, and neither
 * of them is a university handing over its data. `lib/findschool.ts` asks a
 * student eight plain-language questions and builds a profile out of the
 * answers, which is the right shape for one person filling in their own
 * school. `data/schools/vanderbilt.json` is compiled into the bundle, which
 * is the right shape for the one university this app was built around.
 *
 * What neither shape covers is the thing a partnership actually produces: a
 * registrar's office sends a term calendar with thirty dated landmarks, an
 * estates team sends two hundred buildings with coordinates, dining sends its
 * plan tiers. Nobody is typing that into a form, and getting it into the app
 * today means editing a file in this repository and shipping a new build —
 * which makes correcting a date a deployment.
 *
 * This file is the third shape: **a documented, versioned format a school can
 * export to, validate against, and hand over, which the app reads at run time
 * on the device.** Nothing here talks to a university. A pack is a file
 * somebody was given, the same way a syllabus is.
 *
 * ## It is a snapshot, and it says so
 *
 * A pack is emphatically not a connection. It cannot go stale politely: the
 * dates in it were true when it was written and the app has no way to notice
 * when they stop being. That is why `importedAt` is required on the way in
 * and surfaced on the way out — a student looking at a withdrawal deadline
 * needs to be able to see that it came from a file dated in August.
 *
 * `app/server/institution/` is the other thing, and the distance between them
 * is the point. That is a live gateway, its production registry is empty, and
 * it stays empty until a school writes and approves an adapter. This is a
 * file. Reading one must never be drawn as the other.
 *
 * ## Why this reports problems instead of throwing
 *
 * `lib/registration.ts` parses a course catalogue and throws on the first
 * thing it does not like, which is right there: a catalogue row is uniform,
 * the first bad one usually means the export is wrong in general, and one
 * clear sentence beats five hundred.
 *
 * A data pack is not uniform. It is six unrelated sections written by
 * different offices, and the realistic failure is not a broken file — it is
 * fourteen of two hundred buildings missing their coordinates because one
 * spreadsheet column was never filled in. Throwing on the first would hand a
 * partner one problem per round trip. So every section is read independently,
 * every part that cannot be used is dropped *by name*, and the rest loads.
 *
 * That is also the difference from `readSchool` in `lib/school.ts`, which
 * reads the same data and says nothing at all about what it discarded. The
 * two are both right, for opposite reasons: `readSchool` reads what this app
 * itself wrote, where a silent coercion is a newer build being tolerated;
 * this reads what somebody else wrote, where a silent coercion is a value
 * going missing with nobody told. Same data, different question.
 *
 * ## What a pack may never do
 *
 * Set `verified`. That flag means "not editable by a stranger who signed up
 * and mistyped something", and a file is by definition from outside. It is
 * forced false on the way in, whatever the file says — see `readPack`.
 */

import { realDate } from './date';
import { plain } from './findschool';
import { readGradeSystem } from './cutoffs';
import { readCapabilities, readSchool, type Capabilities, type School, type SchoolData, type TermCalendar } from './school';

/**
 * The format version, in the file, required.
 *
 * A pack with no version is refused rather than guessed at. The alternative
 * is reading an arbitrary JSON file somebody dragged in as though it were a
 * school, and the failure mode there is a profile assembled out of a
 * coincidence of key names.
 */
export const PACK_VERSION = 1;

/** Four megabytes. A two-thousand-building estate is about two hundred kilobytes. */
const MAX_BYTES = 4_000_000;

/**
 * The caps, and why each is a truncation rather than a refusal.
 *
 * A partner who sends three thousand buildings has sent good data in a
 * quantity this app cannot draw. Refusing the file teaches them nothing;
 * loading two thousand and saying which eight hundred were left out tells
 * them exactly what to do next.
 */
const CAPS = {
  terms: 12,
  deadlines: 100,
  breaks: 40,
  buildings: 2000,
  tiers: 40,
  domains: 20,
} as const;

/**
 * One thing that could not be used, said the way a person could act on it.
 *
 * `where` names the part in the language of the file's author — a term by its
 * name, a building by its name — rather than by a JSON path, because the
 * person fixing this is looking at a spreadsheet and not at the JSON.
 */
export interface PackProblem {
  where: string;
  says: string;
  /**
   * `refused` — nothing loaded, and `school` is null.
   * `dropped` — this part was left out and everything else loaded.
   */
  severity: 'refused' | 'dropped';
}

/** What a pack turned out to contain, for the confirmation screen. */
export interface PackCounts {
  terms: number;
  deadlines: number;
  buildings: number;
  tiers: number;
  domains: number;
}

/** What every read carries, whether or not the pack was usable. */
interface PackReadBase {
  /** When the school says it wrote this, ISO date, or empty if it did not say. */
  importedAt: string;
  problems: PackProblem[];
  counts: PackCounts;
}

/**
 * A read pack, as a union rather than a school that might be null.
 *
 * So a caller that has checked `ok` has a `School` and not a maybe. The
 * alternative — `ok: boolean` beside `school: School | null` — lets a screen
 * check the first and dereference the second, which type-checks and is one
 * refusal away from a blank page.
 */
export type PackRead =
  | (PackReadBase & { ok: false; school: null })
  | (PackReadBase & { ok: true; school: School });

// ── Reading one value at a time ─────────────────────────────────────────

const text = (v: unknown, max = 200): string =>
  typeof v === 'string' ? v.trim().slice(0, max) : '';

/**
 * An ISO date that is also a real day.
 *
 * `2026-02-30` passes every regular expression worth writing and is not a
 * date. `realDate` compares what came back against what was asked for, which
 * catches that and the two-digit-year trap with it.
 *
 * ## A timestamp is refused rather than trimmed
 *
 * This read the first ten characters, so `2026-08-26T00:00:00Z` came through
 * as 26 August and nobody was told. That is forgiving in the direction that
 * costs a day: an export written in one timezone and trimmed in another puts
 * the withdrawal deadline on the wrong date, confidently, with no problem
 * reported and nothing on screen to disagree with. A whole-string match means
 * a partner exporting timestamps gets a sentence back naming the field, which
 * they can fix in one pass.
 */
export function isoDate(v: unknown): string | null {
  const s = text(v, 40);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return null;
  const [y, m, d] = s.split('-').map(Number);
  return realDate(y, m, d) ? s : null;
}

/**
 * An id for the school this pack describes.
 *
 * Deliberately *not* `idFor` from `lib/findschool.ts`, which appends `-2`
 * when an id is taken. That is right for somebody adding a second school by
 * hand and wrong here: a corrected Vanderbilt pack has to land on
 * `vanderbilt` and replace what is there. A pack that renamed itself out of
 * the way of the profile it was written to correct would import cleanly,
 * report no problem, and change nothing on any screen.
 */
export function packId(id: unknown, name: string): string {
  const given = plain(text(id, 40)).replace(/ /g, '-');
  if (given) return given;
  return plain(name).replace(/ /g, '-').slice(0, 40) || 'school';
}

/** http(s) only, matching the rule `readCapabilities` already applies. */
const isLink = (s: string) => /^https?:\/\//i.test(s);

// ── The sections ────────────────────────────────────────────────────────

/**
 * The academic calendar, term by term.
 *
 * A term needs a name and nothing else. That is not laxity, it is the shape
 * of the reference data: the bundled Vanderbilt term ships with `endsOn` set
 * to an empty string, because the registrar's last class day was one of the
 * values [VANDERBILT-AUDIT.md](../../../VANDERBILT-AUDIT.md) could not verify
 * and this repository refuses to guess one. `fromCalendar` in
 * `lib/registrar.ts` already reads a blank date as "not published" and skips
 * the row.
 *
 * So a first draft of this function, which required both bounds and dropped
 * any term without them, rejected the one profile the app ships. A validator
 * that refuses its own reference data is measuring the wrong thing — see
 * [CLAUDE.md](../../../CLAUDE.md) on probes that convict the innocent.
 *
 * What is checked is that a date which *is* there is a real one. A term is
 * never dropped over a single bad date, because that would take thirty good
 * deadlines with it; the bad date is blanked and named, and the term loads.
 */
function readCalendar(raw: unknown, problems: PackProblem[]): TermCalendar[] | undefined {
  if (raw === undefined) return undefined;
  if (!Array.isArray(raw)) {
    problems.push({ where: 'Academic calendar', says: 'The academic calendar is not a list of terms, so none of it was read.', severity: 'dropped' });
    return undefined;
  }

  const rows = raw.slice(0, CAPS.terms);
  if (raw.length > CAPS.terms) {
    problems.push({ where: 'Academic calendar', says: `${raw.length} terms were sent and the first ${CAPS.terms} were read.`, severity: 'dropped' });
  }

  const terms: TermCalendar[] = [];
  rows.forEach((value, index) => {
    const at = `Term ${index + 1}`;
    if (!value || typeof value !== 'object') {
      problems.push({ where: at, says: 'This term is not a record, so it was left out.', severity: 'dropped' });
      return;
    }
    const t = value as Record<string, unknown>;
    const termName = text(t.termName, 80);
    const where = termName || at;

    if (!termName) {
      problems.push({ where: at, says: 'This term has no name, so it was left out — a term is shown by its name everywhere it appears.', severity: 'dropped' });
      return;
    }
    // Absent is fine and means "not published". Present-but-unreal is a
    // mistake, and is blanked rather than kept.
    const bound = (key: 'startsOn' | 'endsOn'): string => {
      if (t[key] === undefined || text(t[key], 40) === '') return '';
      const iso = isoDate(t[key]);
      if (iso) return iso;
      problems.push({ where, says: `Its ${key} is not a real date, so it was left blank. Dates are written YYYY-MM-DD.`, severity: 'dropped' });
      return '';
    };
    let startsOn = bound('startsOn');
    let endsOn = bound('endsOn');
    if (startsOn && endsOn && endsOn < startsOn) {
      problems.push({ where, says: `This term ends on ${endsOn}, before it starts on ${startsOn}, so both bounds were left blank.`, severity: 'dropped' });
      startsOn = '';
      endsOn = '';
    }

    const term: TermCalendar = { termName, startsOn, endsOn, deadlines: [] };

    // Deadlines are deliberately *not* checked against the term's own span.
    // Registration for the next term opens inside this one, and final grades
    // are due after the last class day — both are real, both sit outside, and
    // a range check here would drop the two dates a student most needs.
    const deadlines = Array.isArray(t.deadlines) ? t.deadlines : [];
    if (t.deadlines !== undefined && !Array.isArray(t.deadlines)) {
      problems.push({ where, says: 'Its deadlines are not a list, so this term loaded with none.', severity: 'dropped' });
    }
    if (deadlines.length > CAPS.deadlines) {
      problems.push({ where, says: `${deadlines.length} deadlines were sent and the first ${CAPS.deadlines} were read.`, severity: 'dropped' });
    }
    deadlines.slice(0, CAPS.deadlines).forEach((d, i) => {
      const row = (d && typeof d === 'object' ? d : {}) as Record<string, unknown>;
      const label = text(row.label, 120);
      const on = isoDate(row.on);
      if (label && on) {
        term.deadlines.push({ label, on });
        return;
      }
      problems.push({
        where: `${where} · ${label || `deadline ${i + 1}`}`,
        says: label
          ? 'This deadline has no usable date, so it was left out. Dates are written YYYY-MM-DD.'
          : 'This deadline has no label, so it was left out — an unlabelled date cannot be shown.',
        severity: 'dropped',
      });
    });

    const breaks = Array.isArray(t.breaks) ? t.breaks.slice(0, CAPS.breaks) : [];
    const kept: { label: string; from: string; to: string }[] = [];
    breaks.forEach((b, i) => {
      const row = (b && typeof b === 'object' ? b : {}) as Record<string, unknown>;
      const label = text(row.label, 120);
      const from = isoDate(row.from);
      const to = isoDate(row.to);
      if (label && from && to && to >= from) {
        kept.push({ label, from, to });
        return;
      }
      problems.push({
        where: `${where} · ${label || `break ${i + 1}`}`,
        says: to && from && to < from
          ? `This break was left out: it ends on ${to}, before it starts on ${from}.`
          : 'This break was left out: it needs a label and a from and to date written YYYY-MM-DD.',
        severity: 'dropped',
      });
    });
    if (kept.length) term.breaks = kept;

    const finalsFrom = isoDate(t.finalsFrom);
    const finalsTo = isoDate(t.finalsTo);
    if (finalsFrom && finalsTo && finalsTo >= finalsFrom) {
      term.finalsFrom = finalsFrom;
      term.finalsTo = finalsTo;
    } else if (t.finalsFrom !== undefined || t.finalsTo !== undefined) {
      problems.push({ where, says: 'The exam window was left out: it needs finalsFrom and finalsTo as real dates, in that order.', severity: 'dropped' });
    }

    terms.push(term);
  });

  return terms.length ? terms : undefined;
}

/**
 * The buildings, for the map.
 *
 * Exactly (0, 0) is refused along with the out-of-range values. It is inside
 * every range check that would be written here and it is not a campus — it is
 * the Gulf of Guinea, and it is what an empty spreadsheet cell becomes when a
 * column of coordinates is exported as numbers. A pin dropped in the ocean is
 * the one failure a student cannot read as missing data.
 */
function readBuildings(raw: unknown, problems: PackProblem[]): SchoolData['buildings'] {
  if (raw === undefined) return undefined;
  if (!Array.isArray(raw)) {
    problems.push({ where: 'Buildings', says: 'The buildings are not a list, so none of them were read.', severity: 'dropped' });
    return undefined;
  }
  if (raw.length > CAPS.buildings) {
    problems.push({ where: 'Buildings', says: `${raw.length} buildings were sent and the first ${CAPS.buildings} were read.`, severity: 'dropped' });
  }

  const out: NonNullable<SchoolData['buildings']> = [];
  raw.slice(0, CAPS.buildings).forEach((value, index) => {
    const row = (value && typeof value === 'object' ? value : {}) as Record<string, unknown>;
    const name = text(row.name, 120);
    const where = name || `Building ${index + 1}`;
    if (!name) {
      problems.push({ where, says: 'This building has no name, so it was left out.', severity: 'dropped' });
      return;
    }
    const lat = row.lat;
    const lng = row.lng;
    const ok =
      typeof lat === 'number' && Number.isFinite(lat) && lat >= -90 && lat <= 90 &&
      typeof lng === 'number' && Number.isFinite(lng) && lng >= -180 && lng <= 180;
    if (!ok) {
      problems.push({ where, says: 'This building was left out: lat must be a number between −90 and 90, and lng between −180 and 180.', severity: 'dropped' });
      return;
    }
    if (lat === 0 && lng === 0) {
      problems.push({ where, says: 'This building was left out: its coordinates are 0, 0, which is a blank column rather than a place.', severity: 'dropped' });
      return;
    }
    const abbr = text(row.abbr, 20);
    out.push(abbr ? { name, abbr, lat, lng } : { name, lat, lng });
  });

  return out.length ? out : undefined;
}

/**
 * The meal plan tiers.
 *
 * A tier whose price is missing is dropped rather than priced at zero. The
 * Meals screen does arithmetic with these, and a plan the app believes is
 * free is a worse answer than a plan the app does not have.
 */
function readTiers(raw: unknown, problems: PackProblem[]): SchoolData['mealPlanTiers'] {
  if (raw === undefined) return undefined;
  if (!Array.isArray(raw)) {
    problems.push({ where: 'Meal plans', says: 'The meal plans are not a list, so none of them were read.', severity: 'dropped' });
    return undefined;
  }

  const out: NonNullable<SchoolData['mealPlanTiers']> = [];
  raw.slice(0, CAPS.tiers).forEach((value, index) => {
    const row = (value && typeof value === 'object' ? value : {}) as Record<string, unknown>;
    const name = text(row.name, 120);
    const where = name || `Meal plan ${index + 1}`;
    if (!name) {
      problems.push({ where, says: 'This meal plan has no name, so it was left out.', severity: 'dropped' });
      return;
    }
    const num = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) && v >= 0 ? v : null);
    const swipes = num(row.swipes);
    const dollars = num(row.dollars);
    if (swipes === null || dollars === null) {
      problems.push({ where, says: 'This meal plan was left out: swipes and dollars must both be numbers of zero or more. A missing price is not zero.', severity: 'dropped' });
      return;
    }
    const period = row.period;
    if (period !== 'week' && period !== 'term') {
      problems.push({ where, says: 'This meal plan was left out: period must be "week" or "term".', severity: 'dropped' });
      return;
    }
    out.push({ name, swipes, dollars, period });
  });

  return out.length ? out : undefined;
}

/** When the room has to be empty — a named rule, not a Vanderbilt fact. */
function readHousing(raw: unknown, problems: PackProblem[]): SchoolData['housing'] {
  if (raw === undefined) return undefined;
  const row = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  const rule = row.moveOutRule;

  if (rule === 'fixed_date') {
    const fixedDate = isoDate(row.fixedDate);
    if (!fixedDate) {
      problems.push({ where: 'Move-out', says: 'The move-out rule was left out: a fixed date needs fixedDate written YYYY-MM-DD.', severity: 'dropped' });
      return undefined;
    }
    return { moveOutRule: 'fixed_date', fixedDate };
  }

  if (rule === 'hours_after_last_exam') {
    const hours = row.hoursAfterLastExam;
    if (hours === undefined) return { moveOutRule: 'hours_after_last_exam' };
    // 720 hours is thirty days. Beyond that it is not a move-out rule, it is a
    // unit error — somebody sent minutes.
    if (typeof hours !== 'number' || !Number.isFinite(hours) || hours <= 0 || hours > 720) {
      problems.push({ where: 'Move-out', says: 'hoursAfterLastExam must be a number of hours between 1 and 720, so the app fell back to 24.', severity: 'dropped' });
      return { moveOutRule: 'hours_after_last_exam' };
    }
    return { moveOutRule: 'hours_after_last_exam', hoursAfterLastExam: hours };
  }

  problems.push({ where: 'Move-out', says: 'The move-out rule was left out: moveOutRule must be "fixed_date" or "hours_after_last_exam".', severity: 'dropped' });
  return undefined;
}

/**
 * The addresses a profile carries, each named the way the list around it
 * names things.
 *
 * `where` is read next to "Buttrick Hall" and "Fall 2026 · Last day to drop",
 * so a row reading `lmsUrl` is the one line in that list written for a
 * developer. Driving the import with a bad address is what showed it: the
 * building's problem read as a sentence about a building and the link's read
 * as a sentence about a variable.
 */
const ADDRESSES: [keyof Capabilities, string][] = [
  ['registrarUrl', 'The registrar’s address'],
  ['orgPortalUrl', 'The student organisations portal'],
  ['lmsUrl', 'The course site’s address'],
  ['lmsIcsHelpUrl', 'The calendar feed help page'],
  ['libraryUrl', 'The library’s address'],
  ['healthUrl', 'The student health address'],
  ['advisingUrl', 'The advising address'],
];

/**
 * The capability flags and the names and addresses that go with them.
 *
 * The values come from `readCapabilities`, which is the one place that
 * decides what a capability row means. This pass runs beside it only to
 * *report* — a URL that reader silently drops is a link a partner filled in
 * and will never see on a screen, and being told is the whole difference
 * between a file and a form.
 */
function readCaps(raw: unknown, problems: PackProblem[]): Capabilities {
  const caps = readCapabilities(raw);
  if (!raw || typeof raw !== 'object') {
    if (raw !== undefined) {
      problems.push({ where: 'Capabilities', says: 'The capabilities are not a record, so every screen that needs one stays switched off.', severity: 'dropped' });
    }
    return caps;
  }
  const c = raw as Record<string, unknown>;

  for (const [key, what] of ADDRESSES) {
    const given = text(c[key], 400);
    if (given && !isLink(given)) {
      problems.push({ where: what, says: `This address was left out: it must begin with https:// — "${given.slice(0, 60)}" does not.`, severity: 'dropped' });
    }
  }

  if (c.mealPlan !== undefined && !['swipes', 'dollars', 'both', 'none'].includes(c.mealPlan as string)) {
    problems.push({ where: 'Meal plan', says: 'mealPlan must be "swipes", "dollars", "both" or "none", so the meal screen stays switched off.', severity: 'dropped' });
  }
  if (c.housing !== undefined && typeof c.housing !== 'boolean') {
    problems.push({ where: 'Housing', says: 'housing must be true or false, so the housing screen stays switched off.', severity: 'dropped' });
  }
  if (c.campusMap !== undefined && typeof c.campusMap !== 'boolean') {
    problems.push({ where: 'Campus map', says: 'campusMap must be true or false, so the map stays switched off.', severity: 'dropped' });
  }

  return caps;
}

// ── The whole file ──────────────────────────────────────────────────────

const refusal = (says: string): PackRead => ({
  ok: false,
  school: null,
  importedAt: '',
  problems: [{ where: 'The file', says, severity: 'refused' }],
  counts: { terms: 0, deadlines: 0, buildings: 0, tiers: 0, domains: 0 },
});

/**
 * Read a pack, and say everything that was wrong with it.
 *
 * Never throws. A file somebody was emailed is exactly the input that arrives
 * truncated, double-encoded, or saved out of a spreadsheet as something else
 * entirely, and every one of those has to come back as a sentence rather than
 * as a stack trace under a screen that has gone blank.
 */
export function readPack(source: string): PackRead {
  if (typeof source !== 'string' || !source.trim()) {
    return refusal('That file is empty.');
  }
  if (source.length > MAX_BYTES) {
    return refusal('Use a pack smaller than 4 MB. A campus of two thousand buildings is about two hundred kilobytes, so a file this size is usually something other than a school pack.');
  }

  let raw: unknown;
  try {
    raw = JSON.parse(source);
  } catch {
    return refusal('That file is not valid JSON. Export it again from whatever produced it, rather than copying it out of a document.');
  }
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return refusal('A school pack is a single JSON record, and this file is not one.');
  }

  const obj = raw as Record<string, unknown>;
  const version = obj.semesterSchoolPack;
  if (version === undefined) {
    return refusal('This file does not say it is a Semester school pack. The first line should read "semesterSchoolPack": 1.');
  }
  if (typeof version !== 'number' || !Number.isInteger(version) || version < 1) {
    return refusal('The semesterSchoolPack version is not a whole number, so this file cannot be read.');
  }
  if (version > PACK_VERSION) {
    return refusal(`This pack was written for a newer version of Semester — it says version ${version} and this copy reads version ${PACK_VERSION}. Update the app, or ask for a version ${PACK_VERSION} pack.`);
  }

  const name = text(obj.name, 90);
  if (!name) {
    return refusal('This pack has no school name, and the name is what every screen shows. Add a "name".');
  }

  const problems: PackProblem[] = [];
  const dataRaw = (obj.data && typeof obj.data === 'object' ? obj.data : {}) as Record<string, unknown>;
  if (obj.data !== undefined && (typeof obj.data !== 'object' || obj.data === null || Array.isArray(obj.data))) {
    problems.push({ where: 'Data', says: 'The data section is not a record, so the calendar, buildings and meal plans were all left out.', severity: 'dropped' });
  }

  const data: SchoolData = {};
  const academicCalendar = readCalendar(dataRaw.academicCalendar, problems);
  if (academicCalendar) data.academicCalendar = academicCalendar;
  const buildings = readBuildings(dataRaw.buildings, problems);
  if (buildings) data.buildings = buildings;
  const mealPlanTiers = readTiers(dataRaw.mealPlanTiers, problems);
  if (mealPlanTiers) data.mealPlanTiers = mealPlanTiers;
  const housing = readHousing(dataRaw.housing, problems);
  if (housing) data.housing = housing;

  const gradingNotes = text(dataRaw.gradingNotes, 2000);
  if (gradingNotes) data.gradingNotes = gradingNotes;

  // The one branch that is not inert. Everything else in `data` draws one
  // fewer pin when it is wrong; this decides what the app tells somebody they
  // need on the final, so a malformed one is named rather than dropped quietly.
  if (dataRaw.gradeSystem !== undefined) {
    const scale = readGradeSystem(dataRaw.gradeSystem);
    if (scale) data.gradeSystem = scale;
    else problems.push({ where: 'Grading scale', says: 'The grading scale could not be read, so the app uses the common table and says it is an assumption. A scale needs a kind of "letter", "percent", "points" or "custom".', severity: 'dropped' });
  }

  const feed = text(dataRaw.athleticsFeedUrl, 400);
  if (feed && isLink(feed)) data.athleticsFeedUrl = feed;
  else if (feed) problems.push({ where: 'athleticsFeedUrl', says: 'The athletics feed was left out: it must begin with https://.', severity: 'dropped' });

  const domainsRaw = Array.isArray(obj.emailDomains) ? obj.emailDomains : [];
  const emailDomains = domainsRaw
    .map((d) => text(d, 80).toLowerCase().replace(/^@+/, ''))
    .filter((d) => d !== '')
    .slice(0, CAPS.domains);

  const school: School = {
    id: packId(obj.id, name),
    name,
    shortName: text(obj.shortName, 60) || undefined,
    emailDomains: emailDomains.length ? emailDomains : undefined,
    capabilities: readCaps(obj.capabilities, problems),
    data,
    // Never from the file. See this module's header.
    verified: false,
  };

  const importedAt = isoDate(obj.importedAt) ?? '';
  if (!importedAt) {
    problems.push({ where: 'The file', says: 'This pack does not say when it was written, so the app cannot tell you how old these dates are. Add an "importedAt" written YYYY-MM-DD.', severity: 'dropped' });
  }

  return {
    ok: true,
    school,
    importedAt,
    problems,
    counts: {
      terms: data.academicCalendar?.length ?? 0,
      deadlines: (data.academicCalendar ?? []).reduce((n, t) => n + t.deadlines.length, 0),
      buildings: data.buildings?.length ?? 0,
      tiers: data.mealPlanTiers?.length ?? 0,
      domains: emailDomains.length,
    },
  };
}

// ── Writing one ─────────────────────────────────────────────────────────

/**
 * A school, back out as a pack.
 *
 * Two jobs, and the second is the one that makes this worth writing. The
 * first is an export. The second is that a partner who is about to fill in a
 * pack should be handed one that is already most of the way there — the six
 * addresses, the flags, whatever calendar the app has — so the task is
 * correcting a file rather than authoring one from a specification.
 *
 * Empty branches are left out rather than written as `null`, because a person
 * opens this in an editor and a file of nulls reads as broken.
 */
export function writePack(school: School, writtenOn: string = ''): string {
  const caps: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(school.capabilities)) {
    if (v !== undefined && v !== '' && v !== false) caps[k] = v;
  }
  // The two that mean something when false, so they are always written: a
  // reader has to be able to tell "this school has no map" from "nobody said".
  caps.housing = school.capabilities.housing;
  caps.campusMap = school.capabilities.campusMap;
  caps.mealPlan = school.capabilities.mealPlan;

  const out: Record<string, unknown> = {
    semesterSchoolPack: PACK_VERSION,
    id: school.id,
    name: school.name,
  };
  if (school.shortName) out.shortName = school.shortName;
  if (school.emailDomains?.length) out.emailDomains = school.emailDomains;
  out.importedAt = isoDate(writtenOn) ?? new Date().toISOString().slice(0, 10);
  out.capabilities = caps;
  if (Object.keys(school.data).length) out.data = school.data;

  return `${JSON.stringify(out, null, 2)}\n`;
}

/**
 * Something to fill in, for a school that has nothing yet.
 *
 * Every value is obviously a placeholder. A template whose example values
 * could be mistaken for real ones is how a fictional meal plan reaches a
 * screen — the same reason `lib/registration.ts` writes "replace this row"
 * into its catalogue template.
 */
export const PACK_TEMPLATE = {
  semesterSchoolPack: PACK_VERSION,
  id: 'example-university',
  name: 'Example University — replace with your institution',
  shortName: 'Example',
  emailDomains: ['example.edu'],
  importedAt: '2026-08-01',
  capabilities: {
    mealPlan: 'both',
    cardName: 'Example Cash — what the card money is called here',
    swipeUnit: 'meal swipes',
    housing: true,
    campusMap: true,
    registrarName: 'The name students call the registrar system',
    registrarUrl: 'https://registrar.example.edu',
    orgPortalName: 'The name of the student organisations portal',
    orgPortalUrl: 'https://orgs.example.edu',
    lmsName: 'The name of the course site',
    lmsUrl: 'https://lms.example.edu',
    lmsIcsHelpUrl: 'https://lms.example.edu/help/calendar-feed',
    athleticsName: 'The teams are called this',
    libraryUrl: 'https://library.example.edu',
    healthUrl: 'https://health.example.edu',
    advisingUrl: 'https://advising.example.edu',
  },
  data: {
    academicCalendar: [
      {
        termName: 'Fall 2026 — replace this term',
        startsOn: '2026-08-26',
        endsOn: '2026-12-11',
        finalsFrom: '2026-12-05',
        finalsTo: '2026-12-11',
        deadlines: [
          { label: 'Last day to drop without a W', on: '2026-09-04' },
          { label: 'Last day to withdraw from a course', on: '2026-10-30' },
        ],
        breaks: [{ label: 'Fall Break', from: '2026-10-22', to: '2026-10-23' }],
      },
    ],
    buildings: [{ name: 'Example Hall — replace this row', abbr: 'EXH', lat: 36.1447, lng: -86.8027 }],
    mealPlanTiers: [{ name: 'Example Plan — replace this row', swipes: 300, dollars: 250, period: 'term' }],
    housing: { moveOutRule: 'hours_after_last_exam', hoursAfterLastExam: 24 },
    gradingNotes: 'Anything about grading this school publishes and a student should know.',
  },
};

// ── Coming back off the device ──────────────────────────────────────────

/**
 * A loaded pack, read back out of storage.
 *
 * Lenient, and deliberately so — this is the app reading what the app itself
 * wrote, which is the case `readSchool` exists for, not a file somebody was
 * emailed. `readPack` is the loud one and it already ran, at import, with a
 * person looking at its problems. Running it again on every launch would
 * re-report problems about a decision that was made months ago.
 */
export function readSchoolPack(raw: unknown): { school: School; importedAt: string } | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;
  const school = readSchool(r.school);
  if (!school.id || !school.name) return null;
  return { school: { ...school, verified: false }, importedAt: isoDate(r.importedAt) ?? '' };
}
