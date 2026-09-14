import { describe, expect, it } from 'vitest';
import { caught, describeRule, doesSomething, ruleMarks, under, type Rule } from './mailrules';
import { marked, type Mail, type Marks } from './mailbox';

const mail = (id: string, over: Partial<Mail> = {}): Mail => ({
  id,
  source: 'google',
  threadId: id,
  from: { name: 'Dana Shaw', address: 'dana@vanderbilt.edu' },
  to: [],
  cc: [],
  subject: 'Problem set 3',
  snippet: '',
  body: '',
  at: 0,
  unread: true,
  starred: false,
  folder: 'inbox',
  labels: [],
  attachments: 0,
  link: '',
  courseId: null,
  ...over,
});

const rule = (over: Partial<Rule> = {}): Rule => ({
  id: 'r1',
  name: '',
  when: 'from:dana',
  created: 0,
  ...over,
});

describe('what a rule catches', () => {
  it('finds what the search box would have found', () => {
    // The point of the design: no second condition language, so a rule and a
    // search cannot come to different conclusions about the same words.
    const mails = [mail('a'), mail('b', { from: { name: 'Bursar', address: 'bursar@vanderbilt.edu' } })];
    expect(caught(mails, rule({ when: 'from:dana' }))).toEqual(['a']);
    expect(caught(mails, rule({ when: 'from:bursar' }))).toEqual(['b']);
  });

  it('understands the operators the box does, negation included', () => {
    const mails = [mail('unread'), mail('read', { unread: false })];
    expect(caught(mails, rule({ when: '-is:unread' }))).toEqual(['read']);
  });

  it('catches nothing on an empty search rather than everything', () => {
    // An empty search matches every message, and a rule is a thing with
    // actions on it — "archive everything" is not a default worth having one
    // typo away.
    expect(caught([mail('a')], rule({ when: '' }))).toEqual([]);
    expect(caught([mail('a')], rule({ when: '   ' }))).toEqual([]);
  });
});

describe('what a rule does', () => {
  it('lays its actions on what it caught', () => {
    const marks = ruleMarks([mail('a')], [rule({ star: true, read: true, folder: 'archive' })]);
    expect(marks.a).toEqual({ star: true, read: true, folder: 'archive' });
  });

  it('does nothing at all when it has no actions', () => {
    expect(doesSomething(rule())).toBe(false);
    expect(ruleMarks([mail('a')], [rule()])).toEqual({});
  });

  it('stops when it is turned off, without being deleted', () => {
    expect(ruleMarks([mail('a')], [rule({ star: true, off: true })])).toEqual({});
  });

  it('lets a later rule win a field and both rules keep their label', () => {
    // Two rules disagreeing about a folder is the later one refining the
    // earlier. Two rules labelling one message is two true things about it.
    const marks = ruleMarks(
      [mail('a')],
      [
        rule({ id: 'r1', folder: 'archive', label: 'Reading' }),
        rule({ id: 'r2', folder: 'trash', label: 'ECON' }),
      ],
    );
    expect(marks.a.folder).toBe('trash');
    expect(marks.a.labels?.sort()).toEqual(['ECON', 'Reading']);
  });
});

describe('a rule cannot fight you', () => {
  const mails = [mail('a')];
  const starring = [rule({ star: true })];

  it('stars what you have no opinion about', () => {
    const marks = under(ruleMarks(mails, starring), {});
    expect(marked(mails[0], marks).starred).toBe(true);
  });

  it('loses to an explicit unstar, which is what unstarring writes', () => {
    /*
     * The failure this layering exists to prevent: rules re-run on every
     * read, so without it, unstarring a message a rule stars would be undone
     * before the frame was drawn. `onStar` in `screens/Mail.tsx` dispatches
     * `{ star: !starred }`, so the `false` is really there to be honoured.
     */
    const yours: Marks = { a: { star: false } };
    const marks = under(ruleMarks(mails, starring), yours);
    expect(marked(mails[0], marks).starred).toBe(false);
  });

  it('keeps the fields you have said nothing about', () => {
    // Your mark wins `star` and does not take `folder` down with it.
    const marks = under(ruleMarks(mails, [rule({ star: true, folder: 'archive' })]), {
      a: { star: false },
    });
    expect(marks.a).toMatchObject({ star: false, folder: 'archive' });
  });

  it('keeps a message you moved where you moved it', () => {
    const marks = under(ruleMarks(mails, [rule({ folder: 'archive' })]), { a: { folder: 'inbox' } });
    expect(marked(mails[0], marks).folder).toBe('inbox');
  });

  it('unions a label you added with one a rule added', () => {
    const marks = under(ruleMarks(mails, [rule({ label: 'Reading' })]), { a: { labels: ['Mine'] } });
    expect(marks.a.labels?.sort()).toEqual(['Mine', 'Reading']);
  });

  it('leaves a message no rule touched exactly as you left it', () => {
    const yours: Marks = { b: { star: true } };
    expect(under(ruleMarks(mails, starring), yours).b).toEqual({ star: true });
  });

  it('stops doing anything the moment it is switched off', () => {
    // Nothing was ever written down as yours, so turning it off is the whole
    // undo — there is no residue to clean up.
    const off = under(ruleMarks(mails, [rule({ star: true, off: true })]), {});
    expect(marked(mails[0], off).starred).toBe(false);
  });
});

describe('describeRule', () => {
  it('reads as a sentence with one action', () => {
    expect(describeRule(rule({ when: 'from:dana', star: true }))).toBe(
      'Mail matching from:dana will be starred.',
    );
  });

  it('joins several with a comma and an and', () => {
    expect(describeRule(rule({ when: 'list:news', folder: 'archive', read: true, label: 'News' }))).toBe(
      'Mail matching list:news will skip the inbox, be marked read and be labelled News.',
    );
  });

  it('says so when a rule would do nothing', () => {
    expect(describeRule(rule({ when: 'from:dana' }))).toContain('doing nothing');
  });
});
