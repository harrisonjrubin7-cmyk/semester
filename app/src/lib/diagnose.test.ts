import { describe, expect, it } from 'vitest';
import { KEEP, add, dump, dumpName, entry, frames, read, scrub, type About, type Entry } from './diagnose';

const AT = 1_788_000_000_000;

const about = (over: Partial<About> = {}): About => ({
  build: 'abc1234',
  screen: 'guide',
  language: 'en-GB',
  agent: 'Mozilla/5.0 (iPhone)',
  cloud: true,
  signedIn: false,
  storageUsed: 184_320,
  schema: '2',
  ...over,
});

describe('what the dump must never contain', () => {
  it('cuts an email address out of a message', () => {
    // The file has to be safe to send without reading, so nothing goes in that
    // somebody would have to check.
    expect(scrub('failed for harrison@vanderbilt.edu')).toContain('(an email address)');
    expect(scrub('failed for harrison@vanderbilt.edu')).not.toContain('vanderbilt.edu');
  });

  it('cuts a key or a token', () => {
    expect(scrub('key sk-ant-api03-abcdefghijkl failed')).toContain('(a key)');
    expect(scrub('bearer eyJhbGciOiJIUzI1NiJ9x failed')).toContain('(a token)');
  });

  it('cuts a long quoted run, which is where somebody’s own writing hides', () => {
    // A JSON parse error carries the text it failed on — a note's title, a
    // course code, a whole paragraph.
    const said = scrub('Unexpected token in "The thing I actually wrote in my note about Kant"');
    expect(said).not.toContain('Kant');
    expect(said).toContain('"…"');
  });

  it('leaves an ordinary message alone', () => {
    expect(scrub('Cannot read properties of undefined')).toBe('Cannot read properties of undefined');
  });

  it('caps how long one message can be', () => {
    expect(scrub('x'.repeat(2000)).length).toBeLessThanOrEqual(300);
  });

  it('says in the file itself what is not in it', () => {
    const text = dump(about(), []);
    expect(text).toContain('does not hold');
    expect(text).toContain('your notes');
  });
});

describe('the log', () => {
  const e = (n: number): Entry => entry('error', `problem ${n}`, 'home', undefined, AT + n);

  it('keeps the newest and drops the oldest', () => {
    let log: Entry[] = [];
    for (let i = 0; i < KEEP + 20; i += 1) log = add(log, e(i));
    expect(log).toHaveLength(KEEP);
    expect(log[log.length - 1].message).toBe(`problem ${KEEP + 19}`);
    expect(log[0].message).toBe(`problem ${20}`);
  });

  it('records where they were, which is the most useful field', () => {
    expect(entry('error', 'x', 'runway').screen).toBe('runway');
  });

  it('keeps only the first few stack frames', () => {
    const stack = ['Error: x', ' at a (f.ts:1)', ' at b (f.ts:2)', ' at c (f.ts:3)', ' at d (f.ts:4)', ' at e (f.ts:5)'].join('\n');
    const got = frames(stack);
    expect(got).toContain('at a');
    expect(got).not.toContain('at e');
  });

  it('has no stack line at all when there was no stack', () => {
    expect('where' in entry('note', 'x', 'home')).toBe(false);
  });
});

describe('reading it back', () => {
  it('takes what it wrote', () => {
    const log = [entry('error', 'x', 'home', undefined, AT)];
    expect(read(JSON.stringify(log))).toEqual(log);
  });

  it('takes rubbish as nothing rather than throwing', () => {
    expect(read(null)).toEqual([]);
    expect(read('not json')).toEqual([]);
    expect(read('{"a":1}')).toEqual([]);
    expect(read('[{"nope":true}]')).toEqual([]);
  });
});

describe('the file somebody sends', () => {
  it('is readable text rather than JSON', () => {
    // Somebody deciding whether to send this should be able to see what is in
    // it, and JSON is not something most people read.
    const text = dump(about(), [entry('error', 'It broke', 'guide', undefined, AT)], AT);
    expect(text).toContain('Semester — diagnostics');
    expect(text).toContain('It broke');
    expect(text.trim().startsWith('{')).toBe(false);
  });

  it('says which build and which screen', () => {
    const text = dump(about({ build: 'deadbeef', screen: 'runway' }), [], AT);
    expect(text).toContain('deadbeef');
    expect(text).toContain('runway');
  });

  it('says whether an account exists without saying which', () => {
    expect(dump(about({ cloud: true, signedIn: true }), [], AT)).toContain('signed in');
    expect(dump(about({ cloud: false }), [], AT)).toContain('not configured');
    // Never the address.
    expect(dump(about({ signedIn: true }), [], AT)).not.toContain('@');
  });

  it('says plainly when nothing has gone wrong', () => {
    expect(dump(about(), [], AT)).toContain('Nothing has gone wrong');
  });

  it('is named so two in one day do not collide', () => {
    expect(dumpName(Date.parse('2026-09-06T09:05:00'))).toBe(
      'semester-diagnostics-2026-09-06-0905.txt',
    );
    expect(dumpName(Date.parse('2026-09-06T09:05:00'))).not.toBe(
      dumpName(Date.parse('2026-09-06T14:32:00')),
    );
  });
});
