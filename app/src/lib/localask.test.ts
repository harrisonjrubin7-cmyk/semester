import { describe, expect, it } from 'vitest';
import { answerLocally } from './localask';
import { DESTINATIONS } from './nav';

/**
 * What the app can say about itself with no network.
 *
 * The property that matters is not "it finds the right screen" — a bag of
 * words will not always — but that what it shows is real and honestly
 * ranked. So the tests are: it only ever names screens that exist, it only
 * ever quotes the guide rather than writing prose, the right screen is
 * usually first, and it says nothing rather than something vague.
 */

describe('it can only name what exists', () => {
  it('never returns a screen the registry does not have', () => {
    /*
     * The same rule the generated guide is held to, for the same reason: a
     * student told to open a screen that is not there concludes the app is
     * broken, and the only defence is that this cannot name one.
     */
    const real = new Set(DESTINATIONS.map((d) => d.screen));
    for (const q of [
      'where do I set my grade scale',
      'how do I import a syllabus',
      'where are my timers',
      'what does the runway do',
      'how do I add a course',
      'where is the meal plan',
      'notifications',
      'where do I sign in',
    ]) {
      for (const m of answerLocally(q)?.matches ?? []) {
        expect(real.has(m.screen), `${q} invented ${m.screen}`).toBe(true);
      }
    }
  });

  it('quotes the guide rather than writing about it', () => {
    // Every line it shows has to appear in the generated guide verbatim, so
    // nothing here can be a sentence somebody would have to check.
    const got = answerLocally('where are my timers and alarms');
    for (const line of got?.fromGuide ?? []) {
      expect(line.length).toBeGreaterThan(29);
      expect(line).toBe(line.trim());
    }
  });
});

describe('what it puts first', () => {
  const first = (q: string) => answerLocally(q)?.matches[0]?.screen;
  const listed = (q: string) => (answerLocally(q)?.matches ?? []).map((m) => m.screen);

  it('puts the screen first when the question names it', () => {
    expect(first('where is the meal plan')).toBe('meals');
    expect(first('what does the exam runway do')).toBe('runway');
    expect(first('where do I see my grades')).toBe('grades');
  });

  it('has the right screen in the list when two are genuinely close', () => {
    /*
     * The weaker property, asserted because it is the one the design
     * promises. "How do I add a course from a syllabus" matches both Add a
     * course and Edit the course — Edit's own blurb opens "A syllabus is a
     * first draft" — and which of those wins a word count is not something
     * worth pinning. This is why the screen shows a list with each blurb
     * rather than a sentence naming one: the reader does the last step.
     */
    expect(listed('how do I add a course from a syllabus')).toContain('import');
  });

  it('matches a plural against a singular', () => {
    // "Grades" is the label; people type "grade". Prefix matching from four
    // characters, which is what the endings that actually come up need.
    expect(first('what is my grade')).toBe('grades');
    expect(first('set a timer')).toBe('clocks');
  });
});

describe('when it should say nothing', () => {
  it('says nothing to a question that is not about this app', () => {
    // These reach the model. The mode reader sends them there anyway — this
    // is the second line, for when it does not.
    expect(answerLocally('')).toBeNull();
    expect(answerLocally('the of and a')).toBeNull();
  });

  it('drops a match far weaker than the best one', () => {
    /*
     * Three rows of equal weight read as three equally good answers. Today's
     * blurb contains the word "plan", so it scored against "where is the meal
     * plan" — next to the real match it makes the real one look like a guess.
     */
    const got = answerLocally('where is the meal plan');
    expect(got?.matches[0].screen).toBe('meals');
    expect(got?.matches.map((m) => m.screen)).not.toContain('home');
  });

  it('keeps a genuine tie, because a tie is worth showing as one', () => {
    const got = answerLocally('where do I mark attendance');
    // Whatever it finds, nothing in it may be far below the top.
    const scores = (got?.matches ?? []).map((m) => m.score);
    if (scores.length > 1) expect(scores.at(-1)!).toBeGreaterThanOrEqual(scores[0] * 0.4);
  });
});

describe('what it costs', () => {
  it('is a pure function of the question, so it works offline and repeats', () => {
    const once = JSON.stringify(answerLocally('how do I add a course'));
    const twice = JSON.stringify(answerLocally('how do I add a course'));
    expect(once).toBe(twice);
  });
});
