import { describe, expect, it } from 'vitest';
import { check, RULES } from './voice';

/**
 * The rubric, checked against answers written to break it.
 *
 * A measuring instrument that has never been shown to move is not evidence of
 * anything, and this one has a specific way of being useless: the patterns
 * could be narrow enough that only the literal example passes them, in which
 * case a run over ten real answers comes back clean and says nothing. So each
 * rule is given a sentence it should catch *and* a nearby sentence it should
 * not, which is the pair that makes the boundary real.
 */

const ids = (text: string) => check(text).map((s) => s.rule);

describe('the openings', () => {
  it('catches praise for the question', () => {
    expect(ids('Great question! The final is on 12 December.')).toContain('opening-compliment');
  });

  it('catches agreeing to answer', () => {
    expect(ids("Sure, I can help with that. The final is on 12 December.")).toContain(
      'opening-acknowledgement',
    );
    expect(ids('Let me take a look at your grades.')).toContain('opening-acknowledgement');
  });

  it('catches the question read back', () => {
    expect(ids("You're asking about the ECON final. It is on 12 December.")).toContain(
      'opening-restatement',
    );
  });

  it('catches narrating the answer before giving it', () => {
    expect(ids("Here's a breakdown of your week.\n\nMonday: two readings.")).toContain(
      'opening-preamble',
    );
  });

  it('leaves an answer that starts with the answer alone', () => {
    expect(check('The ECON 1020 final is on 12 December at 3pm, in class.')).toEqual([]);
    expect(check('Three things are due this week, and two of them are readings.')).toEqual([]);
  });

  it('does not count a heading as the opening', () => {
    // "## Where you stand" then a real first sentence is an answer that has
    // started. Treating the heading as the first line would have made every
    // structured answer unmeasurable.
    expect(check('## Where you stand\n\nTwo of the four are above where you need to be.')).toEqual(
      [],
    );
  });
});

describe('the endings', () => {
  it('catches an offer of more help', () => {
    expect(ids('The final is on 12 December.\n\nLet me know if you want the full schedule.')).toContain(
      'closing-offer',
    );
    expect(ids('It is worth 30%.\n\nWould you like me to add a reminder?')).toContain('closing-offer');
  });

  it('catches a sign-off', () => {
    expect(ids('It is worth 30%.\n\nI hope this helps!')).toContain('closing-wish');
    expect(ids('Two readings and a problem set.\n\nGood luck with the exam.')).toContain(
      'closing-wish',
    );
  });

  it('catches a summary of something short', () => {
    expect(ids('The final is 30%.\n\nIn short, the final is the one that matters.')).toContain(
      'closing-summary',
    );
  });

  it('leaves a named action alone, because that one has a button', () => {
    // The line the rules sit on. "Opening Mail" describes a card that is
    // about to appear; "let me know if you'd like me to draft that" asks for
    // permission through a channel nothing reads. Only the second is a slip,
    // and a rubric that flagged both would push the assistant towards
    // refusing without offering the screen that does the thing.
    expect(check('I cannot send mail. Opening Mail with her name filled in is the nearest thing.')).toEqual(
      [],
    );
    expect(
      ids('I cannot send mail.\n\nLet me know if you would like me to draft that.'),
    ).toContain('closing-offer');
  });

  it('leaves an answer that just stops alone', () => {
    expect(check('The final is on 12 December and is worth 30% of the grade.')).toEqual([]);
  });

  it('only reads the last line as the ending', () => {
    // "Let me know" in the middle of an answer about emailing a professor is
    // the answer, not a sign-off. A rule that fired anywhere would make the
    // assistant unable to talk about asking somebody something.
    const answer =
      'Email Professor Larsen and say which section you are in.\n\n' +
      'A line like "let me know if Thursday works" is enough — she replies to most mail same day.\n\n' +
      'Her office hours are Tuesday 2–4 in Calhoun 314.';
    expect(ids(answer)).not.toContain('closing-offer');
  });
});

describe('the habits', () => {
  it('catches a stack of hedges', () => {
    expect(ids('You might possibly want to start with the reading.')).toContain('hedge-stack');
    expect(ids('It could perhaps be worth reviewing chapter 4.')).toContain('hedge-stack');
  });

  it('leaves a single honest hedge alone', () => {
    // One hedge is precision, not padding. This is the line the rule has to
    // sit on: "the syllabus does not give a time" is exactly what the prompt
    // asks for, and a rubric that punished it would push the answers towards
    // false confidence, which is a far worse failure than a chatty one.
    expect(check('The syllabus does not give a time, so this may be an evening slot.')).toEqual([]);
  });

  it('catches the ornamental verbs', () => {
    expect(ids("Let's delve into your grade projection.")).toContain('delve');
    expect(ids('You can leverage the drill deck for this.')).toContain('delve');
  });

  it('catches an exclamation mark', () => {
    expect(ids('You have three deadlines this week!')).toContain('exclamation');
  });

  it('leaves one inside a code fence alone', () => {
    // An answer about shell scripting contains `!`, and an answer about
    // JavaScript contains `!==`. A rubric that flagged the sample would be a
    // thing to work around rather than a thing to pass.
    const answer = 'Use the history expansion:\n\n```bash\n!! | grep foo\n```\n\nThat re-runs the last command.';
    expect(ids(answer)).not.toContain('exclamation');
  });

  it('catches reading a mood off a timetable', () => {
    expect(ids('You must be feeling overwhelmed with four deadlines.')).toContain('feelings');
    expect(ids("Don't stress about it — you have time.")).toContain('feelings');
  });

  it('catches claiming to have done something', () => {
    // The one failure with a consequence outside the text: the student
    // believes a reminder exists and it does not.
    expect(ids("I've added a reminder for Thursday.")).toContain('claimed-action');
    expect(ids('I have scheduled two hours on Wednesday.')).toContain('claimed-action');
  });

  it('leaves a proposal in the future tense alone', () => {
    expect(check('Adding a reminder for Thursday would cover it — the button below does that.')).toEqual(
      [],
    );
  });

  it('catches talking about itself', () => {
    expect(ids("As an AI, I can't see your Brightspace.")).toContain('as-an-ai');
  });
});

describe('the rubric itself', () => {
  it('gives every rule an id, a reason and a scope', () => {
    for (const rule of RULES) {
      expect(rule.id).toMatch(/^[a-z-]+$/);
      expect(rule.why.length).toBeGreaterThan(20);
      expect(['opening', 'closing', 'anywhere']).toContain(rule.where);
    }
  });

  it('has no two rules under the same id', () => {
    const seen = RULES.map((r) => r.id);
    expect(new Set(seen).size).toBe(seen.length);
  });

  it('points at the line, so a slip can be found', () => {
    const found = check('The final is 30%.\n\nI hope this helps.');
    expect(found).toHaveLength(1);
    expect(found[0].line).toBe(3);
    expect(found[0].found).toBe('I hope this helps');
  });

  it('says nothing about an empty answer rather than throwing', () => {
    expect(check('')).toEqual([]);
    expect(check('\n\n   \n')).toEqual([]);
  });
});
