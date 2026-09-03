import type { CourseModule } from '../../../lib/types';
import { PSCI_GUIDE } from './guide';

/**
 * PSCI 1104 · Understanding Political Controversy · Fall 2026
 *
 * Built from PSCI1104_Trounstine_F26.pdf and the published "PSCI 1104 Field
 * Guide" artifact.
 */
const psci: CourseModule = {
  course: {
    id: 'psci',
    code: 'PSCI 1104',
    name: 'Understanding Political Controversy',
    prof: 'Prof. Jessica Trounstine',
    email: 'jessica.l.trounstine@vanderbilt.edu',
    meets: 'T/R · 2:45–4:00p',
    room: 'Garland 162',
    credits: '3 credits',
    source: 'PSCI1104_Trounstine_F26.pdf',
    grading: [
      { what: 'Six quizzes, 5% each', pct: '30%' },
      { what: 'Midterm — Oct 15, in class', pct: '30%' },
      { what: 'Final — Dec 17, 9–11a', pct: '35%' },
      { what: 'Attendance (Top Hat 782449)', pct: '5%' },
    ],
  },

  schedule: [
    {
      days: [2, 4],
      at: 14 * 60 + 45,
      time: '2:45p',
      title: 'PSCI 1104',
      meta: 'Garland 162 · Prof. Trounstine',
    },
    {
      days: [4],
      at: 10 * 60 + 30,
      time: '10:30a',
      title: 'Trounstine office hours',
      meta: 'Commons 363A · optional',
      optional: true,
    },
  ],

  exceptions: [
    // The Thursday the design was drawn against — she is away, so both the
    // class and the office hours go.
    { month: 8, day: 3, canceled: true, meta: 'Prof. Trounstine at APSA' },
    {
      month: 8,
      day: 3,
      title: 'Trounstine office hours',
      canceled: true,
      meta: 'At APSA — back next week',
    },
  ],

  items: [
    {
      id: 'psci-q1',
      c: 'psci',
      title: 'Quiz #1 — take-home + in-class',
      kind: 'Quiz',
      month: 8,
      day: 15,
      dueTime: 'Take-home posted 9a Sep 14',
      weight: '5% of grade',
      where: 'Brightspace',
      detail:
        'Units 1–3: provenance of numbers, theory, measurement, the Kansas debate. The take-home half is due before class starts.',
      quote: 'The take home component will be posted at 9am on the day prior to the quiz date.',
      source: 'PSCI1104_Trounstine_F26.pdf · Quizzes',
    },
    {
      id: 'psci-q2',
      c: 'psci',
      title: 'Quiz #2 — hypotheses, Gilens, the four hurdles',
      kind: 'Quiz',
      month: 8,
      day: 24,
      dueTime: 'Before class, 2:45p',
      weight: '5% of grade',
      where: 'Brightspace',
      detail: 'Adds hypotheses and variables, the Gilens content analysis, and causality.',
      quote: 'Quiz dates are: September 15th, September 24th, October 6th…',
      source: 'PSCI1104_Trounstine_F26.pdf',
    },
    {
      id: 'psci-q3',
      c: 'psci',
      title: 'Quiz #3 — research design, money and votes, experiments',
      kind: 'Quiz',
      month: 9,
      day: 6,
      dueTime: 'Before class, 2:45p',
      weight: '5% of grade',
      where: 'Brightspace',
      detail: 'Covers research design and validity, and the experiments unit.',
      quote: 'Quiz dates are: September 15th, September 24th, October 6th…',
      source: 'PSCI1104_Trounstine_F26.pdf',
    },
    {
      id: 'psci-mid',
      c: 'psci',
      title: 'Midterm exam',
      kind: 'Exam',
      month: 9,
      day: 15,
      dueTime: 'In class, 2:45p',
      weight: '30% of grade',
      where: 'Garland 162',
      detail: 'Everything through Oct 13 — units 1 to 8.',
      quote: 'The midterm will be in class on October 15th.',
      source: 'PSCI1104_Trounstine_F26.pdf',
    },
    {
      id: 'psci-q4',
      c: 'psci',
      title: 'Quiz #4 — sampling, polling error, weighting',
      kind: 'Quiz',
      month: 9,
      day: 29,
      dueTime: 'Before class, 2:45p',
      weight: '5% of grade',
      where: 'Brightspace',
      detail: 'Units 9 and 10 — the margin of error, and everything it does not cover.',
      quote: 'Quiz dates are: September 15th, September 24th, October 6th…',
      source: 'PSCI1104_Trounstine_F26.pdf',
    },
    {
      id: 'psci-q5',
      c: 'psci',
      title: 'Quiz #5 — independents, probability, the normal curve',
      kind: 'Quiz',
      month: 10,
      day: 10,
      dueTime: 'Before class, 2:45p',
      weight: '5% of grade',
      where: 'Brightspace',
      detail: 'The independents debate plus unit 11.',
      quote: 'Quiz dates are: September 15th, September 24th, October 6th…',
      source: 'PSCI1104_Trounstine_F26.pdf',
    },
    {
      id: 'psci-q6',
      c: 'psci',
      title: 'Quiz #6 — significance, crime, regression, campaigns',
      kind: 'Quiz',
      month: 11,
      day: 3,
      dueTime: 'Before class, 2:45p',
      weight: '5% of grade',
      where: 'Brightspace',
      detail: 'Units 12 and 13, plus the crime-decline debate.',
      quote: 'Quiz dates are: September 15th, September 24th, October 6th…',
      source: 'PSCI1104_Trounstine_F26.pdf',
    },
    {
      id: 'psci-final',
      c: 'psci',
      title: 'Final exam — cumulative',
      kind: 'Exam',
      month: 11,
      day: 17,
      dueTime: '9:00–11:00 AM',
      weight: '35% of grade',
      where: 'Official exam slot',
      detail: 'Cumulative — all fourteen units.',
      quote: 'Final, 9–11am. Cumulative — all fourteen units.',
      source: 'PSCI1104_Trounstine_F26.pdf · Exam kit',
    },
  ],

  guide: PSCI_GUIDE,

  figures: {
    1: {
      type: 'diagram',
      kind: 'validity-reliability',
      title: 'Validity vs. reliability',
      caption:
        'The dangerous box is the second one. A measure can be perfectly consistent and perfectly wrong — self-reported turnout is reliable and invalid. More data never fixes a validity problem.',
    },
    2: {
      type: 'diagram',
      kind: 'skew',
      title: 'Skew, and why the average moves',
      caption:
        'Income is the classic right-skewed variable: a handful of very rich people pull the mean far above the median. That is why “average income” flatters and “median income” describes. The mean always sits toward the tail.',
    },
    4: {
      type: 'steps',
      title: 'The four hurdles',
      caption:
        'Knock over any one and the claim is done. Most public arguments clear only Hurdle 3 and stop there. Random assignment clears 2 and 4 at once.',
      steps: [
        { n: '1', t: 'Mechanism', d: 'Is there a credible causal story connecting X to Y?' },
        { n: '2', t: 'Reverse causation', d: 'Can we rule out that Y causes X?' },
        { n: '3', t: 'Covariation', d: 'Do X and Y actually move together?' },
        { n: '4', t: 'Confounders', d: 'Have we controlled for Z?' },
      ],
    },
    6: {
      type: 'bars',
      title: 'Gerber, Green & Larimer (2008)',
      caption:
        'Turnout by treatment, 180,002 households. A dosage design: each step adds one ingredient, and the jump tells you what it is worth. $1.93 per vote for Neighbors, against roughly $20 door-to-door.',
      unit: '%',
      max: 40,
      rows: [
        { l: 'Control — no mail', v: 29.7 },
        { l: 'Civic Duty', v: 31.5 },
        { l: 'Hawthorne', v: 32.2 },
        { l: 'Self', v: 34.5 },
        { l: 'Neighbors', v: 37.8 },
      ],
    },
    7: {
      type: 'bars',
      title: 'Bartels: the Kansas shift, by slice',
      caption:
        'Change among white non-college voters, 1952–2004. Uncontrolled it looks like Frank is right. Control for region and the whole effect is Southern — outside the South, fifty-two years produced one point.',
      unit: 'pts',
      max: 20,
      rows: [
        { l: 'All white non-college', v: 5.9 },
        { l: '…in the South', v: 19.7 },
        { l: '…outside the South', v: 1.0 },
      ],
    },
    8: {
      type: 'bars',
      title: 'Margin of error shrinks with √n',
      caption:
        'A thousand people buys ±3 points. Halving that needs four times the sample — which is why national polls are 800–1,500. And the population size does not matter.',
      unit: '±%',
      max: 5.5,
      rows: [
        { l: 'n = 400', v: 5.0 },
        { l: 'n = 1,000', v: 3.2 },
        { l: 'n = 2,000', v: 2.2 },
        { l: 'n = 3,000', v: 1.8 },
      ],
    },
    10: {
      type: 'diagram',
      kind: 'normal-curve',
      title: 'The 68–95–99.7 rule',
      caption:
        'About 68% of cases within one SD of the mean, 95% within two, 99.7% within three. The z-score converts any value onto this scale: z = (value − mean) ÷ SD.',
    },
    12: {
      type: 'diagram',
      kind: 'scatter-chocolate',
      title: 'The most famous fake causal claim on the syllabus',
      caption:
        'Messerli (2012), NEJM. r = 0.79, so r² ≈ 0.62 — real, strong, highly significant, and not causal. No mechanism, live reverse causation, every confounder uncontrolled, and the unit of analysis is the country.',
    },
  },

  extraFigures: [
    {
      type: 'diagram',
      kind: 'causal-diagrams',
      title: 'Four things a correlation can mean',
      caption:
        'Learn to tell the third panel from the fourth. An antecedent Z sits before X and destroys the claim. An intervening M sits between X and Y and explains it. Same-looking diagram, opposite verdict — a favourite exam distinction.',
    },
    {
      type: 'bars',
      title: 'Bertrand & Mullainathan (2004) — callback rates',
      caption:
        '~5,000 résumés to 1,300+ ads. A 3.2-point gap, 50% higher, worth about eight extra years of experience. And the gap widens as résumés improve: +2.29 points for white names, +0.51 (not significant) for Black ones.',
      unit: '%',
      max: 12,
      rows: [
        { l: 'White-sounding names', v: 9.65 },
        { l: 'Black-sounding names', v: 6.45 },
      ],
    },
    {
      type: 'bars',
      title: 'Levitt: share of the 1990s homicide decline explained',
      caption:
        'Homicide fell 43% between 1991 and 2001; four factors account for roughly 36 points. Meanwhile the ten largest newspapers mentioned innovative policing 52 times and legalized abortion — his second-largest factor — zero times.',
      unit: 'pts of 43',
      max: 14,
      rows: [
        { l: 'More police', v: 10 },
        { l: 'Rising prison population', v: 12 },
        { l: 'Legalized abortion', v: 10 },
        { l: 'Receding crack epidemic', v: 4 },
      ],
    },
    {
      type: 'bars',
      title: 'Representativeness among voters, 1972 vs. 2008',
      caption:
        'The punchline is the top line: it did not move. Across thirty-six years of exploding inequality the bottom income fifth sat at 0.79 both years. Race is where the change happened. 1.0 is parity.',
      unit: 'ratio',
      max: 1.2,
      rows: [
        { l: 'Bottom income fifth, 1972', v: 0.79 },
        { l: 'Bottom income fifth, 2008', v: 0.79 },
        { l: 'Aged 18–24, throughout', v: 0.77 },
        { l: 'Aged 76–84, 1972', v: 0.91 },
        { l: 'Aged 76–84, 2008', v: 1.11 },
      ],
    },
  ],

  examples: [
    {
      tag: 'Four hurdles',
      t: '“Vanderbilt students who join a club have higher GPAs.”',
      d: 'Hurdle 3 is easy. Hurdle 2: high-GPA students have the slack to join. Hurdle 4: family resources, prior preparation and course load cause both. The claim clears one hurdle of four.',
    },
    {
      tag: 'Selection on Y',
      t: 'Studying only the startups that made it',
      d: 'Every case has the same outcome, so nothing distinguishes causes from constants. KKV: select on X, never on Y. The same error kills “what makes a Rhodes Scholar” pieces.',
    },
    {
      tag: 'Ecological fallacy',
      t: 'Chocolate and Nobel prizes',
      d: 'r = 0.79, p < .0001, 23 countries — and not one laureate’s diet was ever observed. Messerli wrote it as a joke; it is on the syllabus because the joke keeps getting published seriously.',
    },
    {
      tag: 'Measurement',
      t: 'Turnout that never actually fell',
      d: 'Leighley & Nagler: 58.4–65.5% throughout, once you use citizens as the denominator. Noncitizens grew from under 2% to 8.4% of the voting-age population — the whole “decline” is a denominator artifact.',
    },
    {
      tag: 'Weighting',
      t: 'Four pollsters, one dataset, five points apart',
      d: 'Cohn gave 867 identical Florida interviews to four outside pollsters and got Clinton +4 through Trump +1. Zero sampling difference. Weighting and the likely-voter screen did all of it.',
    },
    {
      tag: 'Experiment',
      t: 'The mailer that shamed people into voting',
      d: '+8.1 points at $1.93 per vote against roughly $20 door-to-door. It also generated hundreds of angry calls — a good exam answer names the effect and the cost.',
    },
    {
      tag: 'Operationalization',
      t: 'Who counts as “working class” on a ballot map',
      d: 'Define it by degree and Bartels finds −5.9 points. Define it by income and the poorest white voters moved toward the Democrats. Frank never fixed his definition, so his thesis was never testable.',
    },
    {
      tag: 'Effect size',
      t: 'Why the newspapers got the crime decline wrong',
      d: 'Levitt’s four factors explain about 36 of the 43 points. Newspapers mentioned innovative policing 52 times and legalized abortion zero. Explanations get ranked by how satisfying they are, not by how much they explain.',
    },
  ],

  podcast: {
    blurb:
      'Three editions. Every figure is described in words, so you do not need to be looking at anything.',
    editions: [
      {
        id: 'psci-podcast',
        label: 'Podcast',
        file: '/audio/psci-podcast.mp3',
        len: '35:03',
        seconds: 2103,
        ready: true,
        blurb:
          'Two hosts working through the machinery — theory, measurement, the four hurdles, experiments, sampling, why polls miss — then the five exam frames and a twelve-question self-test with room to answer. Chapter marks are exact.',
        chapters: [
          { t: '0:00', s: 0, name: 'Cold open' },
          { t: '0:56', s: 56, name: 'Theory and hypotheses' },
          { t: '3:40', s: 220, name: 'Measurement, and why it decides Kansas' },
          { t: '6:37', s: 397, name: 'Describing data, and the ecological fallacy' },
          { t: '7:43', s: 463, name: 'Hypotheses and variables' },
          { t: '8:51', s: 531, name: 'Causality — the four hurdles' },
          { t: '10:59', s: 658, name: 'Research design and validity' },
          { t: '12:39', s: 758, name: 'Experiments' },
          { t: '15:49', s: 948, name: 'Controlling without an experiment' },
          { t: '18:51', s: 1131, name: 'Sampling' },
          { t: '20:24', s: 1223, name: 'Why polls miss' },
          { t: '22:35', s: 1354, name: 'Probability, inference and regression' },
          { t: '25:59', s: 1558, name: 'Small-N and selection bias' },
          { t: '27:37', s: 1657, name: 'The five exam frames' },
          { t: '29:26', s: 1766, name: 'Self-test' },
          { t: '34:42', s: 2082, name: 'Close' },
        ],
      },
      {
        id: 'psci-condensed',
        label: 'Condensed',
        file: '/audio/psci-condensed.mp3',
        len: '43:48',
        seconds: 2628,
        ready: true,
        blurb:
          'The whole course, tightened for repeat listening. Every key concept and every number that matters — the one to play on the walk to class.',
        chapters: [
          { t: '0:00', s: 0, name: 'Welcome' },
          { t: '0:44', s: 44, name: 'The one idea' },
          { t: '1:45', s: 105, name: 'Theory and hypotheses' },
          { t: '3:48', s: 228, name: 'Where numbers come from' },
          { t: '5:20', s: 320, name: 'Measurement' },
          { t: '7:30', s: 450, name: 'Why measurement decides Kansas' },
          { t: '9:41', s: 581, name: 'Describing data' },
          { t: '10:57', s: 657, name: 'The four hurdles' },
          { t: '12:56', s: 776, name: 'What cause means' },
          { t: '14:00', s: 840, name: 'Reading causal diagrams' },
          { t: '15:03', s: 903, name: 'Validity and research design' },
          { t: '16:39', s: 999, name: 'Experiments' },
          { t: '20:33', s: 1233, name: 'Controlling without an experiment' },
          { t: '23:23', s: 1403, name: 'Sampling' },
          { t: '25:48', s: 1548, name: 'Why polls miss' },
          { t: '28:04', s: 1684, name: 'Probability and inference' },
          { t: '31:22', s: 1882, name: 'Correlation and regression' },
          { t: '33:01', s: 1981, name: 'Small numbers and selection bias' },
          { t: '35:22', s: 2122, name: 'The seven debates' },
          { t: '41:28', s: 2488, name: 'The exam' },
          { t: '43:20', s: 2600, name: 'Close' },
        ],
      },
      {
        id: 'psci-full',
        label: 'Full',
        file: '/audio/psci-full.mp3',
        len: '84:52',
        seconds: 5092,
        ready: true,
        blurb:
          'All fourteen units at full depth, the seven debates, and a spoken self-test — twelve questions, each followed by seven seconds of silence, then the answer. A deep pass before the midterm and again before the final.',
        chapters: [
          { t: '0:00', s: 0, name: 'Welcome' },
          { t: '0:46', s: 46, name: 'The shape of the course' },
          { t: '2:13', s: 133, name: 'Unit 1 · Theory-driven research' },
          { t: '6:15', s: 375, name: 'Unit 2 · Concepts and measurement' },
          { t: '9:45', s: 585, name: 'The Kansas argument' },
          { t: '12:37', s: 757, name: 'Unit 3 · Describing a variable' },
          { t: '14:54', s: 894, name: 'Unit 4 · Hypotheses and variables' },
          { t: '16:59', s: 1019, name: 'Unit 5 · Causality, part one' },
          { t: '19:38', s: 1178, name: 'Unit 5 · Causality, part two' },
          { t: '23:06', s: 1386, name: 'Reading causal diagrams' },
          { t: '24:09', s: 1449, name: 'Unit 6 · Research design' },
          { t: '28:46', s: 1726, name: 'Unit 7 · Experiments' },
          { t: '34:41', s: 2081, name: 'Unit 8 · Controlling without an experiment' },
          { t: '40:36', s: 2436, name: 'Unit 9 · Sampling' },
          { t: '45:04', s: 2704, name: 'Unit 10 · Why polls miss' },
          { t: '49:19', s: 2959, name: 'Unit 11 · Probability and the normal curve' },
          { t: '51:24', s: 3084, name: 'Unit 12 · Inference and significance' },
          { t: '55:16', s: 3316, name: 'Unit 13 · Correlation and regression' },
          { t: '58:36', s: 3516, name: 'Unit 14 · Small numbers and selection bias' },
          { t: '62:21', s: 3741, name: 'The seven debates' },
          { t: '70:22', s: 4222, name: 'Levitt’s accounting' },
          { t: '72:01', s: 4321, name: 'The five exam frames' },
          { t: '74:39', s: 4479, name: 'Self-test' },
          { t: '81:02', s: 4862, name: 'Glossary' },
          { t: '84:14', s: 5054, name: 'Close' },
        ],
      },
    ],
  },

  planMinutes: '8 min',
  frameLabel: 'The five questions that keep coming back',
};

export default psci;
