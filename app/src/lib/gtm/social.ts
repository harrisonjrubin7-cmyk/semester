/**
 * The social media ecosystem (community brief of 29 September 2026): the
 * content pillars, what each platform is for, and the path from a post to a
 * useful action — as data, so a test can hold every step of every path to a
 * page or a screen that exists.
 *
 * The brief's rule is the first export: social media is the public top of
 * the funnel, and Semester is where interest turns into action and
 * belonging. A post that leads nowhere useful is not on the list. The
 * campaign object (`campaign.ts`), consent (`messaging.ts`) and the UTM
 * convention (`utm.ts`) govern any message this plan sends; nothing here
 * sends one.
 *
 * `lib/connectregister.ts` renders this into `docs/SEMESTER-CONNECT-REGISTER.md`.
 */

export const PRINCIPLE = 'Use social media as the public top of the funnel; use Semester as the place where social interest turns into meaningful action and belonging.';

/** What is never used in marketing: the brief's line, and the do-not-build rule 10 it rests on. */
export const NEVER_IN_MARKETING = 'No private student data, grades, plans or messages in marketing without explicit written permission; no ad or tracking SDK in the app; no student data used for ad targeting.';

export interface Pillar {
  id: string;
  pillar: string;
  purpose: string;
  example: string;
}

export const PILLARS: readonly Pillar[] = [
  { id: 'clarity', pillar: 'Student clarity', purpose: 'Show that Semester understands real student friction', example: '“College should not require 20 tabs.”' },
  { id: 'planning', pillar: 'Planning', purpose: 'Give immediate practical value', example: 'Course-planning, registration, deadline and advisor tips' },
  { id: 'study', pillar: 'Study', purpose: 'Demonstrate learning support', example: 'Study workflows, active recall, exam planning, source-aware learning' },
  { id: 'campus', pillar: 'Campus connection', purpose: 'Promote community and opportunities', example: 'Club discovery, events, mentors, support resources' },
  { id: 'career', pillar: 'Career momentum', purpose: 'Connect university life to the future', example: 'Portfolio, internships, networking, resume and career-fair content' },
  { id: 'stories', pillar: 'Student stories', purpose: 'Build trust and emotional relevance', example: 'Ambassador stories, first-year experiences, transfer pathways' },
  { id: 'building', pillar: 'Product building', purpose: 'Attract employees, partners and early adopters', example: 'Feature previews, product principles, behind-the-scenes building' },
  { id: 'institutional', pillar: 'Institutional insight', purpose: 'Attract university leaders', example: 'Fragmentation, accessibility, privacy, student experience, implementation' },
  { id: 'spotlights', pillar: 'Community spotlights', purpose: 'Give others reasons to share', example: 'Clubs, mentors, campus partners, student projects' },
  { id: 'responsible', pillar: 'Responsible technology', purpose: 'Build credibility', example: 'Privacy, source labels, student control, accessible design, AI boundaries' },
];

export interface Platform {
  platform: string;
  role: string;
}

export const PLATFORMS: readonly Platform[] = [
  { platform: 'Instagram', role: 'Visual student-facing identity, short tips, creator stories, carousels, Reels, community spotlights' },
  { platform: 'TikTok', role: 'Practical student content, relatable university problems, short product demos, student ambassador content' },
  { platform: 'LinkedIn', role: 'Institutions, employees, advisors, investors, partnerships, product strategy, hiring, thought leadership' },
  { platform: 'YouTube', role: 'Product walkthroughs, longer student guides, webinars, career workshops, advisor training' },
  { platform: 'Facebook', role: 'Parent and supporter outreach, campus groups, community announcements, events, local partnerships' },
  { platform: 'Email newsletter', role: 'Owned audience for product updates, useful resources, events, student stories and pilot news' },
  { platform: 'In-app community', role: 'Contextual connection, events, groups, mentors, opportunities and collaboration' },
];

/**
 * One step of a path from a post to an action. `site` names a route of the
 * public site, `app` a screen of the app, `social` the post itself, and
 * `account` the moment an account is made (which `/signup/` starts).
 */
export type FunnelStep =
  | { kind: 'social'; what: string }
  | { kind: 'site'; what: string; path: string }
  | { kind: 'account'; what: string; path: '/signup/' }
  | { kind: 'app'; what: string; screen: string };

export interface Funnel {
  id: string;
  steps: readonly FunnelStep[];
}

/** Every post leads to a useful next step, and every step is somewhere real. */
export const FUNNELS: readonly Funnel[] = [
  {
    id: 'registration',
    steps: [
      { kind: 'social', what: 'Instagram Reel about registration' },
      { kind: 'site', what: 'Free registration checklist on the site', path: '/tools/checklist/' },
      { kind: 'account', what: 'Save the checklist to a Semester account', path: '/signup/' },
      { kind: 'app', what: 'Build a term plan', screen: 'courses' },
      { kind: 'site', what: 'Join a registration-prep community event', path: '/community/events/' },
      { kind: 'app', what: 'Bring a Path Snapshot and your questions to your advisor', screen: 'degree' },
    ],
  },
  {
    id: 'institutions',
    steps: [
      { kind: 'social', what: 'LinkedIn post about fragmented student systems' },
      { kind: 'site', what: 'Institution landing page', path: '/institutions/' },
      { kind: 'site', what: 'Product architecture demo', path: '/demo/' },
      { kind: 'site', what: 'Pilot overview', path: '/start/' },
      { kind: 'site', what: 'Schedule a partnership conversation', path: '/contact/' },
    ],
  },
  {
    id: 'study',
    steps: [
      { kind: 'social', what: 'TikTok study tip' },
      { kind: 'site', what: 'Free study-plan template', path: '/resources/' },
      { kind: 'account', what: 'Create an account', path: '/signup/' },
      { kind: 'app', what: 'Save a study session', screen: 'study' },
      { kind: 'app', what: 'Find or create a course study group', screen: 'community' },
    ],
  },
];
