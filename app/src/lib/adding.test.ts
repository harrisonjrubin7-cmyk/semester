/**
 * The header's + adds what the screen is a list of.
 *
 * The courses list carried two of them — the header's, which opened the
 * one-line capture box, and a full-width one under the last card, which
 * opened the importer. Only the second could actually make a course. These
 * assert the one that is left goes to the right place, and that removing the
 * second did not take capture away from every other screen.
 */

import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { addingOn } from './adding';
import type { Screen } from './types';

describe('addingOn', () => {
  it('adds a course on the courses list', () => {
    expect(addingOn('courses').kind).toBe('course');
  });

  it('says so, because the button has no visible label', () => {
    expect(addingOn('courses').label).toMatch(/course/i);
  });

  it('captures a deadline everywhere else', () => {
    const elsewhere: Screen[] = ['home', 'course', 'calendar', 'mine', 'study', 'grades', 'me'];
    for (const s of elsewhere) expect(addingOn(s).kind, s).toBe('quick');
  });

  it('leaves one route to the importer on the courses list', () => {
    // The button this replaced. If it comes back, both are on screen again
    // and the header's + is the redundant one.
    const src = readFileSync(new URL('../screens/Courses.tsx', import.meta.url), 'utf8');
    expect(src).not.toContain('Add a course from a syllabus');
  });
});
