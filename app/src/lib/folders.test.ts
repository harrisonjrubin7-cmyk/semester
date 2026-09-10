import { describe, expect, it } from 'vitest';
import {
  canMove,
  childrenOf,
  courseFolderId,
  freeName,
  isCourseFolder,
  subtree,
  trail,
  withCourses,
  type Folder,
} from './folders';
import type { Course } from './types';

const folder = (id: string, name: string, parentId: string | null = null): Folder => ({
  id,
  name,
  parentId,
  created: 0,
});

const course = (id: string, code: string): Course => ({
  id,
  code,
  name: code,
  prof: '',
  email: '',
  meets: '',
  room: '',
  credits: '3',
  source: '',
  grading: [],
});

const courses = [course('econ', 'ECON 1020'), course('psci', 'PSCI 1104')];

describe('the folder per course', () => {
  it('is derived from the catalogue rather than created', () => {
    const all = withCourses([], courses);
    expect(all.map((f) => f.name)).toEqual(['ECON 1020', 'PSCI 1104']);
    expect(all.every((f) => f.fromCourse)).toBe(true);
  });

  it('has the same id on every device and after every reload', () => {
    expect(courseFolderId('econ')).toBe('course:econ');
    expect(isCourseFolder('course:econ')).toBe(true);
    expect(isCourseFolder('abc123')).toBe(false);
    expect(isCourseFolder(null)).toBe(false);
  });

  it('disappears when its course does, leaving nothing behind', () => {
    expect(withCourses([], [courses[0]]).map((f) => f.id)).toEqual(['course:econ']);
    expect(withCourses([], []).length).toBe(0);
  });

  it('cannot be moved, because the catalogue would put it back', () => {
    const all = withCourses([folder('own', 'Essays')], courses);
    expect(canMove(all, 'course:econ', 'own')).toBe(false);
    expect(canMove(all, 'own', 'course:econ')).toBe(true);
  });

  it('sorts above the folders somebody made themselves', () => {
    const all = withCourses([folder('a', 'AAA')], courses);
    expect(childrenOf(all, null).map((f) => f.name)).toEqual(['ECON 1020', 'PSCI 1104', 'AAA']);
  });
});

describe('nesting', () => {
  const all = withCourses(
    [
      folder('a', 'Essays'),
      folder('b', 'Drafts', 'a'),
      folder('c', 'Old', 'b'),
      folder('d', 'Readings'),
    ],
    [],
  );

  it('lists what is directly inside', () => {
    expect(childrenOf(all, null).map((f) => f.name)).toEqual(['Essays', 'Readings']);
    expect(childrenOf(all, 'a').map((f) => f.name)).toEqual(['Drafts']);
    expect(childrenOf(all, 'c')).toEqual([]);
  });

  it('walks the path back to the top', () => {
    expect(trail(all, 'c').map((f) => f.name)).toEqual(['Essays', 'Drafts', 'Old']);
    expect(trail(all, null)).toEqual([]);
    expect(trail(all, 'nosuch')).toEqual([]);
  });

  it('does not hang on a parent chain that loops', () => {
    const looped = withCourses([folder('x', 'X', 'y'), folder('y', 'Y', 'x')], []);
    expect(trail(looped, 'x').length).toBeLessThanOrEqual(2);
  });

  it('collects everything at or below a folder', () => {
    expect([...subtree(all, 'a')].sort()).toEqual(['a', 'b', 'c']);
    expect([...subtree(all, 'd')]).toEqual(['d']);
  });
});

describe('what a drag is allowed to do', () => {
  const all = withCourses([folder('a', 'Essays'), folder('b', 'Drafts', 'a'), folder('c', 'Old', 'b')], []);

  it('refuses a folder into itself', () => {
    expect(canMove(all, 'a', 'a')).toBe(false);
  });

  it('refuses a folder into its own descendant', () => {
    // The ring that takes every file in it out of sight with no way back.
    expect(canMove(all, 'a', 'b')).toBe(false);
    expect(canMove(all, 'a', 'c')).toBe(false);
  });

  it('allows the moves that leave a reachable tree', () => {
    expect(canMove(all, 'c', 'a')).toBe(true);
    expect(canMove(all, 'b', null)).toBe(true);
    expect(canMove(all, 'a', null)).toBe(true);
  });
});

describe('naming', () => {
  const all = withCourses([folder('a', 'Essays'), folder('b', 'Essays 2')], []);

  it('leaves a free name alone', () => {
    expect(freeName(all, null, 'Readings')).toBe('Readings');
  });

  it('does not let two siblings read the same', () => {
    expect(freeName(all, null, 'Essays')).toBe('Essays 3');
    expect(freeName(all, null, 'essays')).toBe('essays 3');
  });

  it('is only bothered by siblings', () => {
    expect(freeName(all, 'a', 'Essays')).toBe('Essays');
  });

  it('falls back rather than returning an empty name', () => {
    expect(freeName(all, null, '   ')).toBe('New folder');
  });
});
