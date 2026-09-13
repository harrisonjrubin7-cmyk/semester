import { describe, expect, it } from 'vitest';
import {
  asleep,
  bucket,
  buckets,
  categoryOf,
  clockTime,
  conversations,
  draftAsMail,
  fullStamp,
  inFolder,
  initials,
  listing,
  marked,
  matches,
  pageLabel,
  pages,
  parseAddress,
  parseAddresses,
  parseQuery,
  participants,
  prefill,
  quoted,
  reSubject,
  snoozeOptions,
  splitQuote,
  stamp,
  unread,
  type Mail,
  type MailDraft,
  type Marks,
} from './mailbox';

/** A Thursday morning, built from local parts so the suite passes in any zone. */
const NOW = new Date(2026, 8, 10, 9, 30, 0);

const at = (days: number, hour = 9, minute = 1) =>
  new Date(2026, 8, 10 - days, hour, minute, 0).getTime();

function mail(over: Partial<Mail> = {}): Mail {
  return {
    id: 'm1',
    source: 'google',
    threadId: 't1',
    from: { name: 'John Stromme', address: 'john.stromme@vanderbilt.edu' },
    to: [{ name: 'You', address: 'you@vanderbilt.edu' }],
    cc: [],
    subject: 'Problem set 2',
    snippet: 'The deadline has moved to Friday.',
    body: 'The deadline has moved to Friday.',
    at: at(0),
    unread: true,
    starred: false,
    folder: 'inbox',
    labels: [],
    attachments: 0,
    link: 'https://mail.google.com/mail/u/0/#inbox/m1',
    courseId: 'econ',
    ...over,
  };
}

describe('addresses', () => {
  it('splits a name off an angled address', () => {
    expect(parseAddress('Jake from GPTZero <jake@gptzero.me>')).toEqual({
      name: 'Jake from GPTZero',
      address: 'jake@gptzero.me',
    });
  });

  it('keeps a bare address as both halves', () => {
    expect(parseAddress('dean@vanderbilt.edu')).toEqual({
      name: 'dean@vanderbilt.edu',
      address: 'dean@vanderbilt.edu',
    });
  });

  it('unquotes a name that carries a comma', () => {
    const list = parseAddresses('"Stromme, John" <j@v.edu>, ta@v.edu');
    expect(list).toHaveLength(2);
    expect(list[0]).toEqual({ name: 'Stromme, John', address: 'j@v.edu' });
    expect(list[1].address).toBe('ta@v.edu');
  });

  it('takes two letters for the avatar, and one from a single word', () => {
    expect(initials({ name: 'John Stromme', address: 'j@v.edu' })).toBe('JS');
    expect(initials({ name: 'Registrar', address: 'r@v.edu' })).toBe('R');
    expect(initials({ name: '', address: 'r@v.edu' })).toBe('R');
  });

  it('names a conversation by its first names, and counts the rest', () => {
    const list = [
      mail({ from: { name: 'John Stromme', address: 'a@v.edu' } }),
      mail({ from: { name: 'Ada Li', address: 'b@v.edu' } }),
      mail({ from: { name: 'John Stromme', address: 'a@v.edu' } }),
      mail({ from: { name: 'Kai Moss', address: 'c@v.edu' } }),
      mail({ from: { name: 'Rae Vine', address: 'd@v.edu' } }),
    ];
    expect(participants(list)).toBe('John, Ada, Kai +1');
  });
});

describe('search', () => {
  it('reads the operators both clients take', () => {
    const q = parseQuery('from:stromme subject:"problem set" is:unread has:attachment deadline');
    expect(q.from).toEqual(['stromme']);
    expect(q.subject).toEqual(['problem set']);
    expect(q.is).toEqual(['unread']);
    expect(q.has).toEqual(['attachment']);
    expect(q.text).toEqual(['deadline']);
  });

  it('matches on sender, subject and body together', () => {
    expect(matches(mail(), parseQuery('from:stromme friday'))).toBe(true);
    expect(matches(mail(), parseQuery('from:trounstine'))).toBe(false);
  });

  it('holds is: and has: to the message', () => {
    expect(matches(mail({ unread: false }), parseQuery('is:unread'))).toBe(false);
    expect(matches(mail({ starred: true }), parseQuery('is:starred'))).toBe(true);
    expect(matches(mail(), parseQuery('has:attachment'))).toBe(false);
    expect(matches(mail({ attachments: 2 }), parseQuery('has:attachment'))).toBe(true);
  });

  it('searches every folder but the two you have to be standing in', () => {
    const mails = [
      mail({ id: 'a', folder: 'archive' }),
      mail({ id: 'b', folder: 'trash' }),
    ];
    const found = listing(mails, { folder: 'inbox', query: 'friday', now: NOW.getTime() });
    expect(found.map((m) => m.id)).toEqual(['a']);
    const inTrash = listing(mails, { folder: 'trash', query: 'friday', now: NOW.getTime() });
    expect(inTrash.map((m) => m.id)).toEqual(['b']);
  });
});

describe('marks', () => {
  it('puts your reading over the provider’s', () => {
    const marks: Marks = { m1: { read: true, star: true } };
    const seen = marked(mail(), marks);
    expect(seen.unread).toBe(false);
    expect(seen.starred).toBe(true);
  });

  it('moves a message without touching the one on the server', () => {
    const marks: Marks = { m1: { folder: 'archive' } };
    expect(inFolder(mail(), 'inbox', marks, NOW.getTime())).toBe(false);
    expect(inFolder(mail(), 'archive', marks, NOW.getTime())).toBe(true);
  });

  it('keeps a starred message out of Starred once it is in the trash', () => {
    const marks: Marks = { m1: { star: true, folder: 'trash' } };
    expect(inFolder(mail(), 'starred', marks, NOW.getTime())).toBe(false);
    expect(inFolder(mail(), 'trash', marks, NOW.getTime())).toBe(true);
  });

  it('holds a snoozed message out of the inbox until its hour', () => {
    const soon = { snooze: NOW.getTime() + 3600_000 };
    const past = { snooze: NOW.getTime() - 1 };
    expect(asleep(soon, NOW.getTime())).toBe(true);
    expect(asleep(past, NOW.getTime())).toBe(false);
    expect(inFolder(mail(), 'inbox', { m1: soon }, NOW.getTime())).toBe(false);
    expect(inFolder(mail(), 'snoozed', { m1: soon }, NOW.getTime())).toBe(true);
    expect(inFolder(mail(), 'inbox', { m1: past }, NOW.getTime())).toBe(true);
  });

  it('counts the unread in a folder through the marks', () => {
    const mails = [mail({ id: 'a' }), mail({ id: 'b' })];
    expect(unread(mails, 'inbox', {}, NOW.getTime())).toBe(2);
    expect(unread(mails, 'inbox', { a: { read: true } }, NOW.getTime())).toBe(1);
  });
});

describe('the tabs', () => {
  it('believes Gmail’s own category when it sends one', () => {
    expect(categoryOf(mail({ labels: ['CATEGORY_PROMOTIONS'], courseId: null }))).toBe('promotions');
  });

  it('never files a message about one of your courses as a promotion', () => {
    expect(categoryOf(mail({ snippet: '50% off, sale ends tonight' }))).toBe('primary');
  });

  it('guesses for Outlook, which categorises nothing', () => {
    const robot = mail({ courseId: null, from: { name: 'Zoom', address: 'no-reply@zoom.us' } });
    expect(categoryOf(robot)).toBe('updates');
    const shop = mail({ courseId: null, subject: 'Sale ends tonight', from: { name: 'Shop', address: 'hi@shop.com' } });
    expect(categoryOf(shop)).toBe('promotions');
  });

  it('only cuts the inbox by tab', () => {
    const mails = [mail({ id: 'a', courseId: null, labels: ['CATEGORY_PROMOTIONS'], folder: 'archive' })];
    const found = listing(mails, { folder: 'archive', category: 'primary', now: NOW.getTime() });
    expect(found).toHaveLength(1);
  });
});

describe('conversations', () => {
  it('gathers by the provider’s thread, newest conversation first', () => {
    const mails = [
      mail({ id: 'a', threadId: 't1', at: at(2) }),
      mail({ id: 'b', threadId: 't1', at: at(1), unread: false }),
      mail({ id: 'c', threadId: 't2', at: at(0), unread: false }),
    ];
    const threads = conversations(mails);
    expect(threads.map((t) => t.id)).toEqual(['t2', 't1']);
    const t1 = threads[1];
    expect(t1.mails.map((m) => m.id)).toEqual(['a', 'b']);
    expect(t1.last.id).toBe('b');
    expect(t1.unread).toBe(true);
  });
});

describe('dates', () => {
  it('writes the time today, the date this year and the year before that', () => {
    expect(stamp(at(0), NOW)).toBe('9:01 AM');
    expect(stamp(at(3), NOW)).toBe('Sep 7');
    expect(stamp(new Date(2025, 8, 10, 9, 1).getTime(), NOW)).toBe('9/10/25');
  });

  it('writes noon and midnight the way a clock does', () => {
    expect(clockTime(new Date(2026, 8, 10, 12, 5))).toBe('12:05 PM');
    expect(clockTime(new Date(2026, 8, 10, 0, 5))).toBe('12:05 AM');
  });

  it('spells the whole thing out in the reader', () => {
    expect(fullStamp(at(0))).toBe('Thu, Sep 10, 2026, 9:01 AM');
  });

  it('heads the list the way Outlook does', () => {
    expect(bucket(at(0), NOW)).toBe('Today');
    expect(bucket(at(1), NOW)).toBe('Yesterday');
    expect(bucket(at(4), NOW)).toBe('This week');
    expect(bucket(at(20), NOW)).toBe('This month');
    expect(bucket(new Date(2025, 1, 2).getTime(), NOW)).toBe('Older');
  });

  it('cuts the list into those runs, in order', () => {
    const mails = [mail({ id: 'a', at: at(0) }), mail({ id: 'b', at: at(1) }), mail({ id: 'c', at: at(2) })];
    expect(buckets(mails, NOW).map((b) => b.label)).toEqual(['Today', 'Yesterday', 'This week']);
  });

  it('snoozes to an hour rather than to a duration', () => {
    const [, tomorrow, monday] = snoozeOptions(NOW);
    expect(new Date(tomorrow.at).getHours()).toBe(8);
    expect(new Date(tomorrow.at).getDate()).toBe(11);
    // NOW is a Thursday, so the next Monday is the 14th.
    expect(new Date(monday.at).getDay()).toBe(1);
    expect(new Date(monday.at).getDate()).toBe(14);
  });
});

describe('paging', () => {
  it('counts the way the corner of a mailbox counts', () => {
    expect(pageLabel(566, 0, 50)).toBe('1–50 of 566');
    expect(pageLabel(566, 11, 50)).toBe('551–566 of 566');
    expect(pageLabel(0, 0, 50)).toBe('0');
    expect(pages(566, 50)).toBe(12);
    expect(pages(0, 50)).toBe(1);
  });
});

describe('replying', () => {
  it('says Re: once however many times it has been round', () => {
    expect(reSubject('Re: Fwd: Problem set', 'Re:')).toBe('Re: Problem set');
    expect(reSubject('', 'Fwd:')).toBe('Fwd: (no subject)');
  });

  it('quotes the original the way every client has since 1995', () => {
    expect(quoted(mail())).toContain('> The deadline has moved to Friday.');
    expect(quoted(mail())).toContain('John Stromme <john.stromme@vanderbilt.edu> wrote:');
  });

  it('replies to the sender, and reply-all to the room without you in it', () => {
    const m = mail({
      to: [
        { name: 'You', address: 'you@vanderbilt.edu' },
        { name: 'TA', address: 'ta@vanderbilt.edu' },
      ],
    });
    const one = prefill(m, 'reply', 'you@vanderbilt.edu');
    expect(one.to).toBe('john.stromme@vanderbilt.edu');
    expect(one.cc).toBe('');
    const all = prefill(m, 'replyAll', 'you@vanderbilt.edu');
    expect(all.cc).toBe('ta@vanderbilt.edu');
    expect(all.subject).toBe('Re: Problem set 2');
  });

  it('forwards to nobody, with the message under a rule', () => {
    const fwd = prefill(mail(), 'forward');
    expect(fwd.to).toBe('');
    expect(fwd.subject).toBe('Fwd: Problem set 2');
    expect(fwd.body).toContain('Forwarded message');
  });
});

describe('folding the thread away', () => {
  it('cuts at the attribution line', () => {
    const body = 'Friday works.\n\nOn Thu, Sep 10, 2026, 9:01 AM, John Stromme <j@v.edu> wrote:\n> Can you make Friday?';
    const { said, quote } = splitQuote(body);
    expect(said).toBe('Friday works.');
    expect(quote).toContain('> Can you make Friday?');
  });

  it('cuts at a run of quoted lines with no attribution', () => {
    expect(splitQuote('Yes.\n> the old message').said).toBe('Yes.');
  });

  it('leaves a forward alone rather than hiding the whole message', () => {
    const fwd = '---------- Forwarded message ----------\n> the whole thing';
    expect(splitQuote(fwd).quote).toBe('');
    expect(splitQuote(fwd).said).toContain('Forwarded message');
  });

  it('says there is no quote when there is none', () => {
    expect(splitQuote('Just this.')).toEqual({ said: 'Just this.', quote: '' });
  });
});

describe('the app’s own drafts', () => {
  const draft: MailDraft = {
    id: 'd1',
    to: 'john.stromme@vanderbilt.edu',
    cc: '',
    bcc: '',
    subject: 'Extension on problem set 2',
    body: 'Dear Professor Stromme,',
    courseId: 'econ',
    purposeId: 'extension',
    updated: at(0),
    handed: null,
  };
  const me = { name: 'You', address: 'you@vanderbilt.edu' };

  it('shows an unsent one in Drafts', () => {
    const row = draftAsMail(draft, me);
    expect(row.folder).toBe('drafts');
    expect(row.id).toBe('draft:d1');
    expect(row.to[0].address).toBe('john.stromme@vanderbilt.edu');
    expect(row.unread).toBe(false);
  });

  it('moves it to Sent on the hour it was handed over', () => {
    const row = draftAsMail({ ...draft, handed: at(1) }, me);
    expect(row.folder).toBe('sent');
    expect(row.at).toBe(at(1));
  });

  it('names an empty subject rather than leaving the row blank', () => {
    expect(draftAsMail({ ...draft, subject: '' }, me).subject).toBe('(no subject)');
  });
});
