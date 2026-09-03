import type { CourseModule } from '../../../lib/types';
import { ECON_GUIDE } from './guide';
import lessons from './lessons';

/**
 * ECON 1020 · Principles of Microeconomics · Fall 2026
 *
 * Built from Econ1020_2026_Fall.pdf (the syllabus) and econ1020_study_guide.pdf
 * (the study guide). One invented detail, kept because the design has it: the
 * 9:05 section.
 */
const econ: CourseModule = {
  course: {
    id: 'econ',
    code: 'ECON 1020',
    name: 'Principles of Microeconomics',
    prof: 'Dr. John Stromme',
    email: 'john.stromme@vanderbilt.edu',
    meets: 'MWF · 9:05–9:55a',
    room: 'Section 9:05',
    credits: '3 credits',
    source: 'Econ1020_2026_Fall.pdf',
    grading: [
      { what: 'Problem sets (lowest dropped)', pct: '20%' },
      { what: 'Exams — best of three at 30%', pct: '80%' },
      { what: 'Top Hat participation', pct: '+3% EC' },
    ],
  },

  schedule: [
    {
      days: [1, 3, 5],
      at: 9 * 60 + 5,
      time: '9:05a',
      title: 'ECON 1020',
      meta: 'Section 9:05 · Dr. Stromme',
    },
  ],

  items: [
    {
      id: 'econ-ps1',
      c: 'econ',
      title: 'Problem Set 1',
      kind: 'Problem set',
      month: 8,
      day: 4,
      dueTime: '11:59 PM',
      weight: 'Part of 20%',
      where: 'Gradescope',
      detail:
        'Problem sets land roughly every Friday. No extensions for any reason — but your lowest score is dropped.',
      quote: 'No extensions will be given for problem sets for any reason.',
      source: 'Econ1020_2026_Fall.pdf · Evaluation',
    },
    {
      id: 'econ-m1',
      c: 'econ',
      title: 'Midterm 1',
      kind: 'Exam',
      month: 8,
      day: 30,
      dueTime: 'In class',
      weight: '25–30%',
      where: 'In person, closed note',
      detail:
        'Multiple choice, in class, closed note. Weighted 30% if it is your best exam, otherwise 25%.',
      quote: 'MIDTERM 1 : September 30th (Wednesday, in class)',
      source: 'Econ1020_2026_Fall.pdf · Important dates',
    },
    {
      id: 'econ-m2',
      c: 'econ',
      title: 'Midterm 2',
      kind: 'Exam',
      month: 10,
      day: 4,
      dueTime: 'In class',
      weight: '25–30%',
      where: 'In person, closed note',
      detail: 'Second of the three multiple-choice exams. Same weighting rule as Midterm 1.',
      quote: 'MIDTERM 2 : November 4th (Wednesday, in class)',
      source: 'Econ1020_2026_Fall.pdf · Important dates',
    },
    {
      id: 'econ-m3',
      c: 'econ',
      title: 'Midterm 3 / Final exam',
      kind: 'Exam',
      month: 11,
      day: 15,
      dueTime: '3:00–5:00 PM',
      weight: '25–40%',
      where: 'Official final exam slot',
      detail:
        'Takes the official exam slot. Swap it for a comprehensive final worth 40% if that helps your total.',
      quote: 'MID 3/FINAL EXAM : (Will take place during our official "final exam slot")',
      source: 'Econ1020_2026_Fall.pdf · Important dates',
    },
  ],

  guide: ECON_GUIDE,
  lessons,

  figures: {
    0: {
      type: 'steps',
      title: 'The four-step study method',
      caption:
        'Prof. Stromme’s own sequence. Step 1 is where he says 95% of students fool themselves — “I recognise this” is not “I can explain this.”',
      steps: [
        {
          n: '1',
          t: 'Review the deck',
          d: 'Right after lecture. Explain every point out loud, no notes.',
        },
        {
          n: '2',
          t: 'Psets alone first',
          d: 'Ask which building block each problem is testing. Then friend, then TA.',
        },
        {
          n: '3',
          t: 'Read the key',
          d: 'Including for questions you got right — right answer, wrong reason still costs you.',
        },
        {
          n: '4',
          t: 'Practice exams',
          d: 'Timed, closed note. Then rewrite each question until you see what it tests.',
        },
      ],
    },
    2: {
      type: 'bars',
      title: 'How many hours to study?',
      caption:
        'Each hour costs $20 of foregone work. Total analysis peaks at 3 hours; marginal analysis stops there too — hour 3 is worth $25, hour 4 only $10. Same answer, less arithmetic.',
      unit: '$ net',
      max: 70,
      rows: [
        { l: '1 hour', v: 40 },
        { l: '2 hours', v: 60 },
        { l: '3 hours', v: 65 },
        { l: '4 hours', v: 55 },
      ],
    },
    3: {
      type: 'diagram',
      kind: 'supply-demand',
      title: 'Reading a market',
      caption:
        'Both curves are marginal curves — demand height is willingness to pay, supply height is willingness to accept. That is why the crossing point is efficient, not just tidy. Above P*, Qs exceeds Qd and sellers cut price; below it, buyers bid up.',
    },
    4: {
      type: 'diagram',
      kind: 'elasticity-along-demand',
      title: 'Elasticity is not slope',
      caption:
        'A straight-line demand curve has one constant slope and a changing elasticity: elastic on the upper half, unit elastic exactly at the midpoint, inelastic on the lower half. Total revenue is largest at that midpoint.',
    },
    5: {
      type: 'diagram',
      kind: 'cost-curves',
      title: 'The cost curve picture',
      caption:
        'MC always cuts AVC and ATC at their minimums — an average falls while the next value is below it and rises once it is above. The gap between ATC and AVC is AFC, shrinking forever as fixed cost spreads.',
    },
    7: {
      type: 'diagram',
      kind: 'externality',
      title: 'Externalities in four curves',
      caption:
        'Private parties trade where MPB = MPC. Society’s optimum is MSB = MSC. With a negative externality MSC sits above MPC, the market overproduces, and the shaded wedge is the deadweight loss.',
    },
    8: {
      type: 'diagram',
      kind: 'monopoly',
      title: 'Monopoly, in two steps',
      caption:
        'MR has the same intercept and twice the slope of demand. Find Q where MR = MC, then go straight up to the demand curve for the price. CS shrinks, part transfers to the firm, and the rest is deadweight loss.',
    },
  },

  extraFigures: [
    {
      type: 'diagram',
      kind: 'price-ceiling',
      title: 'An effective price ceiling',
      caption:
        'A binding ceiling sits below equilibrium: buyers want a lot, sellers offer little, and trade stops at Qs. Ceiling gives excess demand — a shortage. A floor sits above and gives excess supply. Draw the horizontal line before you answer.',
    },
  ],

  examples: [
    {
      tag: 'Elasticity',
      t: 'Why the campus dining plan never gets cheaper',
      d: 'Meal plans are close to perfectly inelastic for on-campus first-years — no substitutes, mandatory, and the budget share is fixed in advance. |ε| < 1 means a price rise raises revenue, which is exactly the incentive the seller faces.',
    },
    {
      tag: 'Sunk cost',
      t: 'The $180 textbook you already bought',
      d: 'Acemoglu, Laibson and List is “not formally required.” The money is gone either way, so the only question is whether the next hour with it beats the next hour without it. Buying it is not a reason to read it.',
    },
    {
      tag: 'Price ceiling',
      t: 'Rent control on 21st Avenue',
      d: 'A binding ceiling sits below equilibrium: more students want the apartment than landlords will supply, trade stops at Qs, and the rationing moves to queues, connections and condition. The shortage is the mechanism, not a side effect.',
    },
    {
      tag: 'Monopoly',
      t: 'The one printer in Sarratt',
      d: 'Market power is the ability to set price above marginal cost. Q comes from MR = MC, price comes off the demand curve — and the students who would have printed at cost but not at the posted price are the deadweight loss.',
    },
    {
      tag: 'Game theory',
      t: 'Group projects as a prisoner’s dilemma',
      d: 'Coasting dominates for each member, so (coast, coast) is the Nash equilibrium even though everyone prefers (work, work). Grading contribution individually changes the payoffs — which is the point.',
    },
    {
      tag: 'Adverse selection',
      t: 'Course reviews on Rate My Professor',
      d: 'Only the delighted and the furious write reviews — a hidden-type problem before the deal. The fix is better information, not a bigger sample of the same self-selected pool.',
    },
    {
      tag: 'Externality',
      t: 'The 2am group chat in a shared suite',
      d: 'Your marginal private benefit is high and the cost lands on people who were not party to the decision. MSC sits above MPC, so the activity is overproduced — and the Coase fix works here precisely because there are few parties and clear norms.',
    },
    {
      tag: 'Opportunity cost',
      t: 'An unpaid internship that “pays in experience”',
      d: 'The cost is the best foregone alternative, priced at your wage. Twelve weeks at 30 hours and $18 is about $6,500 — so the question is whether the experience is worth more than that, not whether the internship is free.',
    },
  ],

  podcast: {
    blurb: 'The whole guide, two ways — as a conversation, or read straight through.',
    editions: [
      {
        id: 'econ-podcast',
        label: 'Podcast',
        file: '/audio/econ-podcast.mp3',
        len: '28:17',
        seconds: 1696,
        ready: true,
        blurb:
          'Two hosts through the ten chapters — the four-step study method, the workhorse model, elasticity, cost curves, monopoly, game theory — then the formula sheet, a twelve-question self-test, and the traps rapid-fire. Chapter marks are exact.',
        chapters: [
          { t: '0:00', s: 0, name: 'Cold open' },
          { t: '0:36', s: 35, name: 'How to actually pass' },
          { t: '2:21', s: 140, name: 'What economics is' },
          { t: '3:53', s: 232, name: 'Optimisation and opportunity cost' },
          { t: '5:28', s: 328, name: 'Supply, demand, equilibrium' },
          { t: '7:39', s: 458, name: 'Surplus and elasticity' },
          { t: '10:13', s: 613, name: 'Producers and cost curves' },
          { t: '12:56', s: 776, name: 'Efficiency and externalities' },
          { t: '15:52', s: 951, name: 'Monopoly and game theory' },
          { t: '19:13', s: 1152, name: 'Competition and information' },
          { t: '21:06', s: 1265, name: 'The formula sheet' },
          { t: '22:13', s: 1332, name: 'Self-test' },
          { t: '26:53', s: 1613, name: 'The traps' },
          { t: '28:05', s: 1684, name: 'Close' },
        ],
      },
      {
        id: 'econ-guide',
        label: 'Full read',
        file: '/audio/econ-guide.mp3',
        len: '38:27',
        seconds: 2307,
        ready: true,
        blurb:
          'Every chapter of the study guide, spoken. Chapter marks follow the guide’s section order and are approximate — this recording has no pauses to lock them to.',
        chapters: [
          { t: '0:00', s: 0, name: 'How to actually pass this class' },
          { t: '3:10', s: 190, name: 'Ch 1–2 · What economics is' },
          { t: '6:40', s: 400, name: 'Ch 3 · Optimization & opportunity cost' },
          { t: '10:05', s: 605, name: 'Ch 4 · Supply, demand, equilibrium' },
          { t: '15:20', s: 920, name: 'Ch 5 · Surplus & elasticity' },
          { t: '20:40', s: 1240, name: 'Ch 6 · Producers & cost curves' },
          { t: '25:15', s: 1515, name: 'Ch 7 · Invisible hand & efficiency' },
          { t: '28:30', s: 1710, name: 'Ch 9 · Externalities' },
          { t: '31:40', s: 1900, name: 'Ch 12 · Monopoly' },
          { t: '34:20', s: 2060, name: 'Ch 13 · Game theory' },
          { t: '36:45', s: 2205, name: 'Formula sheet & top traps' },
        ],
      },
    ],
  },

  planMinutes: '10 min',
  frameLabel: 'The traps that cost the most points',
};

export default econ;
