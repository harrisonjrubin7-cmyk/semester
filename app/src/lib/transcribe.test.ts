import { describe, expect, it } from 'vitest';
import { asText, explainScribeError, paragraphs, stamp, words, type Segment } from './transcribe';

const seg = (at: number, text: string): Segment => ({ at, text });

describe('stamp', () => {
  it('reads as a position in a recording, not a duration', () => {
    expect(stamp(0)).toBe('0:00');
    expect(stamp(64)).toBe('1:04');
    expect(stamp(599)).toBe('9:59');
  });

  it('grows an hour field only when there is an hour', () => {
    expect(stamp(3600)).toBe('1:00:00');
    expect(stamp(3725)).toBe('1:02:05');
  });

  it('does not produce a negative clock from a clock skew', () => {
    expect(stamp(-4)).toBe('0:00');
  });
});

describe('asText', () => {
  const segs = [seg(0, 'Good morning.'), seg(65, 'Today we start on inflation.')];

  it('stamps each line when you want to scrub against the audio', () => {
    expect(asText(segs)).toBe('[0:00] Good morning.\n[1:05] Today we start on inflation.');
  });

  it('runs it together when you want to paste it somewhere', () => {
    expect(asText(segs, false)).toBe('Good morning. Today we start on inflation.');
  });

  it('is empty rather than a lone bracket when nothing was heard', () => {
    expect(asText([])).toBe('');
  });
});

describe('words', () => {
  it('counts across segments', () => {
    expect(words([seg(0, 'one two'), seg(5, 'three')])).toBe(3);
  });

  it('is zero for nothing, not one', () => {
    expect(words([])).toBe(0);
    expect(words([seg(0, '   ')])).toBe(0);
  });
});

describe('paragraphs', () => {
  it('joins bursts that were one thought', () => {
    // The recogniser finalises every few seconds; forty one-line entries is
    // not the shape the speaking had.
    const out = paragraphs([seg(0, 'Good morning.'), seg(3, 'Today we start on inflation.')]);
    expect(out).toHaveLength(1);
    expect(out[0].text).toBe('Good morning. Today we start on inflation.');
    expect(out[0].at).toBe(0);
  });

  it('breaks when the speaking stopped for a while', () => {
    const out = paragraphs([seg(0, 'Any questions?'), seg(90, 'Right, moving on.')]);
    expect(out).toHaveLength(2);
    expect(out[1].at).toBe(90);
  });

  it('keeps the timestamp of the first line in a paragraph', () => {
    const out = paragraphs([seg(10, 'a'), seg(12, 'b'), seg(14, 'c')]);
    expect(out).toHaveLength(1);
    expect(out[0].at).toBe(10);
  });

  it('does not mutate what it was given', () => {
    const given = [seg(0, 'a'), seg(2, 'b')];
    paragraphs(given);
    expect(given.map((s) => s.text)).toEqual(['a', 'b']);
  });

  it('survives an empty transcript', () => {
    expect(paragraphs([])).toEqual([]);
  });
});

describe('explainScribeError', () => {
  it('says the recording is safe whenever recognition is what broke', () => {
    // The thing a person panics about is losing the audio.
    expect(explainScribeError('network')).toContain('audio is safe');
    expect(explainScribeError('other')).toContain('audio is safe');
  });

  it('names the browsers that have it', () => {
    expect(explainScribeError('unsupported')).toContain('Firefox');
  });
});
