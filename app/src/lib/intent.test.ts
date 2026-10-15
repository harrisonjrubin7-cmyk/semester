import { describe, expect, it } from 'vitest';
import { addIntent, seedQuickAdd, takeQuickAddSeed } from './intent';

describe('addIntent', () => {
  it('recognises the verbs that mean add, and takes them off', () => {
    expect(addIntent('Add study session tomorrow at 4')).toBe('study session tomorrow at 4');
    expect(addIntent('Create task: submit lab report')).toBe('submit lab report');
    expect(addIntent('create a reminder to call home')).toBe('to call home');
    expect(addIntent('remind me to email the professor friday')).toBe('email the professor friday');
    expect(addIntent('add task - econ ps4 friday 5pm')).toBe('econ ps4 friday 5pm');
  });

  it('leaves a search a search', () => {
    for (const text of [
      'lab report friday',
      'address book',
      'new york',
      'create',
      'Create a deck',
      'Where is the library?',
      'I am behind in chemistry',
      'add',
      '',
    ]) {
      expect(addIntent(text), text).toBeNull();
    }
  });

  it('does not turn a screen’s own name into a task', () => {
    // "Add a course" and "Add a reading" are what those screens are called.
    expect(addIntent('Add a course')).toBeNull();
    expect(addIntent('add a reading')).toBeNull();
  });
});

describe('the hand-off to the capture box', () => {
  it('is taken once, so a later box opens empty', () => {
    seedQuickAdd('econ ps4 friday');
    expect(takeQuickAddSeed()).toBe('econ ps4 friday');
    expect(takeQuickAddSeed()).toBe('');
  });
});

// Removing a command route must leave its requested workflow unreachable.
describe('navigationIntent', () => {
  it('opens the requested workflow without committing an action', async () => {
    const { navigationIntent } = await import('./intent');
    expect(navigationIntent('  Prepare my advisor agenda  ')).toBe('meet');
    expect(navigationIntent('Open privacy controls')).toBe('privacy');
    expect(navigationIntent('Find my next deadline')).toBe('home');
    expect(navigationIntent('Add a study block')).toBe('calendar');
    expect(navigationIntent('Compare course options')).toBe('degree');
    expect(navigationIntent('Show my shared items')).toBe('meet');
    expect(navigationIntent('Find tutoring')).toBe('support');
    expect(navigationIntent('Open my fall plan')).toBe('degree');
  });
  it('leaves unfamiliar and consequential requests for search or explicit review', async () => {
    const { navigationIntent } = await import('./intent');
    for (const phrase of ['', 'delete all courses', 'share my private notes', 'register ECON 101', 'pay tuition', 'find tutoring jobs', 'open my fall plan and delete it']) {
      expect(navigationIntent(phrase)).toBeNull();
    }
  });
});
