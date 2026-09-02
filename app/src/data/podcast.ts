import type { Chapter, CourseId } from '../lib/types';

export interface Episode {
  id: string;
  /** Shown on the edition switcher — "Condensed", "Full", "Podcast". */
  label: string;
  /** Path under /audio, or '' when the episode is not recorded yet. */
  file: string;
  len: string;
  /** Total running time in seconds, for the progress bar. */
  seconds: number;
  ready: boolean;
  blurb: string;
  chapters: Chapter[];
}

export interface CoursePodcast {
  blurb: string;
  editions: Episode[];
}

/**
 * Chapter marks.
 *
 * The PSCI marks are the published ones from the field guide, and they were
 * confirmed against the recordings themselves — running ffmpeg's silence
 * detector over the condensed edition reproduced all twenty of them to within a
 * second. The CORE marks were recovered the same way, since that episode never
 * shipped a chapter list. The ECON file has no detectable pauses, so its marks
 * are the guide's section order laid over the running time and are approximate.
 */
export const PODCAST: Record<CourseId, CoursePodcast> = {
  econ: {
    blurb: 'The whole guide read aloud, chapter by chapter.',
    editions: [
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
  psci: {
    blurb:
      'Two narrated editions. Every figure is described in words, so you do not need to be looking at anything.',
    editions: [
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
  core: {
    blurb:
      'Weeks 1–4 at listening pace, with every figure described in words — built for the walk to Garland.',
    editions: [
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
  bus: {
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
};
