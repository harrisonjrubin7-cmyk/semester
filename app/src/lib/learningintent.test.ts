import { afterEach, describe, expect, it } from 'vitest';
import { FRESH_MS, askToOpen, clear, peek } from './learningintent';

afterEach(clear);

describe('the request to open the feedback inbox', () => {
  it('carries the work and the course across, and reading it does not use it up', () => {
    askToOpen({ panel: 'feedback', work: 'Essay 1', courseCode: 'PSCI 1104' }, 1_000);
    expect(peek('feedback', 1_500)).toMatchObject({ work: 'Essay 1', courseCode: 'PSCI 1104' });
    // React may run an initializer twice; the second read must see the same thing.
    expect(peek('feedback', 1_600)).not.toBeNull();
  });

  it('is gone once cleared', () => {
    askToOpen({ panel: 'feedback', work: 'Essay 1', courseCode: 'PSCI 1104' }, 1_000);
    clear();
    expect(peek('feedback', 1_100)).toBeNull();
  });

  it('expires, so nobody is surprised by a request nobody collected', () => {
    askToOpen({ panel: 'feedback', work: 'Essay 1', courseCode: 'PSCI 1104' }, 1_000);
    expect(peek('feedback', 1_000 + FRESH_MS)).not.toBeNull();
    expect(peek('feedback', 1_000 + FRESH_MS + 1)).toBeNull();
  });

  it('control: with nothing asked there is nothing to find', () => {
    expect(peek('feedback')).toBeNull();
  });
});
