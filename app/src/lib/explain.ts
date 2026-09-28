/**
 * "About this screen" — the four questions, answered for each screen.
 *
 *   What is this?                        Why does it matter?
 *   Where does this information come from?   What can I do next?
 *
 * The brief asks for contextual help that sits in the same place on every
 * screen (WCAG 2.2's 3.2.6 Consistent Help). `components/unity/ScreenGuide.tsx`
 * is that place; this file is what it says.
 *
 * Written out for the screens a student lands on most. Every other screen
 * gets an answer built from the navigation registry's own one-line blurb —
 * which is the sentence the directory already shows for it — rather than no
 * answer, because help that exists on some screens and not others is exactly
 * the inconsistency the criterion is about.
 */

import { destination } from './nav';
import type { Screen } from './types';

export interface Explained {
  what: string;
  why: string;
  from: string;
  next: string;
}

const WRITTEN: Partial<Record<Screen, Explained>> = {
  home: {
    what: 'Today: what is due, what is on, and the one thing most worth doing next.',
    why: 'It keeps the day finite. You see the few things that matter now rather than everything the app knows.',
    from: 'Your courses’ syllabi, the calendars you connected, and anything you added yourself. Each row can show where it came from.',
    next: 'Start the suggested step, or open any row to see its details and source.',
  },
  courses: {
    what: 'Every course you are taking this term.',
    why: 'Each course holds its deadlines, readings, grading weights and study guide in one place.',
    from: 'Syllabi you imported or added, and the sample semester if you have not replaced it.',
    next: 'Open a course, or add one from a syllabus.',
  },
  course: {
    what: 'One course: its deadlines, readings, weights and materials.',
    why: 'This is where the course’s own rules live — what counts, when, and how much.',
    from: 'The syllabus and course material you gave the app. Nothing here is the registrar’s record.',
    next: 'Open the next deadline, study the current unit, or check where your grade stands.',
  },
  item: {
    what: 'One deadline or piece of work, with everything the course said about it.',
    why: 'Knowing exactly what is asked, and what it is worth, is most of planning it.',
    from: 'The course syllabus or the entry you made. Check the course’s own site for last-minute changes.',
    next: 'Break it into steps, or start working on it.',
  },
  calendar: {
    what: 'Your classes, deadlines and events on one calendar.',
    why: 'Seeing the week at once shows where the pressure is before it arrives.',
    from: 'Class times from your courses, deadlines from syllabi, and any calendars you subscribed to — each labelled by source.',
    next: 'Add an event, or open a day to plan it.',
  },
  study: {
    what: 'The study guides for your courses, and the ways to practise them.',
    why: 'Practising recall beats re-reading, and this is where each course’s practice lives.',
    from: 'Guides built from your course material. Anything drafted with AI is labelled and linked to its sources.',
    next: 'Open a guide and pick a way to study.',
  },
  guide: {
    what: 'A study guide for one course, unit by unit.',
    why: 'It turns the course’s material into things you can practise.',
    from: 'Your course’s readings and slides. AI-assisted material is marked and should be checked against them.',
    next: 'Choose a unit and a way to study it.',
  },
  me: {
    what: 'Your account, your settings, and what the app keeps about you.',
    why: 'It is where you control how the app looks, what it syncs and what it stores.',
    from: 'Your own choices, stored on this device and synced to your account if you signed in.',
    next: 'Change how the app looks, or review your privacy settings.',
  },
  pathway: {
    what: 'Your degree path: requirements, what counts toward them, and what is left.',
    why: 'It shows whether you are on track before registration, not after.',
    from: 'Requirements you entered or imported. It is not your official degree audit — confirm with your advisor.',
    next: 'Check the next unmet requirement and compare the courses that satisfy it.',
  },
  career: {
    what: 'Career planning: applications, opportunities and the skills they ask for.',
    why: 'Deadlines for internships and jobs come early, and this keeps them next to your term.',
    from: 'What you added yourself. Opportunity details should be confirmed with the employer or career office.',
    next: 'Add an application or review what is due soonest.',
  },
  privacy: {
    what: 'What the app stores, where, and who can see it.',
    why: 'You decide what leaves this device.',
    from: 'The app’s own record of what it keeps.',
    next: 'Review what is stored, or export or erase it.',
  },
  help: {
    what: 'The guidebook: how every part of the app works.',
    why: 'Any screen you are unsure about is explained here in plain words.',
    from: 'Written for this app and kept with it.',
    next: 'Search for the screen or action you have a question about.',
  },
};

/** The four answers for a screen — written where they are, built where they are not. */
export function explain(screen: Screen): Explained {
  const written = WRITTEN[screen];
  if (written) return written;
  const d = destination(screen);
  const name = d?.label ?? 'This screen';
  return {
    what: d?.blurb ?? `${name} is one part of your semester.`,
    why: 'It keeps this part of your semester in one place, alongside everything else in the app.',
    from:
      'What you entered or imported, and any connected source. Look for a source label or “Source & details” on a row to see where a particular thing came from.',
    next: 'Use the main action on this screen, or open the guidebook for a walkthrough.',
  };
}

/** Whether a screen has its own answers rather than the built fallback. */
export function explainedByHand(screen: Screen): boolean {
  return screen in WRITTEN;
}
