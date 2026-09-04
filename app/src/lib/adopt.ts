/**
 * The first time you sign in, and the moment this whole feature can ruin a term.
 *
 * Everything else about sync is recoverable. This is not: a student who has
 * been using the app all semester signs in for the first time, and if the app
 * treats the empty account as the truth then a term of work is gone before
 * they have finished reading the welcome message.
 *
 * So the rule is that existing data is adopted, never replaced.
 *
 * ## Three cases, and only one of them is a question
 *
 * Nothing in the account and something on the device: upload it. That is not a
 * conflict, it is what signing in is *for*, and asking would be asking somebody
 * to authorise the obvious.
 *
 * Nothing on the device and something in the account: pull it. Same reasoning.
 *
 * Both: ask. The app merges by default and the merge is a union — nothing
 * either side has is dropped — but "merge" is still a decision about somebody's
 * coursework and there are real reasons to want one side instead. A student who
 * has been testing on a spare phone wants the account. One who has just been
 * signed out for a week wants the device.
 *
 * ## Nothing overwrites anything without a file first
 *
 * The two options that are not a merge can lose data by definition. Before
 * either runs, a backup of what is on the device is written to a file the
 * student keeps. It costs a moment and it is the difference between a mistake
 * and a disaster.
 *
 * ## Merge is the default, and it is pre-selected
 *
 * Because it is the only one of the three that cannot lose anything, and
 * because a dialogue whose safe option is the second one is a dialogue that
 * will eventually be clicked through to the dangerous one.
 */

/** How much there is on each side. Counted, not compared. */
export interface Sides {
  /** Rows in the account: courses, notes, tasks, everything. */
  cloud: number;
  /** Rows on this device. */
  local: number;
  /** Courses on each side, for the sentence — a count of rows means nothing. */
  cloudCourses: number;
  localCourses: number;
}

export type Choice = 'merge' | 'cloud' | 'device';

export type Move =
  /** Nothing in the account. Send what is here. */
  | { do: 'upload'; say: string }
  /** Nothing here. Take what is there. */
  | { do: 'pull'; say: string }
  /** Both. Ask, and default to the one that cannot lose anything. */
  | { do: 'ask'; say: string }
  /** Nothing anywhere. A new account on a new device. */
  | { do: 'nothing'; say: string };

const s = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

/** What to do, and what to say about it. */
export function decide(sides: Sides): Move {
  const { cloud, local, cloudCourses, localCourses } = sides;

  if (cloud === 0 && local === 0) {
    return { do: 'nothing', say: 'Signed in. Nothing to bring across yet.' };
  }
  if (cloud === 0) {
    return {
      do: 'upload',
      say:
        localCourses > 0
          ? `Your ${s(localCourses, 'course')} and everything with them are on your account now.`
          : 'Everything on this device is on your account now.',
    };
  }
  if (local === 0) {
    return {
      do: 'pull',
      say:
        cloudCourses > 0
          ? `Brought ${s(cloudCourses, 'course')} across from your account.`
          : 'Brought your account across to this device.',
    };
  }
  return {
    do: 'ask',
    say: `This device has ${s(localCourses, 'course')}. Your account has ${s(cloudCourses, 'course')}.`,
  };
}

/** Whether a choice can lose something, and therefore needs a file first. */
export function destructive(choice: Choice): boolean {
  return choice !== 'merge';
}

/** The default, which is the one that cannot lose anything. */
export const SAFEST: Choice = 'merge';

export interface Option {
  id: Choice;
  label: string;
  blurb: string;
}

/**
 * The three options, said plainly.
 *
 * Each names what it does to the *other* side, because that is the part
 * somebody is actually deciding and the part a vague label hides.
 */
export function options(sides: Sides): Option[] {
  return [
    {
      id: 'merge',
      label: 'Keep both',
      blurb:
        'Everything from this device and everything from your account, together. Nothing is dropped. Where the same note was edited in both places, the later edit wins.',
    },
    {
      id: 'cloud',
      label: 'Use the account',
      blurb: `This device's ${s(sides.localCourses, 'course')} and anything else only here is replaced by what your account holds. A backup file is saved first.`,
    },
    {
      id: 'device',
      label: 'Use this device',
      blurb: `Your account's ${s(sides.cloudCourses, 'course')} are replaced by what is on this device. A backup file is saved first.`,
    },
  ];
}

/** What to say once a choice has run. */
export function done(choice: Choice, sides: Sides): string {
  if (choice === 'merge') {
    return `Kept both. Your account and this device now hold the same ${s(
      Math.max(sides.cloudCourses, sides.localCourses),
      'course',
    )} or more, and nothing was dropped.`;
  }
  if (choice === 'cloud') {
    return `Took the account's copy. A backup of what was on this device was saved to your downloads first.`;
  }
  return `Kept this device's copy and replaced the account's. A backup was saved to your downloads first.`;
}

/** The backup's filename, so two in one day do not collide. */
export function backupName(at: number): string {
  const d = new Date(at);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `semester-before-sign-in-${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(
    d.getDate(),
  )}-${pad(d.getHours())}${pad(d.getMinutes())}.json`;
}

/**
 * How many rows a persisted state holds.
 *
 * Rows rather than bytes, and courses counted separately, because "4 courses"
 * is a thing a student recognises and "180 kB" is not. Arrays count their
 * length, records their keys, and everything else nothing — a setting is not a
 * row and a student who has only ever changed the accent should still be told
 * their device is empty.
 */
export function countRows(state: unknown): { rows: number; courses: number } {
  if (!state || typeof state !== 'object') return { rows: 0, courses: 0 };
  let rows = 0;
  let courses = 0;
  for (const [key, value] of Object.entries(state as Record<string, unknown>)) {
    if (Array.isArray(value)) {
      rows += value.length;
      if (key === 'courses') courses = value.length;
    } else if (value && typeof value === 'object') {
      rows += Object.keys(value).length;
    }
  }
  return { rows, courses };
}
