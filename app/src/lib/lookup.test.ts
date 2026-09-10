import { describe, expect, it } from 'vitest';
import {
  isLookup,
  LOOKUPS,
  MOST_LOOKUPS,
  runLookup,
  runLookups,
  type Source,
} from './lookup';
import { TOOLS } from './tools';
import type { ToolCall } from './claude';
import { DEFAULT_PERSISTED, type State } from '../state/shape';
import { buildCatalog } from '../data/catalog';
import BUS from '../data/courses/bus';
import ECON from '../data/courses/econ';
import type { CourseId } from './types';

/**
 * What the assistant may read for itself, and what it may never reach.
 *
 * Two things are load-bearing here and each has a test that fails loudly if it
 * stops holding. The first is that these read and only read: `lib/tools.ts`
 * proposes and waits for a tap, this returns straight to the model, and the
 * whole reason that is safe is that nothing here changes anything. The second
 * is the boundary — a lookup runs on the model's say-so rather than on a
 * keyword match, so "it only fires when the question names it" is no longer
 * the thing protecting a note body. What protects it is that no lookup can
 * reach one at all, and that is asserted below against a state with every
 * private thing this app can hold in it.
 */

const NOW = new Date(2026, 8, 15);
const catalog = buildCatalog([BUS, ECON]);

const loaded = (over: Partial<State> = {}): State =>
  ({
    ...DEFAULT_PERSISTED,
    courses: [BUS, ECON],
    grades: { 'bus:0': '82', 'econ:0': '74' },
    tasks: [
      {
        id: 't1',
        title: 'Buy a lab notebook',
        date: '2026-09-16',
        time: '',
        note: 'THE-PRIVATE-TASK-NOTE',
        done: false,
        created: 0,
        courseId: null,
      },
    ],
    appointments: [
      {
        id: 'a1',
        title: 'Advising meeting with Dr Trounstine',
        /*
         * Inside the window the privacy loop below can see.
         *
         * `read_timetable` clamps its span to seven days from the date it is
         * given, and every probe there asks about 2026-09-15 — so a fixture
         * item dated outside 15–21 September is invisible to the one test
         * that checks every lookup for every secret. It was on the 13th, and
         * a mutation that appended the appointment's note to the timetable
         * line passed the whole suite. A Sunday, so there are no classes to
         * make "not empty" true for the wrong reason.
         */
        date: '2026-09-20',
        at: 600,
        time: '10:00a',
        where: 'Kirkland Hall 210',
        note: 'THE-PRIVATE-APPT-NOTE',
        created: 0,
      },
    ],
    feeds: [
      { id: 'f1', kind: 'ics', name: 'Their calendar', url: '', added: 0, synced: 0, status: '', count: 1 },
    ] as unknown as State['feeds'],
    feedEvents: [
      {
        id: 'fe1',
        sourceId: 'f1',
        /*
         * A connected calendar is somebody else's writing — an employer's
         * rota, a clinic's confirmation — so every text field on it is a
         * secret here, not only the note. The same Sunday as the appointment
         * above, for the same reason: inside the seven days the timetable
         * clamps to, and with no classes to make the day non-empty for the
         * wrong reason.
         */
        title: 'FEED-EVENT-TITLE',
        date: '2026-09-20',
        at: 840,
        time: '2:00p',
        where: 'FEED-EVENT-PLACE',
        note: 'FEED-EVENT-NOTE',
        courseId: null,
      },
    ] as unknown as State['feedEvents'],
    notes: [
      {
        id: 'n1',
        title: 'Therapy notes',
        body: 'THE-PRIVATE-NOTE-BODY',
        created: 0,
        updated: 0,
        courseId: null,
        fileIds: [],
      },
    ],
    people: [
      { id: 'p1', name: 'PERSON-NAME-HERE', role: 'Professor', courseId: 'bus', note: 'SAID-ABOUT-THEM' },
    ] as unknown as State['people'],
    letters: [{ id: 'l1', body: 'LETTER-BODY-HERE' }] as unknown as State['letters'],
    ...over,
  }) as State;

const src = (over?: Partial<State>): Source => ({
  state: loaded(over),
  catalog,
  now: NOW,
});

const call = (name: string, input: Record<string, unknown> = {}): ToolCall => ({
  id: 'toolu_1',
  name,
  input,
});

const ran = (name: string, input: Record<string, unknown> = {}, over?: Partial<State>) =>
  runLookup(call(name, input), src(over));

describe('what a lookup can never reach', () => {
  /*
   * Every lookup, asked for every secret, in one test.
   *
   * Written this way round because the failure to catch is a lookup added
   * next year that happens to serialise something private — so the loop is
   * over the tool list rather than over a set of cases somebody remembered.
   */
  const SECRETS = [
    'THE-PRIVATE-NOTE-BODY',
    'THE-PRIVATE-TASK-NOTE',
    'THE-PRIVATE-APPT-NOTE',
    'FEED-EVENT-TITLE',
    'FEED-EVENT-PLACE',
    'FEED-EVENT-NOTE',
    'PERSON-NAME-HERE',
    'SAID-ABOUT-THEM',
    'LETTER-BODY-HERE',
  ];

  it('returns nothing private, whatever it is asked for', () => {
    /*
     * `days: 400` does not mean four hundred days everywhere: the timetable
     * clamps its span to seven. So a secret this loop is meant to catch has
     * to be dated within a week of the date below, or the lookup never reads
     * the row it is on and the probe proves nothing.
     */
    const asked = [
      { course: 'ECON 1020', days: 400, query: 'therapy', date: '2026-09-15', hours: 4 },
      { course: '', days: 400, query: 'PERSON-NAME-HERE', date: '2026-09-15' },
      { course: 'BUS 1600', days: 400, query: 'notes', date: '2026-09-15' },
    ];
    for (const tool of LOOKUPS) {
      for (const input of asked) {
        const { result } = ran(tool.name, input);
        /*
         * The model's own words back, discounted.
         *
         * One probe asks each lookup *for* a secret by name, which is the case
         * worth testing — and a lookup that says "nothing matches
         * PERSON-NAME-HERE" is quoting the question, not reading the people
         * list. Stripping the query first is what makes the assertion about
         * what came out of state rather than what went in.
         */
        const out = Object.values(input)
          .filter((v): v is string => typeof v === 'string' && v.length > 0)
          .reduce((text, said) => text.split(said).join(''), result.text);
        for (const secret of SECRETS) {
          expect(out, `${tool.name} leaked ${secret}`).not.toContain(secret);
        }
      }
    }
  });

  it('gives a task’s title and date and not the note under it', () => {
    const { result } = ran('read_tasks', { days: 30 });
    expect(result.text).toContain('Buy a lab notebook');
    expect(result.text).not.toContain('THE-PRIVATE-TASK-NOTE');
  });
});

describe('reads, and only reads', () => {
  it('leaves the state exactly as it found it', () => {
    const source = src();
    const before = JSON.stringify(source.state);
    for (const tool of LOOKUPS) {
      runLookup(call(tool.name, { course: 'ECON 1020', days: 30, query: 'demand', date: '2026-09-15' }), source);
    }
    expect(JSON.stringify(source.state)).toBe(before);
  });

  it('shares no name with a tool that changes something', () => {
    // The two sets are told apart by name alone — `isLookup` is the only
    // thing standing between "run it now" and "ask the student first".
    for (const t of TOOLS) expect(isLookup(t.name)).toBe(false);
    for (const t of LOOKUPS) expect(isLookup(t.name)).toBe(true);
  });
});

describe('finding deadlines', () => {
  it('returns real ids, so a proposal can be built from one', () => {
    const { result } = ran('find_deadlines', { course: '', days: 400, query: '' });
    expect(result.text).toMatch(/\[[a-z0-9:_-]+\]/i);
    expect(result.failed).toBeUndefined();
  });

  it('leaves out what has already been ticked off', () => {
    const all = ran('find_deadlines', { course: 'ECON 1020', days: 400, query: '' }).result.text;
    const first = /\[([^\]]+)\]/.exec(all)?.[1] ?? '';
    expect(first).not.toBe('');
    const after = ran(
      'find_deadlines',
      { course: 'ECON 1020', days: 400, query: '' },
      { done: { [first]: true } },
    ).result.text;
    expect(all).toContain(`[${first}]`);
    expect(after).not.toContain(`[${first}]`);
  });

  it('says nothing rather than everything when the window is empty', () => {
    const { result } = ran('find_deadlines', { course: '', days: 0, query: 'zzzznothing' });
    expect(result.text).toContain('Nothing outstanding');
  });
});

describe('naming a course', () => {
  it('takes the code as written, and the shorthand people say out loud', () => {
    for (const said of ['ECON 1020', 'econ 1020', 'econ', 'ECON1020']) {
      const { result } = ran('read_grades', { course: said });
      expect(result.text, said).toContain('ECON 1020');
      expect(result.failed, said).toBeUndefined();
    }
  });

  it('answers a name it cannot place with the real list, not a guess', () => {
    /*
     * The failure this avoids is the expensive one: a lookup that silently
     * picks the nearer of two courses returns another course's grades under
     * the name of the one that was asked for, and nothing downstream can tell.
     */
    const { result } = ran('read_grades', { course: 'CHEM 2100' });
    expect(result.text).toContain('ECON 1020');
    expect(result.text).toContain('BUS 1600');
    expect(result.text).toContain('No course here matches');
  });
});

describe('grades and attendance', () => {
  it('reads the weights rather than describing them', () => {
    const { result, used } = ran('read_grades', { course: 'BUS 1600' });
    expect(result.text).toContain('%');
    expect(used).toBe('BUS 1600 grades and weights');
  });

  it('says an empty attendance log is not evidence of a full one', () => {
    const { result } = ran('read_attendance', { course: 'BUS 1600' });
    expect(result.text).toContain('no attendance recorded');
    expect(result.text).toMatch(/not evidence/);
  });

  it('counts what has been marked, and what the policy allows', () => {
    const marked = ran('read_attendance', { course: 'BUS 1600' }, {
      attendance: [
        { id: 'bus:2026-09-01', courseId: 'bus' as CourseId, date: '2026-09-01', mark: 'absent', at: 0 },
        { id: 'bus:2026-09-03', courseId: 'bus' as CourseId, date: '2026-09-03', mark: 'present', at: 0 },
      ] as State['attendance'],
      attendPolicy: {
        bus: { allowed: 3, penaltyPer: 1, worth: 5, note: '' },
      } as State['attendPolicy'],
    }).result.text;
    expect(marked).toContain('1 absent');
    expect(marked).toContain('2 left');
  });
});

describe('searching the student’s own material', () => {
  it('finds a card by a word in it', () => {
    const card = catalog.guides.econ?.units[0]?.cards[0];
    expect(card).toBeTruthy();
    // A word out of the guide itself rather than one written here, so the
    // test goes on meaning something after the guide is next regenerated.
    const word = `${card?.q ?? ''} ${card?.a ?? ''}`
      .split(/[^a-z]+/i)
      .find((w) => w.length > 8) ?? '';
    expect(word).not.toBe('');
    const { result } = ran('search_material', { course: 'ECON 1020', query: word });
    expect(result.text).toContain("ECON 1020's own study guide");
    expect(result.text).toContain(card?.q ?? '');
  });

  it('says plainly when their material holds nothing on it', () => {
    const { result } = ran('search_material', { course: 'ECON 1020', query: 'zygomatic arch' });
    expect(result.text).toContain('Nothing in');
    // And does not stop there: a question their guide cannot answer is still
    // a question, and the model is told it may answer it.
    expect(result.text).toContain('general knowledge');
  });
});

describe('the timetable', () => {
  it('reads a day and says when nothing is on it', () => {
    // A Sunday in term. Whatever the schedule says, the answer is a sentence
    // about that day rather than a silence the model has to interpret.
    const { result } = ran('read_timetable', { date: '2026-09-13', days: 1 });
    expect(result.text).toContain('Sunday, September 13');
  });

  it('refuses a date that is not one', () => {
    const { result } = ran('read_timetable', { date: 'next tuesday', days: 1 });
    expect(result.failed).toBeUndefined();
    expect(result.text).toContain('September');
  });

  /*
   * The day above is a Sunday with no classes and no tasks, and the fixture
   * puts one appointment on it — so the two assertions here are the before
   * and after of the same call. This read classes and tasks only, and
   * answered "nothing scheduled" about a day holding something the student
   * had put there themselves. Measured against a day with genuinely nothing
   * on it, the two answers were the same sentence.
   */
  it('does not call a day empty when an appointment is on it', () => {
    const { result } = ran('read_timetable', { date: '2026-09-20', days: 1 });
    expect(result.text).not.toContain('nothing scheduled');
    expect(result.text).toContain('Advising meeting with Dr Trounstine');
  });

  it('says when it is and where, which is what the question is usually for', () => {
    const { result } = ran('read_timetable', { date: '2026-09-20', days: 1 });
    expect(result.text).toContain('10:00a');
    expect(result.text).toContain('Kirkland Hall 210');
  });

  it('still says nothing scheduled about a day with nothing on it', () => {
    // The control. Without it the first assertion above passes for a lookup
    // that has simply stopped saying the sentence at all.
    const { result } = ran('read_timetable', { date: '2026-09-27', days: 1 });
    expect(result.text).toContain('nothing scheduled');
  });
});

describe('answering every call, whatever happens', () => {
  /*
   * The wire requirement, and the reason it is a test rather than a comment.
   *
   * An assistant turn carrying a `tool_use` is only valid when the message
   * after it answers every one of them. A lookup that throws, or one whose
   * name is not ours, still has to come back with something — otherwise the
   * next request is refused with a 400 that says nothing about which call was
   * missing.
   */
  it('returns a result for every call, including ones it does not know', () => {
    const calls = [call('read_grades', { course: 'ECON 1020' }), call('not_a_lookup', {})];
    const { results } = runLookups(calls, src());
    expect(results).toHaveLength(2);
    expect(results[1].failed).toBe(true);
  });

  it('answers the ones past the ceiling too, rather than dropping them', () => {
    const many = Array.from({ length: MOST_LOOKUPS + 3 }, (_, i) => ({
      ...call('read_tasks', { days: 7 }),
      id: `toolu_${i}`,
    }));
    const { results } = runLookups(many, src());
    expect(results).toHaveLength(many.length);
    expect(results.at(-1)?.failed).toBe(true);
    expect(new Set(results.map((r) => r.id)).size).toBe(many.length);
  });

  it('names what it read, in the student’s words, for the row that shows it', () => {
    const { used, saying } = runLookups([call('read_grades', { course: 'ECON 1020' })], src());
    expect(used).toEqual(['ECON 1020 grades and weights']);
    expect(saying[0]).toContain('Reading your grades');
  });
});

describe('the tool definitions themselves', () => {
  it('requires every argument, because a partial call is a guess', () => {
    for (const t of LOOKUPS) {
      const props = Object.keys(t.input_schema.properties);
      expect(t.input_schema.required, t.name).toEqual(props);
      expect(t.strict, t.name).toBe(true);
    }
  });
});

describe('a day the connected calendar has something on', () => {
  /*
   * The day read back "nothing scheduled" — word for word the sentence for a
   * day with genuinely nothing on it. Measured before the fix: a Saturday
   * holding a seminar at two and a shift at five, and read_timetable,
   * read_tasks and find_deadlines all called it empty. Asked whether they are
   * free at two — the example this tool's own description gives — the model
   * would have said yes.
   */
  const withFeed = (): Partial<State> =>
    ({
      /*
       * Nothing else on the day, deliberately. The shared fixture above puts
       * an appointment on this Sunday, and left in place it makes the day
       * non-empty on its own — so a probe asking whether the feed event
       * rescues the day would pass without the feed event doing anything.
       * Measured: with the appointment left in, removing the feed from the
       * empty test broke no test at all.
       */
      tasks: [],
      appointments: [],
      feeds: [{ id: 'f2', kind: 'ics', name: 'Vanderbilt', url: '', added: 0, synced: 0, status: '', count: 2 }],
      feedEvents: [
        { id: 'x1', sourceId: 'f2', title: 'SEMINAR-TITLE', date: '2026-09-20', at: 840, time: '2:00p', where: 'SEMINAR-PLACE', note: 'SEMINAR-NOTE', courseId: null },
      ],
    }) as unknown as Partial<State>;

  it('does not call the day empty', () => {
    const out = ran('read_timetable', { date: '2026-09-20', days: 1 }, withFeed());
    expect(JSON.stringify(out.result)).not.toContain('nothing scheduled');
  });

  it('says when it is, so "are you free at two" can be answered', () => {
    const out = ran('read_timetable', { date: '2026-09-20', days: 1 }, withFeed());
    expect(JSON.stringify(out.result)).toContain('2:00p');
  });

  it('says it is a connected calendar, not one of their own entries', () => {
    // The wording has to be unmistakable, because the model will repeat it and
    // the student needs to know where to look.
    const out = ran('read_timetable', { date: '2026-09-20', days: 1 }, withFeed());
    expect(JSON.stringify(out.result)).toContain('calendar they connected');
  });

  it('reads no title, no place and no note from it', () => {
    /*
     * The line this change stops at. An appointment is what the student typed
     * into this app and `PICK.always` already sends it; a connected calendar
     * is somebody else's writing, and none of it reaches the model from any
     * provider or lookup today. Widening that is the owner's decision, not
     * something to do while fixing a false sentence.
     */
    const out = JSON.stringify(ran('read_timetable', { date: '2026-09-20', days: 1 }, withFeed()).result);
    for (const secret of ['SEMINAR-TITLE', 'SEMINAR-PLACE', 'SEMINAR-NOTE']) {
      expect(out, secret).not.toContain(secret);
    }
  });

  it('still calls a day with nothing on it nothing', () => {
    // 2026-09-27 is a Sunday with no classes, and the fixture puts no feed
    // event on it.
    const out = ran('read_timetable', { date: '2026-09-27', days: 1 }, withFeed());
    expect(JSON.stringify(out.result)).toContain('nothing scheduled');
  });
});
