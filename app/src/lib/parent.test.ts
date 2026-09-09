import { describe, expect, it } from 'vitest';
import { courseFieldFor, insideCourse } from './parent';

describe('courseFieldFor', () => {
  it('reads a course screen from courseId', () => {
    expect(courseFieldFor('edit')).toBe('courseId');
  });

  it('does not claim one for Grades, which is every course at once', () => {
    /*
     * It reads like a course screen and is not one. `screens/Grades.tsx`
     * renders `catalog.courses` and never touches `state.courseId`, so
     * claiming a field here put a link labelled with whichever course was last
     * opened above a page listing all four — pointing somewhere the page had
     * not mentioned. It is the grades grain of `courses` now, and the same
     * holds of the screen that hosts it.
     */
    expect(courseFieldFor('courses')).toBeNull();
    expect(insideCourse('courses')).toBe(false);
  });

  it('reads a study screen from guideId', () => {
    // A guide is a course by another name, and the study screens track it in
    // its own field — reading courseId there would point at whichever course
    // happened to be opened last.
    for (const s of ['guide', 'drill', 'quiz', 'lesson', 'slides'] as const) {
      expect(courseFieldFor(s)).toBe('guideId');
    }
  });

  it('does not claim a field for a deadline', () => {
    // An item knows its own course through the item itself.
    expect(courseFieldFor('item')).toBeNull();
  });

  it('says nothing about a screen that is not inside a course', () => {
    for (const s of ['home', 'courses', 'calendar', 'mine', 'settings'] as const) {
      expect(courseFieldFor(s)).toBeNull();
    }
  });
});

describe('insideCourse', () => {
  it('counts a deadline, even though it has no field of its own', () => {
    expect(insideCourse('item')).toBe(true);
  });

  it('counts every screen that names a course', () => {
    for (const s of ['edit', 'guide', 'drill', 'quiz', 'lesson', 'slides'] as const) {
      expect(insideCourse(s)).toBe(true);
    }
  });

  it('does not count a top-level screen', () => {
    for (const s of ['home', 'courses', 'study', 'calendar', 'mine', 'brief'] as const) {
      expect(insideCourse(s)).toBe(false);
    }
  });
});
