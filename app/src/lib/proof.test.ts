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

  it('reports two spaces after an address, which is outside it', () => {
    /*
     * The double-space rule matches the character *before* the spaces, and
     * after a URL that character is the last one of the URL. Masking on it
     * suppressed every real double space that followed an address.
     */
    expect(says('See https://example.test  then read on.')).toContain('more than one space');
    expect(says('Write to a.b@vanderbilt.edu  and wait.')).toContain('more than one space');
  });

  it('still says nothing about two spaces inside code', () => {
    // Which is what the mask is for here, and `f.at` is inside it.
    expect(kinds('Run `a  b` first.')).not.toContain('spacing');
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

  it('does not read an abbreviation as the end of a sentence', () => {
    /*
     * The mask exists for these and was asked about the wrong character: this
     * rule matches the full stop and points at the letter after it, so masking
     * on where it points asked whether *the letter* sat inside "U.S." — which
     * it never does. Every one of these was reported as a sentence starting in
     * lower case, offering to capitalise the following word, in the prose this
     * app is most often given.
     */
    expect(kinds('The U.S. position on export controls hardened.')).not.toContain('capital');
    expect(kinds('Allied governments, e.g. the Netherlands, coordinated.')).not.toContain('capital');
    expect(kinds('The point, i.e. that it binds, is contested.')).not.toContain('capital');
    expect(kinds('Compare Dr. smith later on.')).not.toContain('capital');
  });

  it('does not read the start of a URL or an address as a lower-case sentence', () => {
    // The other end of the same mask: here the full stop is a real one and the
    // letter it points at is inside something that should not be checked at
    // all. A bibliography is mostly this shape.
    expect(kinds('See the figures. www.imf.org/data has them.')).not.toContain('capital');
    expect(kinds('Ask the office. a.b@vanderbilt.edu replies fastest.')).not.toContain('capital');
    expect(kinds('The source is there. https://fred.stlouisfed.org holds it.')).not.toContain(
      'capital',
    );
  });

  it('still catches a real one in the same sentence as an abbreviation', () => {
    // The mask must narrow this rule, not switch it off.
    expect(says('The U.S. position hardened. it hardened further.')).toContain(
      'a sentence starting in lower case',
    );
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

  it('does not let an abbreviation break one long sentence into short ones', () => {
    /*
     * `proofread` masks "U.S." and "e.g."; this counted words between full
     * stops without asking. The same sentence went unreported when it said
     * "U.S." and reported when it said "American" — which of those a writer
     * gets should not depend on whether they abbreviated.
     */
    const tail = ` ${'word '.repeat(LONG_SENTENCE).trim()}.`;
    const abbreviated = `The U.S. position, e.g. on export controls,${tail}`;
    const [f] = longSentences(abbreviated);
    expect(f?.kind).toBe('length');
    // Seven words of prefix: The / U.S. / position, / e.g. / on / export / controls,
    expect(f.says).toContain(`${LONG_SENTENCE + 7} words`);
    // And what it shows the writer is what they wrote, not the masked copy.
    expect(f.found).toContain('U.S.');
    expect(f.found).not.toContain('_');
  });

  it('does not swallow the full stop that ends the sentence a URL sits in', () => {
    /*
     * `\S+` is greedy and a full stop is not whitespace, so the URL pattern
     * matched "https://example.test." — the stop included. Masking that hid a
     * real sentence boundary, and this ran the two sentences together and
     * called the pair too long: the false alarm the mask exists to prevent.
     */
    const half = 'word '.repeat(Math.ceil(LONG_SENTENCE * 0.6)).trim();
    const two = `${half} at https://example.test. ${half} and that is all.`;
    expect(longSentences(two)).toEqual([]);

    const byEmail = `${half} to a.b@vanderbilt.edu. ${half} and that is all.`;
    expect(longSentences(byEmail)).toEqual([]);
  });

  it('still ends a sentence at a full stop that is one', () => {
    const long = `${'word '.repeat(LONG_SENTENCE + 5).trim()}.`;
    expect(longSentences(`${long} Short one after it.`)).toHaveLength(1);
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
