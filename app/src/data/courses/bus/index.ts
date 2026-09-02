import type { CourseModule } from '../../../lib/types';
import { BUS_GUIDE } from './guide';

/**
 * BUS 1600 · Marketing Management · Fall 2026
 *
 * Built from "Syllabus Draft 8262026.pdf" and the published "BUS 1600 Field
 * Manual" artifact. One invented detail, kept because the design has it: the
 * 11:00a meeting time — the syllabus gives only T/R.
 */
const bus: CourseModule = {
  course: {
    id: 'bus',
    code: 'BUS 1600',
    name: 'Marketing Management',
    prof: 'Dr. Eric Hogue',
    email: 'eric.d.hogue@vanderbilt.edu',
    meets: 'T/R · Alumni Hall 201',
    room: 'Alumni Hall 201',
    credits: '2 credits',
    source: 'Syllabus Draft 8262026.pdf',
    grading: [
      { what: 'Midterm case write-up', pct: '30%' },
      { what: 'Final exam', pct: '25%' },
      { what: 'Four group assignments', pct: '20%' },
      { what: 'Attendance', pct: '10%' },
      { what: 'Individual assignment', pct: '10%' },
      { what: 'SONA research participation', pct: '5%' },
    ],
  },

  schedule: [
    {
      days: [2, 4],
      at: 11 * 60,
      time: '11:00a',
      title: 'BUS 1600',
      meta: 'Alumni Hall 201 · Dr. Hogue',
    },
  ],

  exceptions: [
    {
      month: 8,
      day: 3,
      meta: 'Alumni Hall 201 · guest speaker: Ryan',
      note: 'Guest speaker: Ryan · Promotion & Advertising · read MM ch. 19',
      extra: {
        at: 19 * 60,
        time: '7:00p',
        title: 'Group call — ECOALF',
        meta: 'Added by you · due 11:59p',
      },
    },
  ],

  items: [
    {
      id: 'bus-ga1',
      c: 'bus',
      title: 'Group Assignment 1 — ECOALF case',
      kind: 'Group work',
      month: 8,
      day: 3,
      dueTime: '11:59 PM',
      weight: '5% of grade',
      where: 'Brightspace',
      detail:
        'Read “ECOALF: Fashion for the Future” and submit the team assignment. Late 1–7 days costs 20%.',
      quote: 'Group Assignment 1 (Due, 11:59PM)',
      source: 'Syllabus Draft 8262026.pdf · Schedule, 9/3',
    },
    {
      id: 'bus-sona',
      c: 'bus',
      title: 'SONA research session 1',
      kind: 'Research',
      month: 8,
      day: 8,
      dueTime: 'Window opens Sep 8',
      weight: 'Half of 5%',
      where: 'Center Bldg, Suite 245',
      detail: 'Two windows, one session each. Miss window 1 and the full 5% is gone for good.',
      quote:
        'If you do not complete Session 1 by September 17, you will no longer be able to earn the full 5%.',
      source: 'Syllabus Draft 8262026.pdf · Research participation',
    },
    {
      id: 'bus-case',
      c: 'bus',
      title: 'Midterm case write-up — Opera Philadelphia',
      kind: 'Paper',
      month: 8,
      day: 15,
      dueTime: '11:59 PM',
      weight: '30% of grade',
      where: 'Brightspace',
      detail:
        'Five sections, max three pages plus exhibits, 10pt minimum. No outside research, no hindsight data.',
      quote: 'Length: Max 3 pages of text + supplemental exhibits.',
      source: 'Syllabus Draft 8262026.pdf · Midterm case',
    },
    {
      id: 'bus-ga2',
      c: 'bus',
      title: 'Group Assignment 2 — in class',
      kind: 'Group work',
      month: 8,
      day: 17,
      dueTime: 'In class',
      weight: '5% of grade',
      where: 'Alumni Hall 201',
      detail: 'Digital marketing session. Also the last day of SONA window 1.',
      quote: 'Group Assignment 2 in class · last day for SONA window 1',
      source: 'Syllabus Draft 8262026.pdf · Schedule, 9/17',
    },
    {
      id: 'bus-ga3',
      c: 'bus',
      title: 'Group Assignment 3',
      kind: 'Group work',
      month: 8,
      day: 29,
      dueTime: '11:59 PM',
      weight: '5% of grade',
      where: 'Brightspace',
      detail: 'Assigned in the branding session. SONA window 2 opens the same day.',
      quote: 'Group Assignment 3 due 11:59PM · SONA window 2 opens',
      source: 'Syllabus Draft 8262026.pdf · Schedule, 9/29',
    },
    {
      id: 'bus-indiv',
      c: 'bus',
      title: 'Individual marketing research assignment',
      kind: 'Paper',
      month: 9,
      day: 1,
      dueTime: '11:59 PM',
      weight: '10% of grade',
      where: 'Brightspace',
      detail: 'Released Sep 22 in the product session. Same shape as the research brief.',
      quote: 'Individual case due 11:59PM · Group 4 handed out (wine box case)',
      source: 'Syllabus Draft 8262026.pdf · Schedule, 10/1',
    },
    {
      id: 'bus-ga4',
      c: 'bus',
      title: 'Group Assignment 4 — wine box case',
      kind: 'Group work',
      month: 9,
      day: 6,
      dueTime: 'In class',
      weight: '5% of grade',
      where: 'Alumni Hall 201',
      detail: 'Mekanism’s “Franz for Life” campaign, in the distribution session.',
      quote: 'Group Assignment 4 in class',
      source: 'Syllabus Draft 8262026.pdf · Schedule, 10/6',
    },
    {
      id: 'bus-final',
      c: 'bus',
      title: 'Final exam — 40 MC + 10 short answer',
      kind: 'Exam',
      month: 9,
      day: 13,
      dueTime: 'In class',
      weight: '25% of grade',
      where: 'Alumni Hall 201',
      detail:
        'Comprehensive. Multiple choice rewards definitions; short answer rewards distinguishing two similar terms and giving an example.',
      quote: 'FINAL EXAM — 40 multiple choice + 10 short answer',
      source: 'Syllabus Draft 8262026.pdf · Schedule, 10/13',
    },
    {
      id: 'bus-ec',
      c: 'bus',
      title: 'Extra credit — Starbucks “Ube & Energy” plan',
      kind: 'Extra credit',
      month: 9,
      day: 13,
      dueTime: '11:59 PM',
      weight: '+2% of grade',
      where: 'Brightspace',
      detail:
        'Five-page memo: situation analysis, strategy, implementation calendar. Everything in the course closes this night.',
      quote: 'All assignments must be completed and turned in by October 13th, 11:59 PM CT.',
      source: 'Syllabus Draft 8262026.pdf · Extra credit',
    },
  ],

  guide: BUS_GUIDE,

  figures: {
    0: {
      type: 'bars',
      title: 'Where the grade actually comes from',
      caption:
        'The case and the final are 55% together. Attendance and SONA are the free 15% — zero studying required, and missing them turns an A into a B.',
      unit: '%',
      max: 32,
      rows: [
        { l: 'Midterm case write-up', v: 30 },
        { l: 'Final exam', v: 25 },
        { l: 'Group assignments (4×5%)', v: 20 },
        { l: 'Attendance', v: 10 },
        { l: 'Individual assignment', v: 10 },
        { l: 'SONA research', v: 5 },
      ],
    },
    1: {
      type: 'steps',
      title: 'The 5 C’s',
      caption:
        'The playbook for mapping a brand’s situation. Competitors is the one students define too narrowly — Netflix’s competitor was sleep, video games and going out.',
      steps: [
        { n: 'C1', t: 'Customers', d: 'Whose needs the company plans to fulfil. Size, needs, how they buy.' },
        { n: 'C2', t: 'Collaborators', d: 'Suppliers, retailers, agencies — those who create value with you.' },
        { n: 'C3', t: 'Competitors', d: 'Anyone fulfilling the same need for the same customers.' },
        { n: 'C4', t: 'Company', d: 'Resources, skills, offering, goals.' },
        { n: 'C5', t: 'Context', d: 'Economy, tech, regulation, culture.' },
      ],
    },
    2: {
      type: 'diagram',
      kind: 'three-v',
      title: 'The three legs of market value',
      caption:
        'Viable = customer value > 0 AND collaborator value > 0 AND company value > 0. Kill any leg and the offer collapses. MoviePass had two of three, which is a bankruptcy.',
    },
    7: {
      type: 'diagram',
      kind: 'perceptual-map',
      title: 'A perceptual map',
      caption:
        'Where a brand sits in the customer’s head. Open space is either an opportunity or a place nobody wants to be — your job is to say which, and why.',
    },
    8: {
      type: 'diagram',
      kind: 'funnel',
      title: 'The five-stage buying process',
      caption:
        'Buying is a process, not a moment. Each stage has its own lever, so naming the stage tells you which tactic to pull.',
    },
    9: {
      type: 'bars',
      title: 'The decoy effect — The Economist test',
      caption:
        'Nobody chose the $125 print-only option. Deleting it moved print+web from 84% down to 32% and cut revenue. An option nobody buys can be the most profitable thing on the menu.',
      unit: '% chosen',
      max: 90,
      rows: [
        { l: 'Web only — with decoy', v: 16 },
        { l: 'Print + web — with decoy', v: 84 },
        { l: 'Web only — decoy removed', v: 68 },
        { l: 'Print + web — decoy removed', v: 32 },
      ],
    },
    10: {
      type: 'bars',
      title: 'One campaign, worked through',
      caption:
        '100,000 impressions → 2,000 clicks → 60 signups on $3,000. CPA $50, first-year revenue $10,800, contribution $6,480 → ROMI 116%. And that is year one only, against a 3.5-year CLV.',
      unit: '%',
      max: 120,
      rows: [
        { l: 'CTR', v: 2.0 },
        { l: 'CVR', v: 3.0 },
        { l: 'ROMI', v: 116 },
      ],
    },
    11: {
      type: 'diagram',
      kind: 'brand-pyramid',
      title: 'Keller’s brand resonance pyramid',
      caption:
        'You cannot skip a level. Salience, then performance and imagery, then judgments and feelings, then resonance — loyalty, community, advocacy.',
    },
    12: {
      type: 'diagram',
      kind: 'channel-levels',
      title: 'Channel length',
      caption:
        'Each level adds reach and subtracts margin and control. And intensity must match positioning — luxury sold everywhere stops being luxury.',
    },
  },

  extraFigures: [
    {
      type: 'diagram',
      kind: 'product-life-cycle',
      title: 'The product life cycle',
      caption:
        'The stage dictates the tactic: build awareness in introduction, distribution and line extensions in growth, defend share and cut cost in maturity, harvest or kill in decline. Naming the wrong tactic for the stage is the classic wrong answer.',
    },
    {
      type: 'bars',
      title: 'Bigger samples buy precision, with sharp diminishing returns',
      caption:
        'Read the curve, not the number. 100 → 500 more than halves your error. 1,000 → 2,000 buys under a point for double the money. That trade-off is why research budgets get argued about.',
      unit: '±%',
      max: 10,
      rows: [
        { l: 'n = 100', v: 9.8 },
        { l: 'n = 500', v: 4.4 },
        { l: 'n = 1,000', v: 3.1 },
        { l: 'n = 2,000', v: 2.2 },
      ],
    },
  ],

  examples: [
    {
      tag: '5 C’s',
      t: 'Vanderbilt dining as a marketing problem',
      d: 'Customers: students on a mandatory plan. Collaborators: Rand, Commons, the food trucks. Competitors: not other dining halls — it is Hillsboro Village, DoorDash and skipping lunch. Context: a captive first-year market that ends after one year.',
    },
    {
      tag: '3-V',
      t: 'Why MoviePass died',
      d: 'Customer value enormous, collaborator value real, company value deeply negative. Two out of three is a bankruptcy — the cleanest test to run on any student business idea.',
    },
    {
      tag: 'Distribution & brand',
      t: 'Blockbuster’s late fees',
      d: 'Not a pricing footnote — the single association customers held about the company. A tactic set badly in one box redefined a different box entirely.',
    },
    {
      tag: 'Decoy effect',
      t: 'The Economist’s $125 print-only option',
      d: 'Nobody chose it. Deleting it moved print+web from 84% to 32% and cut revenue. An option nobody buys can be the most profitable thing on the menu.',
    },
    {
      tag: 'CLV',
      t: 'What a streaming subscriber is worth',
      d: '$15/mo × 12 × 60% margin × 3.5 years = $378. That is the ceiling on acquisition spend; at $120 CAC each subscriber nets about $258. Every “is this campaign worth it?” question reduces to this.',
    },
    {
      tag: 'Positioning',
      t: 'Franz boxed wine',
      d: 'Mekanism repositioned a low-status category through voice alone — irreverent, cheap, unembarrassed. No product change. Communication doing the work the perceptual map predicted.',
    },
    {
      tag: '4 A’s',
      t: 'Google Glass',
      d: 'Awareness was enormous and accessibility was fine. It failed acceptability — people did not want to be seen wearing it. Any offer that fails one of the four A’s fails.',
    },
    {
      tag: 'Segmentation',
      t: 'Naming an Opera Philadelphia segment properly',
      d: '“Lapsed single-ticket buyers who came for a festival production” beats “25–44 year-olds” every time. Behaviour and motivation, then show the mix changing for them — that is the 40% rubric line.',
    },
  ],

  podcast: {
    blurb: 'The four frameworks, the formulas and the case playbook — as a conversation.',
    editions: [
      {
        id: 'bus-podcast',
        label: 'Podcast',
        file: '/audio/bus-podcast.mp3',
        len: '30:50',
        seconds: 1850,
        ready: true,
        blurb:
          'Two hosts walking the whole semester — the grade, the four frameworks, all twelve sessions, the case playbook, and a twelve-question self-test with room to answer out loud. Chapter marks are exact.',
        chapters: [
          { t: '0:00', s: 0, name: 'Cold open' },
          { t: '0:35', s: 35, name: 'How the grade actually works' },
          { t: '2:16', s: 136, name: 'The 5 C’s' },
          { t: '3:57', s: 236, name: 'The 3-V principle' },
          { t: '5:05', s: 305, name: 'The seven tactics' },
          { t: '6:28', s: 387, name: 'SWOT' },
          { t: '7:20', s: 440, name: 'Value and customer centricity' },
          { t: '10:08', s: 608, name: 'Marketing research' },
          { t: '13:03', s: 783, name: 'Segmentation, targeting, positioning' },
          { t: '14:56', s: 895, name: 'Consumer behaviour and behavioural economics' },
          { t: '17:28', s: 1048, name: 'Digital marketing and the metrics' },
          { t: '19:30', s: 1170, name: 'Product, brand, price, distribution' },
          { t: '22:52', s: 1372, name: 'The midterm case playbook' },
          { t: '25:52', s: 1551, name: 'Self-test' },
          { t: '30:28', s: 1828, name: 'Close' },
        ],
      },
    ],
  },

  planMinutes: '2 min',
  frameLabel: 'The case write-up, section by section',
};

export default bus;
