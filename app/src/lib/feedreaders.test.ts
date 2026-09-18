import { describe, expect, it } from 'vitest';
import { feedReaders, type FeedFetch } from './subscribe';

/**
 * The sentence that tells a student their calendar link may have got out.
 *
 * `SHARE_WARNING` has always ended "replace it if you paste it somewhere you
 * should not have", which asks somebody to remember a mistake. This is the
 * half that does not: a browser in the access log is the only thing visible
 * from inside the app that distinguishes a link sitting in one phone's
 * calendar from a link sitting in somebody else's.
 *
 * So the tests below are mostly about `suspect`, and about the line it
 * produces being one a person can act on rather than a number.
 */

const day = (d: string, client: string, hits: number): FeedFetch => ({
  day: d,
  what: 'calendar_feed',
  client,
  hits,
});

describe('a subscription doing exactly what it should', () => {
  it('says nothing has fetched it when nothing has', () => {
    const { line, suspect } = feedReaders([]);
    expect(suspect).toBe(false);
    expect(line).toContain('Nothing has fetched this link');
    // And explains the silence rather than leaving it to read as broken.
    expect(line).toContain('within a few hours of subscribing');
  });

  it('names the calendar app and does not raise an eyebrow', () => {
    const { line, suspect } = feedReaders([day('2026-09-16', 'apple', 42)]);
    expect(suspect).toBe(false);
    expect(line).toBe('Fetched 42 times in the last 30 days, by Apple Calendar.');
  });

  it('counts across days and lists more than one app', () => {
    const { line, suspect } = feedReaders([
      day('2026-09-16', 'apple', 20),
      day('2026-09-15', 'apple', 18),
      day('2026-09-15', 'google', 4),
    ]);
    expect(suspect).toBe(false);
    expect(line).toContain('Fetched 42 times');
    expect(line).toContain('Apple Calendar and Google Calendar');
  });

  it('says "time" once and "times" otherwise', () => {
    expect(feedReaders([day('2026-09-16', 'apple', 1)]).line).toContain('Fetched 1 time in');
    expect(feedReaders([day('2026-09-16', 'apple', 2)]).line).toContain('Fetched 2 times in');
  });
});

describe('the reading that is worth interrupting somebody for', () => {
  it('flags a browser, names the day, and says what to do', () => {
    const { line, suspect } = feedReaders([
      day('2026-09-16', 'apple', 40),
      day('2026-09-14', 'browser', 2),
    ]);
    expect(suspect).toBe(true);
    expect(line).toContain('2 of those were a web browser');
    // The day is what a student checks their own memory against — "was that
    // me?" is answerable about Monday and not about "recently".
    expect(line).toContain('2026-09-14');
    expect(line).toContain('replace it');
  });

  it('gives the most recent odd day rather than the first', () => {
    const { line } = feedReaders([
      day('2026-09-02', 'browser', 1),
      day('2026-09-15', 'browser', 1),
      day('2026-09-09', 'browser', 1),
    ]);
    expect(line).toContain('2026-09-15');
    expect(line).not.toContain('2026-09-02');
  });

  it('does not accuse the link of having leaked', () => {
    /*
     * The wording matters more than the logic here. A student who opened
     * their own link in a browser once — which is a reasonable thing to do,
     * and the QR code beside this makes it likelier — must not be told their
     * calendar is compromised. The line says what happened, says what it
     * usually means, and leaves them to know whether it was them.
     */
    const { line } = feedReaders([day('2026-09-14', 'browser', 1)]);
    expect(line).toContain('If that was not you');
    for (const word of ['leaked', 'compromised', 'breach', 'stolen', 'attacker']) {
      expect(line.toLowerCase(), `the line says "${word}"`).not.toContain(word);
    }
  });

  it('flags a client it does not recognise, and one that gave no name', () => {
    // `other` is a program that identified itself as something this app has
    // not learned; `unknown` sent no user agent at all. Neither is a calendar,
    // and a script scraping a leaked link is both of them before it is
    // anything else.
    expect(feedReaders([day('2026-09-14', 'other', 3)]).suspect).toBe(true);
    expect(feedReaders([day('2026-09-14', 'unknown', 3)]).suspect).toBe(true);
    expect(feedReaders([day('2026-09-14', 'other', 3)]).line).toContain(
      'something this app did not recognise',
    );
  });

  it('holds when there is no calendar app in the list at all', () => {
    // The case that reads worst and is the most alarming: the only thing ever
    // to fetch this feed was a browser. The sentence must not collapse into
    // "mostly by ." with the apps clause empty.
    const { line, suspect } = feedReaders([day('2026-09-14', 'browser', 5)]);
    expect(suspect).toBe(true);
    expect(line).not.toContain('mostly by');
    expect(line).toBe(
      'Fetched 5 times in the last 30 days — and 5 of those were a web browser, ' +
        'most recently on 2026-09-14. A calendar app is what should be reading this. ' +
        'If that was not you opening the link yourself, replace it.',
    );
  });
});

describe('what it leaves out', () => {
  it('ignores the reminder sender, which is not about this link', () => {
    /*
     * `access_log` holds both service-key paths, and only one of them is the
     * calendar. A push send counted here would make every account with
     * reminders switched on read as though its feed were being fetched — and
     * `device` is not a calendar family, so it would have been flagged.
     */
    const { line, suspect } = feedReaders([
      { day: '2026-09-16', what: 'push_send', client: 'device', hits: 96 },
      day('2026-09-16', 'apple', 4),
    ]);
    expect(suspect).toBe(false);
    expect(line).toContain('Fetched 4 times');
    expect(line).not.toContain('96');
  });

  it('ignores a day that recorded nothing', () => {
    // A zero-hit row cannot be written by `note_access`, which inserts at one
    // — but the column allows it and a row that says a feed was fetched no
    // times should not make the screen say it was fetched.
    const { suspect, line } = feedReaders([day('2026-09-16', 'browser', 0)]);
    expect(suspect).toBe(false);
    expect(line).toContain('Nothing has fetched this link');
  });
});
