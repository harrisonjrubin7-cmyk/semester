import { describe, expect, it } from 'vitest';
import { spanOf } from './select';

/**
 * Class lengths come out of a syllabus's own wording, which is inconsistent by
 * nature. Every case here is a real line from one of the four courses or a
 * near neighbour of one.
 */
describe('spanOf', () => {
  it('reads a fifty-minute morning class', () => {
    expect(spanOf('MWF · 9:05–9:55a')).toBe(50);
  });

  it('reads a seventy-five-minute afternoon class', () => {
    expect(spanOf('T/R · 1:15–2:30p')).toBe(75);
    expect(spanOf('T/R · 2:45–4:00p')).toBe(75);
  });

  it('lets the end inherit the meridiem when only the start says', () => {
    expect(spanOf('MWF · 9:05a–9:55')).toBe(50);
  });

  it('handles a range that crosses noon', () => {
    expect(spanOf('11:30–1:00p')).toBe(90);
  });

  it('accepts an em dash or a hyphen', () => {
    expect(spanOf('1:15—2:30p')).toBe(75);
    expect(spanOf('1:15-2:30p')).toBe(75);
  });

  it('returns null when the line states no times', () => {
    expect(spanOf('T/R · Alumni Hall 201')).toBeNull();
    expect(spanOf('')).toBeNull();
    expect(spanOf('Online, asynchronous')).toBeNull();
  });

  it('refuses an implausible span rather than drawing a block across the day', () => {
    expect(spanOf('9:00a–9:00a')).toBeNull();
    expect(spanOf('1:00a–11:00p')).toBeNull();
  });
});
