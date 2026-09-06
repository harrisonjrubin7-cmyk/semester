import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  PROVIDERS,
  addEvent,
  addTask,
  describe as explain,
  fetchRemoteText,
  forget,
  listMail,
  listRemoteFiles,
  pullCalendar,
  tokens,
  type ProviderId,
} from './connect';
import type { Course } from './types';

/**
 * What this file is really testing.
 *
 * Almost everything here is a call to somebody else's server, and mocking a
 * server to prove it was called is a test of the mock. What is worth pinning
 * down is the part on this side of the wire: the shape each provider answers
 * in, and what that turns into. Three vendors describe a calendar entry three
 * different ways and the app has to land them all on the same day — which is
 * exactly the kind of thing that is wrong for months without anybody being
 * able to say why their reading week looks a day out.
 *
 * So: a real `pullCalendar`, a stubbed `fetch` handing back the JSON each
 * vendor actually sends, and assertions about the dates that come out.
 */

const course = (id: string, code: string): Course => ({
  id,
  code,
  name: '',
  prof: '',
  email: '',
  meets: '',
  room: '',
  credits: '',
  source: '',
  grading: [],
});

const COURSES = [course('econ', 'ECON 1020'), course('psci', 'PSCI 1104')];

/** A localStorage that lives in a plain object, since tests run without a DOM. */
function fakeStorage() {
  const map = new Map<string, string>();
  return {
    getItem: (k: string) => map.get(k) ?? null,
    setItem: (k: string, v: string) => void map.set(k, v),
    removeItem: (k: string) => void map.delete(k),
    clear: () => map.clear(),
    key: () => null,
    length: 0,
  } as unknown as Storage;
}

/** Signed in to `id`, with an hour left on the token so nothing refreshes. */
function connected(id: ProviderId) {
  localStorage.setItem(
    'semester.tokens.v1',
    JSON.stringify({
      [id]: {
        provider: id,
        access: 'a-token',
        refresh: 'r',
        expires: Date.now() + 3_600_000,
        account: 'someone@x.edu',
      },
    }),
  );
}

let calls: { url: string; init?: RequestInit }[] = [];

/** Answers every request with `body`, and records what was asked for. */
function answering(body: unknown, ok = true, status = 200) {
  const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
    calls.push({ url: String(url), init });
    return {
      ok,
      status,
      json: async () => body,
      text: async () => (typeof body === 'string' ? body : JSON.stringify(body)),
    } as Response;
  });
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

beforeEach(() => {
  calls = [];
  vi.stubGlobal('localStorage', fakeStorage());
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('the provider table', () => {
  it('tells someone with no client ID where to go and get one', () => {
    // Shown on the Connect screen when a build has no key registered. It is
    // a path through somebody else's console rather than a link, because the
    // page you actually need is several clicks in and its URL is not stable.
    for (const spec of Object.values(PROVIDERS)) {
      expect(spec.console).toContain('→');
      expect(spec.console.split('→')[0].trim()).toMatch(/\./);
      expect(spec.name).toBeTruthy();
    }
  });

  it('is honest about which providers have no calendar to read', () => {
    // Apple is sign-in only: there is no iCloud calendar API, and offering a
    // "pull my calendar" button that always fails would be worse than saying
    // so. It carries a caveat because it has to explain itself.
    expect(PROVIDERS.apple.calendar).toBe(false);
    expect(PROVIDERS.apple.caveat).toBeTruthy();
    expect(PROVIDERS.microsoft.calendar).toBe(true);
    expect(PROVIDERS.google.calendar).toBe(true);
  });

  it('keys every provider by its own id', () => {
    for (const [key, spec] of Object.entries(PROVIDERS)) expect(spec.id).toBe(key);
  });
});

describe('tokens and forget', () => {
  it('reads nothing out of empty storage rather than throwing', () => {
    expect(tokens()).toEqual({});
  });

  it('survives storage holding something that is not JSON', () => {
    // A half-written value, or another tool's key collision. Signing in again
    // is a recoverable state; a crash on module load is not.
    localStorage.setItem('semester.tokens.v1', 'not json{');
    expect(tokens()).toEqual({});
  });

  it('drops one provider and leaves the others connected', () => {
    connected('google');
    localStorage.setItem(
      'semester.tokens.v1',
      JSON.stringify({
        ...tokens(),
        microsoft: { provider: 'microsoft', access: 'm', refresh: '', expires: 1, account: '' },
      }),
    );
    forget('google');
    expect(tokens().google).toBeUndefined();
    expect(tokens().microsoft).toBeTruthy();
  });

  it('forgets a provider that was never connected without complaint', () => {
    expect(() => forget('zoom')).not.toThrow();
  });
});

describe('pullCalendar — Microsoft', () => {
  const graph = (over: Record<string, unknown> = {}) => ({
    value: [
      {
        id: 'm1',
        subject: 'ECON 1020 lecture',
        isAllDay: false,
        start: { dateTime: '2026-09-20T14:00:00.0000000' },
        location: { displayName: 'Buttrick 101' },
        bodyPreview: 'Bring the reading',
        ...over,
      },
    ],
  });

  it('reads a timed event into a date, an hour and a place', async () => {
    connected('microsoft');
    answering(graph());
    const [event] = await pullCalendar(COURSES, 'microsoft');
    expect(event.title).toBe('ECON 1020 lecture');
    expect(event.where).toBe('Buttrick 101');
    expect(event.courseId).toBe('econ');
    expect(event.at).not.toBeNull();
  });

  it('puts an all-day event on the day the calendar says, in any timezone', async () => {
    /*
     * The bug this was written for.
     *
     * Graph returns every start as a UTC instant, so an all-day event on the
     * 20th arrives as midnight UTC on the 20th — and the day was read back
     * with local getters, which in Nashville is seven in the evening on the
     * 19th. Reading week showed a day early, for everyone west of Greenwich
     * and nobody else, which is why a UTC test runner never saw it.
     */
    connected('microsoft');
    answering(graph({ isAllDay: true, start: { dateTime: '2026-09-20T00:00:00.0000000' } }));
    const [event] = await pullCalendar(COURSES, 'microsoft');
    expect(event.date).toBe('2026-09-20');
    expect(event.at).toBeNull();
    expect(event.time).toBe('All day');
  });

  it('names an untitled event rather than showing a blank row', async () => {
    connected('microsoft');
    answering(graph({ subject: '' }));
    expect((await pullCalendar(COURSES, 'microsoft'))[0].title).toBe('Untitled');
  });

  it('copes with an event that has no place and no body', async () => {
    connected('microsoft');
    answering(graph({ location: undefined, bodyPreview: undefined }));
    const [event] = await pullCalendar(COURSES, 'microsoft');
    expect(event.where).toBe('');
    expect(event.note).toBe('');
  });

  it('asks only for the window it is going to show', async () => {
    connected('microsoft');
    answering({ value: [] });
    await pullCalendar(COURSES, 'microsoft');
    expect(calls[0].url).toContain('startDateTime=');
    expect(calls[0].url).toContain('endDateTime=');
  });

  it('sends the token as a bearer header', async () => {
    connected('microsoft');
    answering({ value: [] });
    await pullCalendar(COURSES, 'microsoft');
    const headers = calls[0].init?.headers as Record<string, string> | undefined;
    expect(headers?.Authorization).toBe('Bearer a-token');
  });
});

describe('pullCalendar — Google', () => {
  const gcal = (start: Record<string, string>) => ({
    items: [
      {
        id: 'g1',
        summary: 'PSCI 1104 seminar',
        location: 'Calhoun 110',
        description: 'Week 3',
        start,
      },
    ],
  });

  it('reads a timed event, and shows it on the reader’s own day', async () => {
    /*
     * No absolute date asserted here, deliberately.
     *
     * A timed event is an instant, and 2pm in Chicago really is the small
     * hours of the next morning in Tokyo — showing it on the reader's day is
     * correct, not a bug, and a test that pinned the date would only be
     * asserting where the test runner happens to sit. The invariant that does
     * hold for a timed event is that it keeps its hour; the one that holds
     * across timezones is tested below, on all-day events, which are dates
     * rather than instants.
     */
    connected('google');
    answering(gcal({ dateTime: '2026-09-20T14:00:00-05:00' }));
    const [event] = await pullCalendar(COURSES, 'google');
    expect(event.courseId).toBe('psci');
    expect(event.at).not.toBeNull();
    expect(event.time).toMatch(/^\d{1,2}:\d{2}[ap]$/);
  });

  it('reads an all-day event from the date Calendar sends for one', async () => {
    // Google sends `date` rather than `dateTime` for all-day, which is a date
    // with no instant in it and must stay one.
    connected('google');
    answering(gcal({ date: '2026-09-20' }));
    const [event] = await pullCalendar(COURSES, 'google');
    expect(event.date).toBe('2026-09-20');
    expect(event.at).toBeNull();
    expect(event.time).toBe('All day');
  });

  it('lands an all-day event on the same day as Microsoft would', async () => {
    // Two vendors, two encodings, one day. This is the invariant that broke.
    connected('google');
    answering(gcal({ date: '2026-09-20' }));
    const [fromGoogle] = await pullCalendar(COURSES, 'google');

    connected('microsoft');
    answering({
      value: [
        {
          id: 'm1',
          subject: 'x',
          isAllDay: true,
          start: { dateTime: '2026-09-20T00:00:00.0000000' },
        },
      ],
    });
    const [fromMicrosoft] = await pullCalendar(COURSES, 'microsoft');

    expect(fromMicrosoft.date).toBe(fromGoogle.date);
  });
});

describe('pullCalendar — Zoom', () => {
  it('reads scheduled meetings, and skips one with no time', async () => {
    // A recurring meeting with no fixed occurrence comes back without a
    // `start_time`. Dating it "now" would put it on today, every day.
    connected('zoom');
    answering({
      meetings: [
        { id: 1, topic: 'ECON 1020 office hours', start_time: '2026-09-20T14:00:00Z', join_url: 'https://zoom.us/j/1' },
        { id: 2, topic: 'No time on this one' },
      ],
    });
    const events = await pullCalendar(COURSES, 'zoom');
    expect(events).toHaveLength(1);
    expect(events[0].courseId).toBe('econ');
    expect(events[0].where).toBe('https://zoom.us/j/1');
  });

  it('names an untitled meeting', async () => {
    connected('zoom');
    answering({ meetings: [{ id: 3, topic: '', start_time: '2026-09-20T14:00:00Z' }] });
    expect((await pullCalendar(COURSES, 'zoom'))[0].title).toBe('Zoom meeting');
  });
});

describe('pullCalendar — refusals', () => {
  it('says plainly that Apple has no calendar to read', async () => {
    connected('apple');
    answering({});
    await expect(pullCalendar(COURSES, 'apple')).rejects.toThrow(/no calendar API/i);
  });

  it('says a provider is not connected rather than sending an empty token', async () => {
    answering({ value: [] });
    await expect(pullCalendar(COURSES, 'microsoft')).rejects.toThrow(/not connected/i);
  });

  it('reports the status when the provider refuses', async () => {
    connected('microsoft');
    answering({}, false, 401);
    await expect(pullCalendar(COURSES, 'microsoft')).rejects.toThrow(/401/);
  });
});

describe('listRemoteFiles', () => {
  it('reads Drive files into the app’s own shape', async () => {
    connected('google');
    answering({
      files: [
        {
          id: 'f1',
          name: 'Syllabus.pdf',
          webViewLink: 'https://drive.google.com/f1',
          modifiedTime: '2026-09-01T10:00:00Z',
          mimeType: 'application/pdf',
        },
      ],
    });
    const [file] = await listRemoteFiles('google');
    expect(file).toMatchObject({ id: 'f1', name: 'Syllabus.pdf', modified: '2026-09-01' });
    expect(file.link).toContain('drive.google.com');
    expect(file.download).toContain('alt=media');
  });

  it('exports a Google Doc rather than trying to download it', async () => {
    // A Doc has no bytes behind it. Asking for them gets a 403; asking for a
    // plain-text export gets what the card parser wants anyway.
    connected('google');
    answering({
      files: [{ id: 'f1', name: 'Notes', webViewLink: '', modifiedTime: '', mimeType: 'application/vnd.google-apps.document' }],
    });
    expect((await listRemoteFiles('google'))[0].download).toContain('export?mimeType=text/plain');
  });

  it('keeps listing the rest when one file comes back without a type', async () => {
    // Drive returns the fields it was asked for, but not always for every
    // file. Losing the whole list to one odd row is the wrong trade — the
    // list is how somebody attaches a reading to a course.
    connected('google');
    answering({
      files: [
        { id: 'f1', name: 'Odd one', webViewLink: '', modifiedTime: '' },
        { id: 'f2', name: 'Syllabus.pdf', webViewLink: '', modifiedTime: '', mimeType: 'application/pdf' },
      ],
    });
    const files = await listRemoteFiles('google');
    expect(files.map((f) => f.name)).toEqual(['Odd one', 'Syllabus.pdf']);
    expect(files[0].download).toContain('alt=media');
  });

  it('reads OneDrive files into the same shape', async () => {
    connected('microsoft');
    answering({
      value: [
        { id: 'f2', name: 'Reading.docx', webUrl: 'https://onedrive/f2', lastModifiedDateTime: '2026-09-01T10:00:00Z' },
      ],
    });
    const [file] = await listRemoteFiles('microsoft');
    expect(file).toMatchObject({ id: 'f2', name: 'Reading.docx' });
  });

  it('refuses a provider with no files to list', async () => {
    connected('zoom');
    answering({});
    await expect(listRemoteFiles('zoom')).rejects.toThrow();
  });
});

describe('fetchRemoteText', () => {
  it('refuses a file the provider will not hand over directly', async () => {
    // A Google Doc has no bytes to download; it has to be exported. Saying so
    // beats a request that fails with somebody else's wording.
    connected('google');
    answering('');
    await expect(
      fetchRemoteText('google', { id: 'f1', name: 'x', link: '', download: '', modified: '' }),
    ).rejects.toThrow(/no direct download/i);
  });

  it('returns the text when there is something to fetch', async () => {
    connected('google');
    answering('The syllabus says…');
    const text = await fetchRemoteText('google', {
      id: 'f1',
      name: 'x',
      link: '',
      download: 'https://example.test/f1',
      modified: '',
    });
    expect(text).toBe('The syllabus says…');
  });
});

describe('listMail', () => {
  it('asks for nothing at all when there are no courses to look for', async () => {
    // The search is built out of course codes. With none, there is no query
    // worth sending and no inbox worth reading.
    const fetchMock = answering({ value: [] });
    expect(await listMail([], 'microsoft')).toEqual([]);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('files a message against the course it names', async () => {
    connected('microsoft');
    answering({
      value: [
        {
          id: 'm1',
          subject: 'ECON 1020: reading swapped',
          bodyPreview: 'Chapter 5 instead of 4',
          from: { emailAddress: { name: 'Dr. Stromme', address: 's@x.edu' } },
          receivedDateTime: '2026-09-01T10:00:00Z',
          webLink: 'https://outlook/m1',
        },
      ],
    });
    const [mail] = await listMail(COURSES, 'microsoft');
    expect(mail.courseId).toBe('econ');
    expect(mail.subject).toContain('reading swapped');
  });
});

describe('addEvent and addTask', () => {
  it('writes a timed event with the device’s own timezone attached', async () => {
    connected('google');
    answering({});
    await addEvent('google', { title: 'Study', date: '2026-09-20', at: 600, minutes: 60, note: '' });
    const body = JSON.parse(String(calls[0].init?.body));
    expect(body.start.dateTime).toBe('2026-09-20T10:00:00');
    expect(body.end.dateTime).toBe('2026-09-20T11:00:00');
    expect(body.start.timeZone).toBeTruthy();
  });

  it('rolls an event past midnight rather than writing an impossible hour', async () => {
    // 23:30 plus an hour is 00:30 the next day, not 24:30 on the same one.
    connected('google');
    answering({});
    await addEvent('google', { title: 'Late', date: '2026-09-20', at: 1410, minutes: 60, note: '' });
    const body = JSON.parse(String(calls[0].init?.body));
    expect(body.end.dateTime).toBe('2026-09-21T00:30:00');
  });

  it('writes an all-day event as a date, with no hour in it', async () => {
    connected('google');
    answering({});
    await addEvent('google', { title: 'Reading week', date: '2026-09-20', at: null, minutes: 0, note: '' });
    const body = JSON.parse(String(calls[0].init?.body));
    expect(body.start).toEqual({ date: '2026-09-20' });
  });

  it('refuses to write to a provider with no calendar', async () => {
    connected('zoom');
    answering({});
    await expect(
      addEvent('zoom', { title: 'x', date: '2026-09-20', at: 600, minutes: 60, note: '' }),
    ).rejects.toThrow(/no calendar/i);
  });

  it('says so when the account has no task list at all', async () => {
    connected('microsoft');
    answering({ value: [] });
    await expect(addTask('microsoft', { title: 'x', date: null, note: '' })).rejects.toThrow(
      /no To Do list/i,
    );
  });

  it('writes a task with no due date when it has none', async () => {
    connected('google');
    answering({});
    await addTask('google', { title: 'Read chapter 4', date: null, note: '' });
    const body = JSON.parse(String(calls[0].init?.body));
    expect(body.title).toBe('Read chapter 4');
    expect(body.due).toBeUndefined();
  });
});

describe('describe', () => {
  it('turns a blocked browser call into the reason it was blocked', () => {
    // "Failed to fetch" is what a browser says for CORS, and it reads like the
    // network is down. It is not: the provider refuses browser calls and the
    // build needs the proxy.
    expect(explain(new Error('Failed to fetch'))).toMatch(/VITE_OAUTH_PROXY/);
    expect(explain(new TypeError('NetworkError when attempting to fetch'))).toMatch(/proxy/i);
  });

  it('passes anything else through untouched, rather than guessing', () => {
    expect(explain(new Error('Microsoft said 403.'))).toBe('Microsoft said 403.');
  });

  it('copes with something thrown that was never an Error', () => {
    expect(explain('a bare string')).toBe('a bare string');
    expect(explain(null)).toBe('null');
  });
});
