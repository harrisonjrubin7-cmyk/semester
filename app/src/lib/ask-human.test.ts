import { describe, expect, it } from 'vitest';
import { ASK_NEED_IDS, URGENT_SAFETY_TEXT, askNeedById, needs } from './ask-human';
import { DIRECTORY_ONLY, NEEDS, needById } from './help-routes';

describe('ask a human', () => {
  it('says what it is not, word for word', () => {
    expect(URGENT_SAFETY_TEXT).toBe(
      'Semester is not emergency support. If you are in immediate danger or need urgent help, contact local emergency services or your institution’s emergency resource.',
    );
  });

  it('lists the ten needs, in order', () => {
    expect(needs().map((n) => n.label)).toEqual([
      'Academic planning',
      'Course content',
      'Tutoring',
      'Career',
      'Financial information',
      'Housing and dining',
      'Accessibility accommodations',
      'Personal support',
      'Technology',
      'Something else',
    ]);
    expect(needs().map((n) => n.id)).toEqual([...ASK_NEED_IDS]);
  });

  it('maps every need onto a route that already exists, and invents no office', () => {
    const routes = new Set(NEEDS.map((n) => n.id));
    for (const n of needs()) {
      expect(routes.has(n.route), n.id).toBe(true);
      if (n.kind) expect(needById(n.route).kinds, n.id).toContain(n.kind);
    }
  });

  it('answers all five questions for every need', () => {
    for (const n of needs()) {
      expect(n.why.length, n.id).toBeGreaterThan(20);
      expect(n.contact.length, n.id).toBeGreaterThan(2);
      expect(n.officialSource.length, n.id).toBeGreaterThan(10);
      expect(n.appointmentPrep.length, n.id).toBeGreaterThan(0);
      expect(Array.isArray(n.documents), n.id).toBe(true);
    }
    for (const n of needs().filter((x) => x.id !== 'personal_support')) expect(n.documents.length, n.id).toBeGreaterThan(0);
  });

  it('keeps the sensitive needs directory-only, as the routes have them', () => {
    for (const id of ['accessibility_accommodations', 'financial_information', 'personal_support'] as const) {
      expect(askNeedById(id).directoryOnly, id).toBe(true);
    }
    for (const n of needs()) expect(n.directoryOnly, n.id).toBe(needById(n.route).directoryOnly);
    expect(DIRECTORY_ONLY.has('financial_aid')).toBe(true);
    expect(askNeedById('tutoring').directoryOnly).toBe(false);
  });

  it('sends tutoring to the tutoring office and course content to the instructor', () => {
    expect(askNeedById('tutoring').contact).toBe('Tutoring');
    expect(askNeedById('course_content').contact).toBe('Instructor or TA office hours');
  });

  it('puts the emergency sentence with personal support and nowhere it is not needed', () => {
    expect(askNeedById('personal_support').urgentText).toBe(URGENT_SAFETY_TEXT);
    expect(needs().filter((n) => n.urgentText !== null).map((n) => n.id)).toEqual(['personal_support']);
  });

  it('is the same list for everyone: no input, so nothing about the student can reorder it', () => {
    expect(needs()).toEqual(needs());
    expect(needs.length).toBe(0);
  });
});
