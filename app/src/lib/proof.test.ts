import { describe, expect, it } from 'vitest';
import {
  LONG_SENTENCE,
  aiAllowed,
  applyFix,
  byKind,
  longSentences,
  proofLine,
  proofread,
  unbalanced,
  wordCount,
  type ProofKind,
} from './proof';

const kinds = (text: string): ProofKind[] => proofread(text).map((f) => f.kind);
const says = (text: string): string[] => proofread(text).map((f) => f.says);

describe('a word said twice', () => {
  it('is caught, which the eye is worst at', () => {
    const [f] = proofread('I read the the chapter.');
    expect(f.kind).toBe('repeat');
    expect(f.found).toBe('the the');
    expect(f.fix).toBe('the');
  });

  it('is caught across a line break', () => {
    expect(kinds('the argument is\nis wrong')).toContain('repeat');
  });

  it('leaves the doubles that are real English alone', () => {
    expect(kinds('He had had enough.')).not.toContain('repeat');
    expect(kinds('The point is that that argument fails.')).not.toContain('repeat');
  });
});

describe('misspellings, which is not the same as a dictionary', () => {
  it('catches the ones that are wrong in every context', () => {
    const [f] = proofread('This is definately right.');
    expect(f.kind).toBe('spelling');
    expect(f.fix).toBe('definitely');
  });

  it('keeps the capital the writer used', () => {
    expect(proofread('Seperate the two.')[0].fix).toBe('Separate');
  });

  it('says nothing about a word it simply does not know', () => {
    // The whole reason there is no dictionary: a short one flags every proper
    // noun and every term of art in a syllabus, and gets switched off.
    expect(proofread('Ocobock argues that hominin endurance mattered.')).toEqual([]);
  });
});

describe('phrases that are never right', () => {
  it('catches "should of"', () => {
    const [f] = proofread('I should of started earlier.');
    expect(f.kind).toBe('confusion');
    expect(f.fix).toBe('should have');
  });

  it('catches "then" where a comparison wanted "than"', () => {
    expect(proofread('This is better then that.')[0].fix).toBe('better than');
    expect(proofread('rather then wait')[0].fix).toBe('rather than');
  });

  it('leaves "then" alone where it means afterwards', () => {
    expect(kinds('We read it, then wrote about it.')).not.toContain('confusion');
  });

  it('names the comparatives rather than matching anything ending in -er', () => {
    expect(proofread('It was harder then I expected.')[0].fix).toBe('harder than');
    // Which is why these are safe: both end in -er and neither wants "than".
    expect(kinds('We gather then disperse.')).not.toContain('confusion');
    expect(kinds('Consider then act.')).not.toContain('confusion');
  });

  it('does not guess at their, there and they’re', () => {
    // Catching those needs the sentence's meaning. A wrong flag on correct
    // writing costs more trust than a missed one costs anything.
    expect(kinds('There argument was that they are right.')).not.toContain('confusion');
  });
});

describe('punctuation and spacing', () => {
  it('catches a space before a comma', () => {
    expect(says('the essay , which is due')).toContain('a space before the comma');
  });

  it('catches a missing space after one', () => {
    expect(says('first,second,third')).toContain('no space after the comma');
  });

  it('catches more than one space between words', () => {
    expect(says('the  essay')).toContain('more than one space');
  });

  it('catches repeated punctuation', () => {
    expect(says('Really!!')).toContain('the exclamation mark repeated');
  });

  it('leaves a decimal, a URL, an email and an abbreviation alone', () => {
    expect(proofread('It rose 4.5% — see https://fred.stlouisfed.org/series/x,y')).toEqual([]);
    expect(proofread('Write to a.b@vanderbilt.edu')).toEqual([]);
    expect(kinds('Elasticity, e.g. of demand, matters.')).not.toContain('spacing');
  });
});

describe('capitals', () => {
  it('catches a sentence starting in lower case', () => {
    expect(says('It is due. it is also long.')).toContain('a sentence starting in lower case');
  });

  it('leaves the very first character alone', () => {
    // Often a fragment somebody is still writing.
    expect(kinds('the essay is due')).not.toContain('capital');
  });

  it('catches a lone lower-case i', () => {
    expect(proofread('Then i wrote it.').find((f) => f.found === 'i')?.fix).toBe('I');
  });
});

describe('brackets and quotes', () => {
  it('points at the bracket that was left open, not at the end', () => {
    const text = 'The claim (following Epstein is that training matters a great deal.';
    const [f] = unbalanced(text);
    expect(f.at).toBe(text.indexOf('('));
    expect(f.says).toContain('never closed');
  });

  it('points at a closer with nothing before it', () => {
    expect(unbalanced('the claim) is')[0].says).toContain('nothing it closes');
  });

  it('says nothing about balanced ones', () => {
    expect(unbalanced('(a) [b] {c} "d"')).toEqual([]);
  });

  it('can only say a straight quote count is odd, and says exactly that', () => {
    expect(unbalanced('He said "it matters.')[0].says).toBe('an odd number of quotation marks');
  });
});

describe('long sentences', () => {
  it('counts rather than judges', () => {
    const long = `${'word '.repeat(LONG_SENTENCE + 5).trim()}.`;
    const [f] = longSentences(long);
    expect(f.kind).toBe('length');
    expect(f.says).toContain(`${LONG_SENTENCE + 5} words`);
    expect(f.says).toContain('not necessarily a change');
    expect(f.fix).toBe('');
  });

  it('leaves an ordinary sentence alone', () => {
    expect(longSentences('This is a short sentence about elasticity.')).toEqual([]);
  });
});

describe('what the panel says', () => {
  it('refuses to call anything good', () => {
    // The difference between "no rule fired" and "this is well written" is the
    // difference between a tool and a flatterer.
    const line = proofLine([], 'Three words here');
    expect(line).toBe('3 words. No rule here found anything.');
    expect(line.toLowerCase()).not.toContain('good');
  });

  it('counts what it found', () => {
    const text = 'I should of gone.';
    expect(proofLine(proofread(text), text)).toBe('4 words, 1 thing worth a look.');
  });

  it('says nothing at all about an empty box', () => {
    expect(proofLine([], '   ')).toBe('Nothing to check yet.');
  });

  it('counts words the way a word count means it', () => {
    expect(wordCount('  one   two\nthree ')).toBe(3);
    expect(wordCount('')).toBe(0);
  });
});

describe('applying one fix', () => {
  it('fixes the one pointed at, not every copy of it', () => {
    const text = 'definately here and definately there';
    const second = proofread(text)[1];
    expect(applyFix(text, second)).toBe('definately here and definitely there');
  });

  it('does nothing when the text has moved under it', () => {
    const text = 'I should of gone.';
    const [f] = proofread(text);
    expect(applyFix('something else entirely', f)).toBe('something else entirely');
  });

  it('does nothing for a finding with no single answer', () => {
    const text = 'He said "it matters.';
    const quote = proofread(text).find((f) => f.kind === 'pairs');
    expect(quote && applyFix(text, quote)).toBe(text);
  });
});

describe('the order they are shown in', () => {
  it('puts what is plainly wrong above what is only worth a look', () => {
    const text = `I should of gone. ${'word '.repeat(LONG_SENTENCE + 2).trim()}.`;
    const groups = byKind(proofread(text)).map(([k]) => k);
    expect(groups.indexOf('confusion')).toBeLessThan(groups.indexOf('length'));
  });

  it('leaves out the kinds with nothing in them', () => {
    expect(byKind(proofread('I should of gone.')).map(([k]) => k)).toEqual(['confusion']);
  });
});

describe('the fence around the second pass', () => {
  it('is off for a course recorded as banning AI', () => {
    const gate = aiAllowed('banned');
    expect(gate.ok).toBe(false);
    expect(gate.why).toContain('rules in this app, not a model');
  });

  it('is on for limited, permitted and unrecorded', () => {
    // A spelling check is what "limited" nearly always means it permits, and a
    // policy nobody has read is not evidence that the most ordinary use of all
    // is forbidden.
    for (const stance of ['limited', 'allowed', 'unstated', undefined]) {
      expect(aiAllowed(stance).ok).toBe(true);
    }
  });
});
