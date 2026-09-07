import { describe, expect, it } from 'vitest';
import { PICK, build } from './context';
import { DEFAULT_PERSISTED, type State } from '../state/shape';
import { buildCatalog } from '../data/catalog';
import type { CourseUpdate } from './types';
import BUS from '../data/courses/bus';
import ECON from '../data/courses/econ';

/**
 * What leaves the device, checked by looking at what leaves the device.
 *
 * The spec asks for one full outgoing payload to be logged and read by eye.
 * That is a good instruction and a bad guarantee — it holds for the payload
 * somebody looked at, on the day they looked. So the same check is written
 * down: a state with a key, a token, a private note and another person's name
 * in it, and an assertion that none of them appear in what would be sent.
 *
 * These tests are the boundary. If one of them fails, something private is
 * being sent, and the right response is never to change the test.
 */

const NOW = new Date(2026, 8, 15);
const catalog = buildCatalog([BUS, ECON]);

/** A state with every secret this app could hold, all of it fake. */
const loaded = (over: Partial<State> = {}): State =>
  ({
    ...DEFAULT_PERSISTED,
    courses: [BUS, ECON],
    grades: { 'bus:0': '82', 'econ:0': '74' },
    notes: [
      {
        id: 'n1',
        title: 'Therapy notes',
        body: 'THE-PRIVATE-NOTE-BODY — everything I said on Tuesday.',
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

const sent = (question: string, mode: 'general' | 'grounded' | 'app' = 'grounded', over?: Partial<State>) =>
  build(question, mode, loaded(over), catalog, NOW, 'ask').text;

describe('what never leaves, under any circumstance', () => {
  /*
   * The whole payload, checked for every secret at once.
   *
   * Written as one test over many questions rather than one test per secret,
   * because the failure mode is a new field travelling with some question
   * nobody thought to check — so the questions are the ones most likely to
   * pull something in.
   */
  const SECRETS = [
    'THE-PRIVATE-NOTE-BODY',
    'PERSON-NAME-HERE',
    'SAID-ABOUT-THEM',
    'LETTER-BODY-HERE',
    'sk-ant-',
    'Bearer ',
    'refresh_token',
  ];

  const QUESTIONS = [
    'what is due this week',
    'how am I doing in BUS 1600',
    'what did I write in my notes',
    'tell me about my professor',
    'summarise my letters',
    'what do you know about me',
    'how many absences do I have left',
    'read everything you have',
  ];

  it('sends no key, no token, no note body and nobody else’s name', () => {
    for (const q of QUESTIONS) {
      const payload = sent(q);
      for (const secret of SECRETS) {
        expect(payload, `"${q}" leaked ${secret}`).not.toContain(secret);
      }
    }
  });

  it('sends nothing from people or letters even when the question asks for it', () => {
    // The one category where an accident is not the student's own business to
    // forgive: these are other people's names and what was said about them.
    const payload = sent('what did I say about PERSON-NAME-HERE after office hours');
    expect(payload).not.toContain('PERSON-NAME-HERE');
    expect(payload).not.toContain('SAID-ABOUT-THEM');
  });

  it('names in the allowlist the things it refuses to send', () => {
    // The list is the readable half of the boundary; the code is the other.
    const never = PICK.never.join(' ').toLowerCase();
    expect(never).toContain('api keys');
    expect(never).toContain('token');
    expect(never).toContain('note bodies');
    expect(never).toContain('people');
  });
});

describe('a general question', () => {
  it('carries the date and the course list, and no coursework at all', () => {
    /*
     * "Explain price elasticity" needs no deadlines, no grades and no
     * attendance. Sending them anyway is a cost and a leak nobody asked for.
     */
    const payload = sent('explain price elasticity', 'general');
    expect(payload).toContain('Today is');
    expect(payload).toContain('BUS 1600');
    expect(payload).not.toContain('Due in the next');
    expect(payload).not.toContain('grades');
    expect(payload).not.toContain('attendance');
  });

  it('is short, which is the point of the mode existing', () => {
    expect(sent('explain price elasticity', 'general').length).toBeLessThan(600);
  });
});

describe('a grounded question', () => {
  it('brings the deadlines in the window the question names', () => {
    const week = sent('what is due this week');
    const term = sent('what is left this term');
    expect(week).toContain('Due in the next 8 days');
    expect(term).toContain('Due in the next 200 days');
    // A longer window is more, or the window means nothing.
    expect(term.length).toBeGreaterThan(week.length);
  });

  it('brings one course when the question names one', () => {
    // "How am I doing in BUS 1600" is not a question about ECON.
    const payload = sent('how am I doing in BUS 1600');
    expect(payload).toContain('BUS 1600 grades');
    expect(payload).not.toContain('ECON 1020 grades');
  });

  it('recognises the half of a code people actually say', () => {
    expect(sent('how am I doing in econ')).toContain('ECON 1020 grades');
  });

  it('brings every course when the question names none', () => {
    const payload = sent('how am I doing');
    expect(payload).toContain('BUS 1600 grades');
    expect(payload).toContain('ECON 1020 grades');
  });

  it('leaves out a grade table with nothing in it', () => {
    // An empty table teaches the answer nothing and still costs a paragraph.
    expect(sent('how am I doing', 'grounded', { grades: {} })).not.toContain('grades —');
  });

  it('brings unit names for a study question and not for others', () => {
    // A guide is thousands of words and the question is rarely about all of it.
    expect(sent('which units should I revise in BUS 1600')).toContain('BUS 1600 units');
    expect(sent('what is due in BUS 1600 this week')).not.toContain('BUS 1600 units');
  });

  it('sends cards only when the question names one course and is about its material', () => {
    /*
     * The three conditions together, because any one alone is the wrong rule.
     *
     * This test asserted that cards never travel, which is what the allowlist
     * said and not what the screen did — `ask` exists to answer from the
     * guide, and the whole of the open one used to be appended after
     * everything this file had carefully chosen. Bounded and named is the
     * resolution; silently unbounded was the bug.
     */
    expect(sent('what should I know for BUS 1600')).toContain('BUS 1600 material');
    // Names no course: unit names at most, from all of them.
    expect(sent('what should I revise')).not.toContain('material:');
    // Names a course, not about its material.
    expect(sent('what is due in BUS 1600 this week')).not.toContain('BUS 1600 material');
  });

  it('caps how much of a guide can travel', () => {
    // A whole guide is not context — it is the thing the question is a
    // shortcut past, and an 11,000-character payload for one question is how
    // that goes wrong.
    // The property that actually matters is the size of the thing sent, not
    // the number of any one kind of line in it.
    for (const q of [
      'what should I know for BUS 1600',
      'explain everything in ECON 1020',
      'what is left this term across all my courses',
    ]) {
      expect(sent(q).length, q).toBeLessThan(8000);
    }
  });
});

describe('when the screen has already said it', () => {
  it('does not send a course’s grades twice by two different routes', () => {
    /*
     * Found by reading a whole payload by eye. Asking "what do I need on the
     * BUS final" from Grades sent BUS 1600's six components twice — once from
     * the screen's provider and once from here.
     *
     * The wasted characters are the small half. The large half is that the
     * two are computed differently: the provider passes the attendance extras
     * the Grades screen passes, this file does not, and on a course whose
     * syllabus weights attendance they give different running grades for one
     * course with no way to choose between them.
     */
    const screenSaid = 'On screen: Grades (grades).\nBUS 1600 running 82%, 45% still to play for.';
    const withScreen = build('how am I doing in BUS 1600', 'grounded', loaded(), catalog, NOW, 'grades', screenSaid);
    const without = build('how am I doing in BUS 1600', 'grounded', loaded(), catalog, NOW, 'grades');
    expect(without.text).toContain('BUS 1600 grades');
    expect(withScreen.text).not.toContain('BUS 1600 grades —');
    // And the screen's own account is still there.
    expect(withScreen.text).toContain('BUS 1600 running 82%');
  });

  it('still sends a course the screen did not mention', () => {
    const screenSaid = 'On screen: Grades (grades).\nBUS 1600 running 82%.';
    const out = build('how am I doing', 'grounded', loaded(), catalog, NOW, 'grades', screenSaid);
    expect(out.text).toContain('ECON 1020 grades');
    expect(out.text).not.toContain('BUS 1600 grades —');
  });
});

describe('what it says it used', () => {
  it('lists it, so an answer’s basis is checkable rather than asserted', () => {
    const out = build('how am I doing in BUS 1600', 'grounded', loaded(), catalog, NOW, 'ask');
    expect(out.used).toContain('your course codes and titles');
    expect(out.used.join(' ')).toContain('BUS 1600 grades');
  });

  it('lists less for a general question, because less went', () => {
    const general = build('explain elasticity', 'general', loaded(), catalog, NOW, 'ask');
    const grounded = build('how am I doing', 'grounded', loaded(), catalog, NOW, 'ask');
    expect(general.used.length).toBeLessThan(grounded.used.length);
  });
});

describe('the guide that leaves is the guide as it stands', () => {
  const reading: CourseUpdate = {
    id: 'u1',
    courseId: 'econ',
    unit: null,
    title: 'Redlining and the HOLC',
    source: 'Reading 7',
    body: '',
    created: 1,
    cards: [{ q: 'What did the HOLC grade?', a: 'It graded 239 cities between 1930 and 1960.' }],
    terms: [],
    fileIds: [],
  };

  const sent = (state: State) =>
    build('what should I study for ECON 1020', 'grounded', state, catalog, NOW, 'study').text;

  it('carries a unit that arrived with a reading', () => {
    // This file reads the guide to decide what may leave, and it read the
    // module content — so the answer came back built on everything except the
    // reading added last week, with nothing on screen saying so.
    const without = sent(loaded({ guideId: 'econ' }));
    expect(without).not.toContain('Redlining and the HOLC');

    const with_ = sent(loaded({ guideId: 'econ', updates: [reading] }));
    expect(with_).toContain('Redlining and the HOLC');
  });

  it('still sends nothing when nothing was added', () => {
    expect(sent(loaded({ guideId: 'econ', updates: [] }))).toBe(sent(loaded({ guideId: 'econ' })));
  });
});
