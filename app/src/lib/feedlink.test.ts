import { describe, expect, it, vi } from 'vitest';
import { describeHost, fetchCalendar, isCalendar, notCalendar, proxied, readLink } from './feedlink';

const CAL = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'END:VCALENDAR'].join('\r\n');

/** One canned answer, shaped like the bit of `Response` the code touches. */
const answer = (body: string, status = 200) =>
  ({ ok: status >= 200 && status < 300, status, text: () => Promise.resolve(body) }) as Response;

const ok = (input: string) => {
  const out = readLink(input);
  if (!out.ok) throw new Error(`expected a link, got: ${out.why}`);
  return out.link;
};

describe('readLink', () => {
  it('takes an https link as it is', () => {
    expect(ok('https://calendar.example.edu/feed.ics').url).toBe(
      'https://calendar.example.edu/feed.ics',
    );
  });

  it('turns webcal into https, which is all webcal ever was', () => {
    expect(ok('webcal://outlook.office365.com/owa/calendar/abc/calendar.ics').url).toBe(
      'https://outlook.office365.com/owa/calendar/abc/calendar.ics',
    );
    expect(ok('webcals://p12-calendars.icloud.com/published/2/xyz').url.startsWith('https://')).toBe(
      true,
    );
  });

  it('adds the scheme a copy button dropped', () => {
    expect(ok('brightspace.vanderbilt.edu/d2l/le/calendar/feed/user/feed.ics?token=k').url).toBe(
      'https://brightspace.vanderbilt.edu/d2l/le/calendar/feed/user/feed.ics?token=k',
    );
  });

  it('upgrades http, because the page cannot fetch plain http anyway', () => {
    expect(ok('http://calendar.example.edu/feed.ics').url).toBe(
      'https://calendar.example.edu/feed.ics',
    );
  });

  it('strips what a mail client wrapped round it', () => {
    expect(ok('<https://calendar.example.edu/feed.ics>').url).toBe(
      'https://calendar.example.edu/feed.ics',
    );
    expect(ok('  "https://calendar.example.edu/feed.ics"  ').url).toBe(
      'https://calendar.example.edu/feed.ics',
    );
  });

  it('turns a Google embed page into the public feed behind it', () => {
    expect(
      ok('https://calendar.google.com/calendar/embed?src=abc%40group.calendar.google.com&ctz=UTC')
        .url,
    ).toBe(
      'https://calendar.google.com/calendar/ical/abc%40group.calendar.google.com/public/basic.ics',
    );
  });

  it('leaves a Google secret-address feed alone', () => {
    const url = 'https://calendar.google.com/calendar/ical/abc%40group.calendar.google.com/private-key/basic.ics';
    expect(ok(url).url).toBe(url);
  });

  it('names the provider from the host', () => {
    expect(ok('https://brightspace.vanderbilt.edu/x.ics').kind).toBe('brightspace');
    expect(ok('https://outlook.office365.com/owa/calendar/a/calendar.ics').kind).toBe('microsoft');
    expect(ok('https://outlook.live.com/owa/calendar/a/calendar.ics').name).toBe('Outlook calendar');
    expect(ok('https://calendar.google.com/calendar/ical/a/basic.ics').name).toBe('Google Calendar');
    expect(ok('https://p12-calendars.icloud.com/published/2/x').name).toBe('iCloud calendar');
    expect(ok('https://canvas.instructure.com/feeds/calendars/x.ics').name).toBe('Canvas');
  });

  it('falls back to the host as the name, without www', () => {
    expect(describeHost('www.myschool.edu')).toEqual({ kind: 'ics', name: 'myschool.edu' });
  });

  it('refuses what is not a web address, with a reason', () => {
    expect(readLink('')).toEqual({ ok: false, why: expect.stringContaining('Paste') });
    expect(readLink('my calendar')).toMatchObject({ ok: false });
    expect(readLink('javascript:alert(1)')).toMatchObject({ ok: false });
    expect(readLink('mailto:someone@example.edu')).toMatchObject({ ok: false });
    expect(readLink('file:///Users/me/cal.ics')).toMatchObject({ ok: false });
  });

  it('refuses a scheme it cannot fetch by name, so the reason is actionable', () => {
    const out = readLink('ftp://example.edu/cal.ics');
    expect(out.ok).toBe(false);
    if (!out.ok) expect(out.why).toContain('ftp:');
  });
});

describe('isCalendar', () => {
  it('knows a calendar from a web page', () => {
    expect(isCalendar(CAL)).toBe(true);
    expect(isCalendar('<!doctype html><html><body>Sign in</body></html>')).toBe(false);
    expect(isCalendar('')).toBe(false);
  });
});

describe('notCalendar', () => {
  it('reads a sign-in page as a wrong link rather than an empty calendar', () => {
    expect(notCalendar('<!doctype html><html>…')).toContain('web page');
  });

  it('says so when nothing came back at all', () => {
    expect(notCalendar('   ')).toContain('nothing');
  });
});

describe('fetchCalendar', () => {
  it('uses the direct route when the host allows it, and never touches the proxy', async () => {
    const fetcher = vi.fn().mockResolvedValue(answer(CAL));
    const out = await fetchCalendar('https://example.edu/f.ics', { fetcher: fetcher as unknown as typeof fetch });
    expect(out).toEqual({ text: CAL, via: 'direct' });
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(fetcher).toHaveBeenCalledWith('https://example.edu/f.ics', { redirect: 'follow' });
  });

  it('falls back to the proxy when the browser is refused', async () => {
    const fetcher = vi
      .fn()
      .mockRejectedValueOnce(new TypeError('Failed to fetch'))
      .mockResolvedValueOnce(answer(CAL));
    const out = await fetchCalendar('https://example.edu/f.ics', { fetcher: fetcher as unknown as typeof fetch });
    expect(out.via).toBe('proxy');
    expect(fetcher).toHaveBeenLastCalledWith(proxied('https://example.edu/f.ics'), {
      redirect: 'follow',
    });
  });

  /*
   * The failure this whole two-route design exists for: a static host answers
   * every unknown path with its own index.html and a 200, so "it worked" has
   * to mean "it is a calendar" rather than "the status was fine".
   */
  it('does not accept a single-page host answering the proxy path with index.html', async () => {
    const fetcher = vi
      .fn()
      .mockRejectedValueOnce(new TypeError('Failed to fetch'))
      .mockResolvedValueOnce(answer('<!doctype html><div id="root"></div>'));
    await expect(
      fetchCalendar('https://example.edu/f.ics', { fetcher: fetcher as unknown as typeof fetch }),
    ).rejects.toThrow(/could not reach/i);
  });

  it('reports what the calendar itself said over a missing proxy', async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValueOnce(answer('Forbidden', 403))
      .mockResolvedValueOnce(answer('Not found', 404));
    await expect(
      fetchCalendar('https://example.edu/f.ics', { fetcher: fetcher as unknown as typeof fetch }),
    ).rejects.toThrow(/answered 403/);
  });

  it('always points at the file route, which needs nothing', async () => {
    const fetcher = vi.fn().mockResolvedValue(answer('nope', 500));
    await expect(
      fetchCalendar('https://example.edu/f.ics', { fetcher: fetcher as unknown as typeof fetch }),
    ).rejects.toThrow(/\.ics/);
  });
});

describe('fetchCalendar, through the account', () => {
  const refused = () => vi.fn().mockRejectedValue(new TypeError('Failed to fetch'));

  it('is the route that works on a deployed build', async () => {
    const account = vi.fn().mockResolvedValue(CAL);
    const out = await fetchCalendar('https://example.edu/f.ics', {
      fetcher: refused() as unknown as typeof fetch,
      account,
    });
    expect(out).toEqual({ text: CAL, via: 'account' });
    expect(account).toHaveBeenCalledWith('https://example.edu/f.ics');
  });

  it('is not reached when the calendar answered the browser itself', async () => {
    const account = vi.fn();
    const fetcher = vi.fn().mockResolvedValue(answer(CAL));
    await fetchCalendar('https://example.edu/f.ics', {
      fetcher: fetcher as unknown as typeof fetch,
      account,
    });
    expect(account).not.toHaveBeenCalled();
  });

  it('says what the function said, because it knows most about the failure', async () => {
    const account = vi.fn().mockRejectedValue(new Error('That session is not valid. Sign in again.'));
    await expect(
      fetchCalendar('https://example.edu/f.ics', {
        fetcher: refused() as unknown as typeof fetch,
        account,
      }),
    ).rejects.toThrow(/session is not valid/);
  });

  /* Signed out is not a failure worth putting in front of somebody: it is the
     ordinary state of the app, and the useful sentence is the network one. */
  it('keeps the network reason when the account route is simply signed out', async () => {
    const account = vi.fn().mockRejectedValue(new Error('Signed out.'));
    await expect(
      fetchCalendar('https://example.edu/f.ics', {
        fetcher: refused() as unknown as typeof fetch,
        account,
      }),
    ).rejects.toThrow(/could not reach that calendar directly/);
  });
});
