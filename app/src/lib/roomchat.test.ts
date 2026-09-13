import { describe, expect, it } from 'vitest';
import {
  EVERYONE,
  FACES,
  badge,
  bucket,
  clockAt,
  conversation,
  dayLabel,
  findRooms,
  findSaid,
  linkLabel,
  linksIn,
  listStamp,
  listed,
  mentionQuery,
  mentionable,
  mentionsMe,
  pieces,
  preview,
  shared,
  tally,
  unread,
  withMention,
  type Mark,
  type Say,
} from './roomchat';

const NOW = new Date('2026-09-11T15:00:00');

/** A message, with only the parts any of this reads. */
const say = (id: string, user_id: string, body: string, created_at: string): Say => ({
  id,
  user_id,
  body,
  created_at,
});

const PEOPLE = [
  { user_id: 'u1', handle: 'Kayo Miwa' },
  { user_id: 'u2', handle: 'Kian Lambert' },
  { user_id: 'u3', handle: 'Ray' },
  { user_id: 'u4', handle: 'Rayan Okoye' },
];
const HANDLES = PEOPLE.map((p) => p.handle);
const nameOf = (id: string) => PEOPLE.find((p) => p.user_id === id)?.handle ?? 'Someone';

describe('the clock', () => {
  it('writes the time the way the rest of the app does', () => {
    expect(clockAt('2026-09-11T15:42:00')).toBe('3:42p');
    expect(clockAt('2026-09-11T00:05:00')).toBe('12:05a');
    expect(clockAt('2026-09-11T12:00:00')).toBe('12:00p');
    expect(clockAt('not a date')).toBe('');
  });

  it('narrows the list stamp as the message gets older', () => {
    expect(listStamp('2026-09-11T09:15:00', NOW)).toBe('9:15a');
    expect(listStamp('2026-09-10T23:00:00', NOW)).toBe('Yesterday');
    expect(listStamp('2026-09-08T10:00:00', NOW)).toBe('Tue');
    expect(listStamp('2026-08-02T10:00:00', NOW)).toBe('2 Aug');
  });

  it('names the day above the first message of one', () => {
    expect(dayLabel('2026-09-11T09:15:00', NOW)).toBe('Today');
    expect(dayLabel('2026-09-10T09:15:00', NOW)).toBe('Yesterday');
    expect(dayLabel('2026-09-07T09:15:00', NOW)).toBe('Mon, 7 Sep');
  });
});

describe('mentions', () => {
  it('matches the longest handle, so a two-part name is one person', () => {
    const parts = pieces('morning @Kayo Miwa — did you get q3?', HANDLES);
    expect(parts.map((p) => p.mention).filter(Boolean)).toEqual(['Kayo Miwa']);
    expect(parts.find((p) => p.mention)?.text).toBe('@Kayo Miwa');
  });

  it('does not match a name inside a longer one', () => {
    // "@Ray" must not light up inside "@Rayan Okoye": the shorter handle is a
    // prefix of the longer, which is the case longest-first exists for.
    const parts = pieces('@Rayan Okoye can you post the notes', HANDLES);
    expect(parts.map((p) => p.mention).filter(Boolean)).toEqual(['Rayan Okoye']);
  });

  it('leaves an @ that matches nobody as plain text', () => {
    // Painting it would claim somebody is being told, and nobody is.
    const parts = pieces('email me at @nobody', HANDLES);
    expect(parts.every((p) => p.mention === undefined)).toBe(true);
    expect(parts.map((p) => p.text).join('')).toBe('email me at @nobody');
  });

  it('keeps the body intact however it is cut up', () => {
    const body = 'hey @Ray and @Kian Lambert, @class — room 210?';
    expect(
      pieces(body, HANDLES)
        .map((p) => p.text)
        .join(''),
    ).toBe(body);
  });

  it('knows when you are the one being addressed', () => {
    expect(mentionsMe('thanks @Ray', 'Ray', HANDLES)).toBe(true);
    expect(mentionsMe('thanks @ray', 'Ray', HANDLES)).toBe(true);
    expect(mentionsMe('thanks @Kian Lambert', 'Ray', HANDLES)).toBe(false);
    // The whole room counts as you.
    expect(mentionsMe(`@${EVERYONE} anyone got the slides?`, 'Ray', HANDLES)).toBe(true);
    // Nobody with no name is mentioned by anything.
    expect(mentionsMe('@class hello', '', HANDLES)).toBe(false);
  });

  it('finds the @ being typed, and gives up when the sentence moves on', () => {
    expect(mentionQuery('hey @kay', 8)).toEqual({ at: 4, query: 'kay' });
    expect(mentionQuery('hey @Kayo Mi', 12)).toEqual({ at: 4, query: 'Kayo Mi' });
    expect(mentionQuery('hey @Kayo Miwa are you there', 28)).toBeNull();
    expect(mentionQuery('email a@b.com', 13)).toBeNull();
    expect(mentionQuery('nothing here', 12)).toBeNull();
  });

  it('offers the names that start with what was typed first', () => {
    // Both K names lead; "Rayan Okoye" has a k in it and sorts under them.
    expect(mentionable(PEOPLE, 'k').map((p) => p.handle)).toEqual([
      'Kayo Miwa',
      'Kian Lambert',
      'Rayan Okoye',
    ]);
    expect(mentionable(PEOPLE, 'ka').map((p) => p.handle)).toEqual(['Kayo Miwa']);
    // A match anywhere in the name still counts, it just sorts below.
    expect(mentionable(PEOPLE, 'ay').map((p) => p.handle)).toEqual(['Kayo Miwa', 'Ray', 'Rayan Okoye']);
    expect(mentionable(PEOPLE, '').length).toBe(4);
    expect(mentionable(PEOPLE, 'zz')).toEqual([]);
  });

  it('completes the half-typed name and leaves the caret after it', () => {
    const done = withMention('hey @kay', 4, 8, 'Kayo Miwa');
    expect(done.text).toBe('hey @Kayo Miwa ');
    expect(done.caret).toBe(done.text.length);
    // What follows the caret is kept.
    expect(withMention('hey @kay there', 4, 8, 'Ray').text).toBe('hey @Ray  there');
  });
});

describe('the transcript', () => {
  const says = [
    say('1', 'u1', 'is the problem set up?', '2026-09-10T09:00:00'),
    say('2', 'u1', 'never mind, found it', '2026-09-10T09:02:00'),
    say('3', 'u2', 'q3 is the hard one', '2026-09-10T09:03:00'),
    say('4', 'u1', 'back — what did you get for q3?', '2026-09-10T10:30:00'),
    say('5', 'u1', 'today now', '2026-09-11T08:00:00'),
  ];

  it('gathers one person talking into one turn', () => {
    const days = conversation(says, NOW);
    expect(days.map((d) => d.label)).toEqual(['Yesterday', 'Today']);
    const yesterday = days[0].runs;
    expect(yesterday.map((r) => r.says.length)).toEqual([2, 1, 1]);
    expect(yesterday[0].user_id).toBe('u1');
    expect(yesterday[0].at).toBe('2026-09-10T09:00:00');
  });

  it('starts a new turn when the same person comes back later', () => {
    // 87 minutes later is somebody returning, not somebody still typing.
    const days = conversation(says, NOW);
    expect(days[0].runs[2].says[0].id).toBe('4');
  });

  it('puts a rule between days', () => {
    const days = conversation(says, NOW);
    expect(days[1].runs[0].says[0].id).toBe('5');
  });

  it('is empty for an empty room rather than a day with nothing in it', () => {
    expect(conversation([], NOW)).toEqual([]);
  });
});

describe('unread', () => {
  const says = [
    say('1', 'u1', 'morning', '2026-09-11T09:00:00'),
    say('2', 'me', 'morning', '2026-09-11T09:01:00'),
    say('3', 'u2', '@Ray did you finish?', '2026-09-11T09:02:00'),
    say('4', 'u1', 'same question', '2026-09-11T09:03:00'),
  ];

  it('counts what arrived after the mark, and never your own', () => {
    const seen = unread(says, '2026-09-11T09:00:00', 'me', 'Ray', HANDLES);
    expect(seen.count).toBe(2);
    expect(seen.firstId).toBe('3');
    expect(seen.mentions).toBe(1);
  });

  it('counts everything in a room you have never opened', () => {
    expect(unread(says, '', 'me').count).toBe(3);
  });

  it('counts nothing once the mark is past the last message', () => {
    const seen = unread(says, '2026-09-11T10:00:00', 'me');
    expect(seen).toEqual({ count: 0, firstId: null, mentions: 0 });
  });

  it('stops the badge from becoming a number nobody reads', () => {
    expect(badge(0)).toBe('');
    expect(badge(3)).toBe('3');
    expect(badge(9)).toBe('9');
    expect(badge(40)).toBe('9+');
  });
});

describe('the list of chats', () => {
  const rooms = [
    { key: 'vu/ECON 1020', code: 'ECON 1020', joined: true },
    { key: 'vu/PSCI 1104', code: 'PSCI 1104', joined: true },
    { key: 'vu/MATH 1300', code: 'MATH 1300', joined: false },
  ];
  const says = {
    'vu/ECON 1020': [say('1', 'u1', 'is the deck up?', '2026-09-11T09:00:00')],
    'vu/PSCI 1104': [say('2', 'u2', 'moved to room 210', '2026-09-11T14:00:00')],
  };
  const marks: Record<string, Mark> = {
    'vu/ECON 1020': { pinned: true, muted: false, read: '' },
  };

  it('puts pinned first and then whatever moved last', () => {
    const rows = listed(rooms, says, marks, 'me', nameOf, NOW);
    expect(rows.map((r) => r.code)).toEqual(['ECON 1020', 'PSCI 1104', 'MATH 1300']);
    expect(rows[0].pinned).toBe(true);
  });

  it('orders by activity once nothing is pinned', () => {
    const rows = listed(rooms, says, {}, 'me', nameOf, NOW);
    expect(rows.map((r) => r.code)).toEqual(['PSCI 1104', 'ECON 1020', 'MATH 1300']);
  });

  it('says who said the last thing, and when', () => {
    const rows = listed(rooms, says, marks, 'me', nameOf, NOW);
    expect(rows[0].preview).toBe('Kayo Miwa: is the deck up?');
    expect(rows[0].when).toBe('9:00a');
    expect(rows[0].unread).toBe(1);
  });

  it('says what an empty room and an unjoined one are', () => {
    const rows = listed(rooms, says, marks, 'me', nameOf, NOW);
    expect(rows.find((r) => r.code === 'MATH 1300')?.preview).toBe('Not in it yet');
    expect(listed([rooms[1]], {}, {}, 'me', nameOf, NOW)[0].preview).toBe('No messages yet');
  });

  it('searches the codes and the previews', () => {
    const rows = listed(rooms, says, marks, 'me', nameOf, NOW);
    expect(findRooms(rows, 'psci').map((r) => r.code)).toEqual(['PSCI 1104']);
    expect(findRooms(rows, 'deck').map((r) => r.code)).toEqual(['ECON 1020']);
    expect(findRooms(rows, '').length).toBe(3);
  });
});

describe('preview', () => {
  it('marks your own line as yours', () => {
    expect(preview(say('1', 'me', 'on my way', '2026-09-11T09:00:00'), 'me', nameOf)).toBe(
      'You: on my way',
    );
  });

  it('flattens newlines and cuts a long one', () => {
    const long = say('1', 'u1', `a\nb\n${'x'.repeat(200)}`, '2026-09-11T09:00:00');
    const line = preview(long, 'me', nameOf, 30);
    expect(line.length).toBe(30);
    expect(line.startsWith('Kayo Miwa: a b')).toBe(true);
    expect(line.endsWith('…')).toBe(true);
  });
});

describe('find in chat', () => {
  const says = [
    say('1', 'u1', 'the midterm is on the 20th', '2026-09-09T09:00:00'),
    say('2', 'u2', 'which midterm', '2026-09-10T09:00:00'),
    say('3', 'u1', 'nothing to do with it', '2026-09-11T09:00:00'),
  ];

  it('answers with the newest match first', () => {
    expect(findSaid(says, 'midterm').map((s) => s.id)).toEqual(['2', '1']);
  });

  it('answers nothing at all for an empty query', () => {
    expect(findSaid(says, '  ')).toEqual([]);
  });
});

describe('reactions', () => {
  const rows = [
    { message_id: 'm1', user_id: 'u1', emoji: '👍' },
    { message_id: 'm1', user_id: 'me', emoji: '👍' },
    { message_id: 'm1', user_id: 'u2', emoji: '😄' },
    { message_id: 'm2', user_id: 'u1', emoji: '🙏' },
  ];

  it('counts them per message and knows which one is yours', () => {
    const per = tally(rows, 'me', nameOf);
    expect(per.m1.map((t) => [t.emoji, t.count, t.mine])).toEqual([
      ['👍', 2, true],
      ['😄', 1, false],
    ]);
    expect(per.m1[0].who).toEqual(['Kayo Miwa', 'You']);
    expect(per.m2[0].emoji).toBe('🙏');
  });

  it('keeps the picker order, so nothing moves under a finger', () => {
    const per = tally(
      [
        { message_id: 'm1', user_id: 'u1', emoji: '😕' },
        { message_id: 'm1', user_id: 'u2', emoji: '👍' },
      ],
      'me',
      nameOf,
    );
    expect(per.m1.map((t) => t.emoji)).toEqual(['👍', '😕']);
    expect(FACES[0]).toBe('👍');
  });
});

describe('what has been shared', () => {
  const paperOf = (body: string) => /\bPAPER-([A-Z0-9]+)\b/.exec(body)?.[0] ?? null;
  const says = [
    say('1', 'u1', 'slides: https://example.edu/econ/week3.pdf', '2026-09-09T09:00:00'),
    say('2', 'u2', 'sit PAPER-7Q2 with me', '2026-09-10T09:00:00'),
    say('3', 'u1', 'nothing here', '2026-09-11T09:00:00'),
  ];

  it('finds the links in a message', () => {
    expect(linksIn('see https://a.edu/x, and http://b.org')).toEqual([
      'https://a.edu/x',
      'http://b.org',
    ]);
    expect(linksIn('no links at all')).toEqual([]);
  });

  it('names a link by where it goes rather than by its whole address', () => {
    expect(linkLabel('https://www.example.edu/econ/week3.pdf')).toBe('example.edu/week3.pdf');
    expect(linkLabel('https://example.edu')).toBe('example.edu');
    expect(linkLabel('not a url')).toBe('not a url');
  });

  it('lists links and papers, newest first', () => {
    const out = shared(says, nameOf, paperOf);
    expect(out.map((s) => [s.kind, s.label])).toEqual([
      ['paper', 'PAPER-7Q2'],
      ['link', 'example.edu/week3.pdf'],
    ]);
    expect(out[0].by).toBe('Kian Lambert');
  });
});

describe('bucket', () => {
  it('splits one query into the rooms it came from, oldest first', () => {
    const rows = [
      { ...say('2', 'u1', 'b', '2026-09-11T10:00:00'), code: 'ECON 1020' },
      { ...say('1', 'u1', 'a', '2026-09-11T09:00:00'), code: 'ECON 1020' },
      { ...say('3', 'u2', 'c', '2026-09-11T11:00:00'), code: 'PSCI 1104' },
    ];
    const per = bucket(rows, (s) => s.code);
    expect(per['ECON 1020'].map((s) => s.id)).toEqual(['1', '2']);
    expect(per['PSCI 1104'].map((s) => s.id)).toEqual(['3']);
  });
});
