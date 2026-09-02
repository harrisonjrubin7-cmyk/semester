import type { CourseModule } from '../../../lib/types';
import { CORE_GUIDE } from './guide';

/**
 * CORE 2500 · Sports, Culture, and Society · Fall 2026
 *
 * Built from Sports_Fall26_Syllabus.pdf and the published "Sport, Culture &
 * Society Field Guide" artifact.
 */
const core: CourseModule = {
  course: {
    id: 'core',
    code: 'CORE 2500',
    name: 'Sports, Culture, and Society',
    prof: 'Prof. Gabriel Torres Colón',
    email: 'g.torres@vanderbilt.edu',
    meets: 'T/R · 1:15–2:30p',
    room: 'Garland',
    credits: '3 credits',
    source: 'Sports_Fall26_Syllabus.pdf',
    grading: [
      { what: 'Eight quizzes, 10 pts each', pct: '80 pts' },
      { what: 'Thirteen reflections, 10 pts', pct: '130 pts' },
      { what: 'Final reflection', pct: '20 pts' },
      { what: 'Attendance — 2 free absences', pct: '—' },
    ],
  },

  schedule: [
    {
      days: [2, 4],
      at: 13 * 60 + 15,
      time: '1:15p',
      title: 'CORE 2500',
      meta: 'Garland · Prof. Torres Colón',
    },
  ],

  exceptions: [
    {
      month: 8,
      day: 3,
      meta: 'Garland · From Child Play to Sport',
      note: 'From Child Play to Sport — What Do We Lose, What Do We Gain?',
    },
  ],

  items: [
    {
      id: 'core-read1',
      c: 'core',
      title: 'Read Konner — “Play, Social Learning, and Teaching”',
      kind: 'Reading',
      month: 8,
      day: 3,
      dueTime: 'Before class, 1:15p',
      weight: 'Required',
      where: 'Brightspace',
      detail:
        'Comes with the lecture: From Child Play to Sport — What Do We Lose, What Do We Gain?',
      quote: 'All assignments are due before class begins.',
      source: 'Sports_Fall26_Syllabus.pdf · Week 2',
    },
    {
      id: 'core-r1',
      c: 'core',
      title: 'Reflection #1 — Should play be more serious?',
      kind: 'Reflection',
      month: 8,
      day: 3,
      dueTime: 'Before class, 1:15p',
      weight: '10 pts',
      where: 'Brightspace',
      detail:
        'Self-assessed against the posted rubric. No AI in any capacity. Late without an excuse drops a letter grade per day.',
      quote: 'You are not allowed to use AI in any capacity for your reflections.',
      source: 'Sports_Fall26_Syllabus.pdf · Coursework',
    },
    {
      id: 'core-q1',
      c: 'core',
      title: 'Quiz #1 + Ocobock & Lacy, “Woman the Hunter”',
      kind: 'Quiz',
      month: 8,
      day: 8,
      dueTime: 'Before class, 1:15p',
      weight: '10 pts',
      where: 'Brightspace',
      detail:
        'Objective questions on the reading and the previous lecture’s slides. Missed quizzes score 0, but extra credit can make the points back.',
      quote: 'Quizzes not completed by the due date before class will receive a 0.',
      source: 'Sports_Fall26_Syllabus.pdf · Week 3',
    },
    {
      id: 'core-q2',
      c: 'core',
      title: 'Quiz #2 + Epstein, The Sports Gene, Ch. 9–11',
      kind: 'Quiz',
      month: 8,
      day: 15,
      dueTime: 'Before class, 1:15p',
      weight: '10 pts',
      where: 'Brightspace',
      detail: 'Week 4 — the (un)science of race. Also Fox, Ch. 2 and 4.',
      quote: 'Quizzes not completed by the due date before class will receive a 0.',
      source: 'Sports_Fall26_Syllabus.pdf · Week 4',
    },
    {
      id: 'core-r2',
      c: 'core',
      title: 'Reflection #2 — Are elite athletes super-humans?',
      kind: 'Reflection',
      month: 8,
      day: 17,
      dueTime: 'Before class, 1:15p',
      weight: '10 pts',
      where: 'Brightspace',
      detail:
        'The hardware and software paradigm applied to somebody you have actually watched.',
      quote: 'You are not allowed to use AI in any capacity for your reflections.',
      source: 'Sports_Fall26_Syllabus.pdf · Coursework',
    },
    {
      id: 'core-final',
      c: 'core',
      title: 'Final reflection — Ultrarealism and Human Flourishment',
      kind: 'Reflection',
      month: 11,
      day: 10,
      dueTime: 'Before class',
      weight: '20 pts',
      where: 'Brightspace',
      detail: 'The one reflection worth double. Self-assessed like the rest.',
      quote: '“Ultrarealism and Human Flourishment”',
      source: 'Sports_Fall26_Syllabus.pdf · Coursework',
    },
  ],

  guide: CORE_GUIDE,

  figures: {
    2: {
      type: 'bars',
      title: 'Encephalization quotient — more brain, more play',
      caption:
        'Fox’s throughline: play tracks brain size across species. Dolphins sit between the great apes and us, which is why Kuczaj’s rough-toothed dolphins are the example most likely to be quizzed.',
      unit: 'EQ',
      max: 7.5,
      rows: [
        { l: 'Humans', v: 7.0 },
        { l: 'Dolphins', v: 4.5 },
        { l: 'Great apes', v: 2.3 },
      ],
    },
    3: {
      type: 'bars',
      title: 'Muscle fibre composition, vastus lateralis',
      caption:
        'Female vs. male, percent. Adapted from Ocobock & Lacy plus Haizlip et al. Every one of these is an average with heavy overlap — not a rule about individuals.',
      unit: '%',
      max: 50,
      rows: [
        { l: 'Type I — female', v: 41 },
        { l: 'Type I — male', v: 36 },
        { l: 'Type IIa — female', v: 34 },
        { l: 'Type IIa — male', v: 46 },
        { l: 'Type IIx — female', v: 23 },
        { l: 'Type IIx — male', v: 20 },
      ],
    },
    4: {
      type: 'bars',
      title: 'Hours of practice to reach chess master',
      caption:
        'Campitelli & Gobet, 104 players. The range is the finding — several logged 25,000+ hours and never made master. Epstein: “the 7,000-to-40,000-hours rule just doesn’t have the same ring to it.”',
      unit: 'hrs',
      max: 25000,
      rows: [
        { l: 'Fastest', v: 3000 },
        { l: '“The 10,000”', v: 10000 },
        { l: 'Average', v: 11053 },
        { l: 'Slowest', v: 23000 },
      ],
    },
    5: {
      type: 'bars',
      title: 'ACTN3 — who carries the XX genotype',
      caption:
        'The “sprint gene” mostly tells you who will not run an Olympic final. Of 32 Australian sprinters who reached the Olympics, zero were XX. Foster: “the best genetic test right now is a stopwatch.”',
      unit: '% XX',
      max: 28,
      rows: [
        { l: 'East Asian populations', v: 25 },
        { l: 'White Australians', v: 18 },
        { l: 'Zulu populations', v: 1 },
        { l: 'Australian Olympic sprinters', v: 0 },
      ],
    },
  },

  extraFigures: [
    {
      type: 'steps',
      title: 'Epstein’s hardware / software model',
      caption:
        'The chapter’s whole point. Skill is learned pattern-recognition running on physical equipment that varies between people — and both halves are real.',
      steps: [
        {
          n: 'SW',
          t: 'Software — chunks',
          d: 'Learned patterns. Pujols had none for Finch; chess masters lose their edge on random boards.',
        },
        {
          n: 'HW',
          t: 'Hardware — the body',
          d: 'Holm’s 1.8-ton Achilles vs. Thomas’s 10¼-inch one. Same event, opposite equipment.',
        },
        {
          n: '→',
          t: 'Talent transfer',
          d: 'Move good hardware into a better-suited sport: surf-lifesavers to Olympic skeleton in 14 months.',
        },
      ],
    },
    {
      type: 'bars',
      title: 'The data gap in sport science',
      caption:
        'A favourite quiz fact. Ocobock & Lacy’s point is not that women were studied badly — it is that the traits where males have the advantage are the only ones that got measured.',
      unit: '%',
      max: 70,
      rows: [
        { l: 'Female participants, sport & exercise science', v: 34 },
        { l: 'Female participants, supplement research', v: 14 },
        { l: 'Female-only performance publications', v: 3 },
        { l: 'Male-only performance publications', v: 63 },
      ],
    },
    {
      type: 'steps',
      title: 'Fox’s structure of argument',
      caption:
        'Notice the move: name the cost, then show a measured benefit. Reuse this shape in reflections — it is the form the rubric rewards.',
      steps: [
        {
          n: '1',
          t: 'The paradox',
          d: 'Everyone defines play as useless. Caillois called it “an occasion of pure waste.”',
        },
        {
          n: '2',
          t: 'The cost',
          d: 'Up to 15% of calories; 22 of 26 Peruvian sea pups killed while playing in tidal pools.',
        },
        {
          n: '3',
          t: 'The benefit',
          d: 'Higher BDNF in play-reared rats; bigger relative brain size tracks more play across 15 species.',
        },
        {
          n: '4',
          t: 'The conclusion',
          d: 'Evolution kept it for a reason — it builds brains, bodies and the ability to agree on rules.',
        },
      ],
    },
  ],

  examples: [
    {
      tag: 'Play',
      t: 'Pickup on the Rec turf vs. intramural league',
      d: 'Brown’s seven characteristics survive in pickup and thin out under leagues, refs and standings. Reflection #1 lives exactly here: making play serious can destroy the freedom that made it useful.',
    },
    {
      tag: 'Embodiment',
      t: 'Learning to swim at eighteen',
      d: 'The fear is not a fact about water — it is biology, history and practice folded into one body. That is embodiment in a sentence, and it is the reflection move Torres Colón rewards.',
    },
    {
      tag: 'Chunking',
      t: 'Why you can read a defence and your friend cannot',
      d: 'Same eyes, same reaction time. What differs is the database of patterns — De Groot’s chess masters, Abernethy’s occluded badminton forearm, Pujols against Jennie Finch.',
    },
    {
      tag: 'Race & genetics',
      t: 'The “sprint gene” test sold online',
      d: 'ACTN3 rules out roughly one in seven people worldwide and almost nobody of African descent. Foster: “the best genetic test right now is a stopwatch.”',
    },
    {
      tag: 'Endurance',
      t: 'Sophie Power at the Ultra-Trail du Mont-Blanc',
      d: '168 km while breastfeeding a three-month-old. Ocobock & Lacy close on it because motherhood at 500–600 kcal a day is itself a multi-year endurance event.',
    },
    {
      tag: 'Structure',
      t: 'Why Jamaica keeps producing sprinters',
      d: 'Champs since 1910, a 35,000-seat proving ground, boosters who move fast kids into track high schools. Talent is kept in the sprint pipeline instead of leaking to football as it does in the US.',
    },
    {
      tag: 'Biocultural',
      t: 'The Commodores’ strength programme',
      d: 'Not nature vs. nurture — how much each contributes, here. Training loads act on tendon stiffness and fibre type that already varied between athletes before anyone lifted anything.',
    },
    {
      tag: 'Ritual',
      t: 'The Anchor Down chant before kickoff',
      d: 'Gmelch’s finding is that ritual clusters where uncertainty is highest. A stadium doing the same thing every Saturday is the ball court, doing the work Fox says play has always done: agreeing on rules together.',
    },
  ],

  podcast: {
    blurb:
      'Weeks 1–4 at listening pace, with every figure described in words — built for the walk to Garland.',
    editions: [
      {
        id: 'core-podcast',
        label: 'Podcast',
        file: '/audio/core-podcast.mp3',
        len: '26:30',
        seconds: 1590,
        ready: true,
        blurb:
          'Two hosts through the grade, the five big ideas, and weeks two to four in full — the dolphins, Woman the Hunter, Jennie Finch, ACTN3 — then a ten-question self-test and how to write a reflection that earns the points. Chapter marks are exact.',
        chapters: [
          { t: '0:00', s: 0, name: 'Cold open' },
          { t: '0:29', s: 28, name: 'How the grade actually works' },
          { t: '2:30', s: 150, name: 'The five big ideas' },
          { t: '4:10', s: 250, name: 'Week 2 — Fox and Konner, why we play' },
          { t: '8:47', s: 527, name: 'Week 3 — Woman the Hunter' },
          { t: '11:57', s: 716, name: 'Week 3 — Epstein, hardware and software' },
          { t: '15:11', s: 911, name: 'Week 4 — the (un)science of race' },
          { t: '20:25', s: 1225, name: 'Self-test' },
          { t: '24:49', s: 1489, name: 'Reflections that earn the points' },
          { t: '26:21', s: 1580, name: 'Close' },
        ],
      },
      {
        id: 'core-full',
        label: 'Full',
        file: '/audio/core-full.mp3',
        len: '51:32',
        seconds: 3092,
        ready: true,
        blurb:
          'The whole field guide, spoken, closing with a self-test that leaves you room to answer. Chapter marks were recovered from the recording’s own section breaks.',
        chapters: [
          { t: '0:00', s: 0, name: 'Welcome — what this guide is' },
          { t: '0:57', s: 57, name: 'How the grade actually works' },
          { t: '4:10', s: 250, name: 'The semester in one picture' },
          { t: '6:32', s: 392, name: 'The five ideas everything hangs on' },
          { t: '14:37', s: 877, name: 'Week 2 · Fox & Konner — why we play' },
          { t: '22:20', s: 1340, name: 'Week 3 · Woman the Hunter, and Epstein 1–3' },
          { t: '34:31', s: 2071, name: 'Week 4 · Epstein 9–11 — the (un)science of race' },
          { t: '47:13', s: 2833, name: 'Terms, self-test and reflections' },
        ],
      },
    ],
  },

  planMinutes: '5 min',
  frameLabel: 'The habits that decide the grade',
};

export default core;
