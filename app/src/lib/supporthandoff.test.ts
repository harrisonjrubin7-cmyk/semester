import { describe, expect, it } from 'vitest';
import { CATEGORIES, CONTEXT_KEYS } from './supporttickets';
import { takeOrigin } from './tickethandoff';
import { HANDOFF_SURFACES, TICKET_ARG_KEYS, noteSupportAsk, supportAsk, ticketFromAsk } from './supporthandoff';

/**
 * A ticket from registration readiness or the gradebook carries a category
 * and none of the record sitting on the screen.
 *
 * Shown red by spreading `available` straight into `want_context`: the
 * score, hold, section, seats and student id then travel, and this file fails.
 */

const RECORD = {
  score: '87 of 100',
  hold: 'bursar hold',
  section: 'ECON 1020-01',
  seats: '12 of 30',
  gpa: '3.41',
  studentId: 'ben-0002-bbbb',
};

describe('a support handoff from readiness and the gradebook', () => {
  it('carries a category and drops every record field, even when the caller has one', () => {
    for (const surface of HANDOFF_SURFACES) {
      const args = ticketFromAsk(
        surface,
        '  Help with the app  ',
        '  I cannot tell what Semester can see.  ',
        { screen: supportAsk(surface).origin.hash, ...RECORD } as Partial<Record<(typeof CONTEXT_KEYS)[number], string>>,
        new Set(['screen']),
      );
      expect(CATEGORIES).toContain(args.want_category);
      expect(args.want_category).toBe('how_to');
      expect(Object.keys(args).sort()).toEqual([...TICKET_ARG_KEYS].sort());
      expect(args.want_subject).toBe('Help with the app');
      expect(args.want_body).toBe('I cannot tell what Semester can see.');
      expect(args.want_email_notice).toBe(false);
      expect(args.want_context).toEqual({ screen: supportAsk(surface).origin.hash });
      const packed = JSON.stringify(args);
      for (const value of Object.values(RECORD)) expect(packed, surface).not.toContain(value);
    }
  });

  it('notes a fixed origin Help can read, with no score, hold or section in it', () => {
    noteSupportAsk('gradebook');
    const origin = takeOrigin();
    expect(origin).toEqual({
      hash: '#/gradebook',
      action: 'Looking at the gradebook',
      reference: null,
    });
    const packed = JSON.stringify(origin);
    for (const value of Object.values(RECORD)) expect(packed).not.toContain(value);
    expect(takeOrigin()).toBeNull();
  });

  it('notes registration readiness the same way', () => {
    noteSupportAsk('registration_readiness');
    expect(takeOrigin()).toEqual({
      hash: '#/registration',
      action: 'Registration is not turned on in Semester',
      reference: null,
    });
  });
});
