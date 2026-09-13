import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { roomKey } from './classmates';

/**
 * Every screen that talks to a room-keyed table sends the key, not the code.
 *
 * `classmates-schools.sql` made a room belong to a school: the key is
 * `vanderbilt/BUS 1600`, because `BUS 1600` on its own would put four
 * universities' classes in one room. `enrollments.code` is the column every
 * policy compares against, and it carries the school.
 *
 * The Groupwork screen did not. It handed `groupsIn` and `startGroup` the bare
 * code off the course picker, and the failure was the quiet kind: the policies
 * on `groups` all gate on `in_class(term, code)`, so a bare code matched no
 * enrolment row, the list came back empty for a class you are in, and starting
 * a group was refused by a policy you satisfy. Nothing threw. The screen said
 * "None yet" about a class with groups in it.
 *
 * A type cannot catch this — both halves are `string` — so it is caught by
 * reading the screens. Any screen that calls one of these functions has to get
 * its first course argument from `roomKey`, which is the only thing that puts
 * the school in.
 */

/** The calls whose `code` argument the database compares against enrolments. */
const ROOM_KEYED = ['groupsIn', 'startGroup'];

const SCREENS = ['src/screens/Groupwork.tsx', 'src/screens/Classmates.tsx'];

describe('a room key, not a course code', () => {
  it('builds the key out of the school and the code', () => {
    expect(roomKey('vanderbilt', 'BUS 1600')).toBe('vanderbilt/BUS 1600');
    // The enrolment rows are written in this shape, and the check constraint
    // in classmates-schools.sql only accepts this shape.
    expect(roomKey('vanderbilt', 'bus1600')).toMatch(/^[a-z0-9][a-z0-9-]*\/[A-Z]{2,4} \d{3,4}[A-Z]?$/);
  });

  for (const path of SCREENS) {
    it(`${path} keys its room calls by school`, () => {
      const source = readFileSync(new URL(`../../${path}`, import.meta.url), 'utf8');

      for (const fn of ROOM_KEYED) {
        // `groupsIn(term, code)` — the second argument is the room.
        const calls = [...source.matchAll(new RegExp(`\\b${fn}\\(([^)]*)\\)`, 'g'))];
        for (const call of calls) {
          const args = call[1].split(',').map((a) => a.trim());
          // startGroup takes the account first; groupsIn does not. Either way
          // the room is the argument straight after the term.
          const room = args[args.indexOf('term') + 1];
          expect(
            room,
            `${fn} in ${path} is passed "${room}", which is not a room key — see roomKey()`,
          ).toBe('room');
        }
      }

      // And whatever is named `room` is built by the one function that can.
      if (ROOM_KEYED.some((fn) => source.includes(`${fn}(`))) {
        expect(source).toMatch(/const room = roomKey\(/);
      }
    });
  }
});
