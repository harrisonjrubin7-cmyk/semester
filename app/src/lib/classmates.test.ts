import { describe, expect, it } from 'vitest';
import {
  cleanHandle,
  codeOf,
  eligible,
  explain,
  handleProblem,
  initials,
  normaliseCode,
  proves,
  roomKey,
  roomsFor,
  termLabel,
  termOf,
  whenSaid,
} from './classmates';
import { NO_SCHOOL, type School } from './school';

const vu: School = { ...NO_SCHOOL, id: 'vanderbilt', name: 'Vanderbilt', emailDomains: ['vanderbilt.edu'] };
const unlisted: School = { ...NO_SCHOOL, id: 'rice-university', name: 'Rice University' };

describe('eligible', () => {
  it('accepts an address at a domain the school lists, whatever its case', () => {
    expect(eligible('a.b@vanderbilt.edu', vu)).toBe(true);
    expect(eligible('A.B@Vanderbilt.EDU', vu)).toBe(true);
    expect(eligible('me@mail.vanderbilt.edu', vu)).toBe(true);
  });

  it('rejects everything else, including a lookalike', () => {
    expect(eligible('a@gmail.com', vu)).toBe(false);
    // The classic: a domain that merely ends with the right letters.
    expect(eligible('a@notvanderbilt.edu', vu)).toBe(false);
    expect(eligible('a@vanderbilt.edu.attacker.com', vu)).toBe(false);
  });

  it('admits any confirmed address at a school that lists none', () => {
    // The alternative is refusing the whole feature to every university but
    // one, which is what this used to do.
    expect(eligible('a@gmail.com', unlisted)).toBe(true);
    expect(eligible('a@rice.edu', unlisted)).toBe(true);
  });

  it('says on the screen which of the two is happening', () => {
    expect(proves(vu)).toContain('vanderbilt.edu');
    expect(proves(unlisted).toLowerCase()).toContain('no confirmed address domain');
    // Neither may claim it proves an enrolment. Nothing here can read a
    // registrar, and a room that implies a roster is the lie that matters.
    for (const said of [proves(vu), proves(unlisted), proves(null)]) {
      expect(said).toMatch(/say they are in|does not prove/i);
    }
  });

  it('is false for nothing rather than throwing', () => {
    expect(eligible(undefined, vu)).toBe(false);
    expect(eligible(null, vu)).toBe(false);
    expect(eligible('', vu)).toBe(false);
  });
});

describe('a room belongs to a school', () => {
  it('puts the school in the key', () => {
    // Without this, four universities' ECON 1020 become one room the moment
    // the domain gate comes off — a change that generalises the app by making
    // it worse.
    expect(roomKey('vanderbilt', 'econ1020')).toBe('vanderbilt/ECON 1020');
    expect(roomKey('rice-university', 'ECON 1020')).toBe('rice-university/ECON 1020');
    expect(roomKey('vanderbilt', 'ECON 1020')).not.toBe(roomKey('rice-university', 'ECON 1020'));
  });

  it('reads the course back out for the screen', () => {
    expect(codeOf('vanderbilt/ECON 1020')).toBe('ECON 1020');
    expect(codeOf('ECON 1020')).toBe('ECON 1020');
  });

  it('refuses a key for something that is not a course code', () => {
    expect(roomKey('vanderbilt', 'Reading group')).toBe('');
  });
});

describe('normaliseCode', () => {
  it('brings every spelling of a class to one string', () => {
    // Otherwise one lecture becomes three rooms with one person in each, and
    // everybody concludes nobody else is in the class.
    for (const written of ['ECON 1020', 'econ1020', 'Econ-1020', '  econ  1020 ', 'ECON.1020']) {
      expect(normaliseCode(written)).toBe('ECON 1020');
    }
  });

  it('keeps a letter suffix, which distinguishes real courses', () => {
    expect(normaliseCode('psci 1104W')).toBe('PSCI 1104W');
  });

  it('takes the code out of a longer title', () => {
    expect(normaliseCode('ECON 1020 — Principles of Macroeconomics')).toBe('ECON 1020');
  });

  it('is empty for what is not a course code, rather than guessing', () => {
    // A room called "MYECON HW3" that one person can find is worse than being
    // asked to type it again.
    expect(normaliseCode('my econ homework')).toBe('');
    expect(normaliseCode('1020')).toBe('');
    expect(normaliseCode('')).toBe('');
  });
});

describe('termOf', () => {
  it('splits the year the way an academic calendar does', () => {
    expect(termOf(new Date(2026, 8, 3))).toBe('2026FA');
    expect(termOf(new Date(2026, 1, 3))).toBe('2026SP');
    expect(termOf(new Date(2026, 5, 3))).toBe('2026SU');
  });

  it('puts August in the autumn and April in the spring', () => {
    expect(termOf(new Date(2026, 7, 1))).toBe('2026FA');
    expect(termOf(new Date(2026, 3, 30))).toBe('2026SP');
  });
});

describe('termLabel', () => {
  it('reads as a term', () => {
    expect(termLabel('2026FA')).toBe('Fall 2026');
    expect(termLabel('2027SP')).toBe('Spring 2027');
  });

  it('passes anything it does not recognise straight through', () => {
    expect(termLabel('whenever')).toBe('whenever');
  });
});

describe('handleProblem', () => {
  it('is silent about a good name', () => {
    expect(handleProblem('Harrison R')).toBe('');
  });

  it('refuses an email, which is the thing people paste without thinking', () => {
    expect(handleProblem('me@vanderbilt.edu')).toContain('Not your email');
  });

  it('refuses one character', () => {
    expect(handleProblem('H')).toContain('two characters');
  });
});

describe('cleanHandle', () => {
  it('collapses whitespace and strips angle brackets', () => {
    expect(cleanHandle('  Harrison   R  ')).toBe('Harrison R');
    expect(cleanHandle('<b>H</b>')).toBe('bH/b');
  });

  it('cuts a very long name rather than letting it break a row', () => {
    expect(cleanHandle('x'.repeat(80))).toHaveLength(40);
  });
});

describe('initials', () => {
  it('takes the first and last', () => {
    expect(initials('Harrison Rubin')).toBe('HR');
    expect(initials('Ada')).toBe('AD');
  });

  it('has something to show for an empty name', () => {
    expect(initials('')).toBe('?');
  });
});

describe('whenSaid', () => {
  const now = new Date(2026, 8, 3, 15, 0);

  it('shows only a time for today', () => {
    expect(whenSaid(new Date(2026, 8, 3, 15, 42).toISOString(), now)).toBe('3:42p');
  });

  it('adds the day once it is not today', () => {
    expect(whenSaid(new Date(2026, 8, 1, 9, 5).toISOString(), now)).toBe('Tue 9:05a');
  });

  it('gets midnight and noon right', () => {
    expect(whenSaid(new Date(2026, 8, 3, 0, 5).toISOString(), now)).toBe('12:05a');
    expect(whenSaid(new Date(2026, 8, 3, 12, 5).toISOString(), now)).toBe('12:05p');
  });

  it('is empty for a date it cannot read', () => {
    expect(whenSaid('nonsense')).toBe('');
  });
});

describe('roomsFor', () => {
  it('offers your courses, marking the ones you are in', () => {
    // Offered rather than joined: being in a room tells other people you take
    // that class, which should be a thing you did.
    expect(roomsFor(['ECON 1020', 'psci1104'], ['vanderbilt/ECON 1020'], 'vanderbilt')).toEqual([
      { key: 'vanderbilt/ECON 1020', code: 'ECON 1020', joined: true },
      { key: 'vanderbilt/PSCI 1104', code: 'PSCI 1104', joined: false },
    ]);
  });

  it('keeps a room you joined that no course matches', () => {
    const rooms = roomsFor(['ECON 1020'], ['vanderbilt/BUS 1600'], 'vanderbilt');
    expect(rooms).toContainEqual({ key: 'vanderbilt/BUS 1600', code: 'BUS 1600', joined: true });
  });

  it('does not mark you joined from another school’s room of the same name', () => {
    // The failure the key exists to stop, seen from the client.
    const rooms = roomsFor(['ECON 1020'], ['rice-university/ECON 1020'], 'vanderbilt');
    expect(rooms.find((r) => r.key === 'vanderbilt/ECON 1020')?.joined).toBe(false);
  });

  it('does not list the same class twice', () => {
    expect(roomsFor(['ECON 1020', 'econ 1020'], [], 'vanderbilt')).toHaveLength(1);
  });

  it('drops a course whose code cannot be read', () => {
    expect(roomsFor(['Reading group'], [], 'vanderbilt')).toEqual([]);
  });
});

describe('explain', () => {
  it('turns a policy refusal into the thing it almost always means', () => {
    const said = explain('new row violates row-level security policy for table "messages"');
    expect(said).toContain('not confirmed');
    expect(said).toContain('joined that class');
  });

  it('names the missing setup step', () => {
    expect(explain('relation "public.messages" does not exist')).toContain('classmates.sql');
  });

  it('passes an error it has nothing to add to straight through', () => {
    expect(explain('connection reset')).toBe('connection reset');
  });
});
