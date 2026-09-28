/**
 * The Basic-Needs Navigator: a private, nonjudgmental, one-stop resource and
 * action layer — the student experience, the categories, the resource object
 * model, the directory schema, the student filters, the access workflow and
 * the privacy levels — from two documents of 28 September 2026, held to what
 * `support.ts` and `help-routes.ts` already do.
 *
 * `docs/BASIC-NEEDS-NAVIGATOR.md` is rendered from this file by
 * `basicneeds.test.ts`; edit the data, then `npm run registers` from app/.
 *
 * ## What is held to what
 *
 * - Every category the document names is checked against the support
 *   directory: `have` is true only where `support.ts` has an entry that routes
 *   there, and the test reads the directory to confirm it.
 * - Every field of the resource object model names the field of the support
 *   `Entry` or the campus `CampusListing` that carries it, or says none does;
 *   the test holds the named fields to the interfaces.
 * - The privacy rule the document asks for — browsing creates no staff-visible
 *   record — is already a `never` line of the support screen and a
 *   directory-only rule of `help-routes.ts`; the test holds both.
 *
 * The Hope Center describes comprehensive approaches as including central
 * resource hubs, awareness of public benefits and regular assessment of needs;
 * basic needs span more than food and housing — health care, technology,
 * transportation, hygiene and child care. A filterable directory is a content
 * and routing system, not a central database of student hardship.
 */

import { SECTIONS, type Entry } from './support';
import type { OfficeId } from './offices';

export const SOURCES: readonly { path: string; title: string; what: string }[] = [
  {
    path: 'docs/expansion/Transfer-Hub-Career-Safe-AI-and-Basic-Needs.pdf',
    title: 'Tell me more about basic-needs navigators',
    what: 'The student experience, the categories, the resource object model, privacy-preserving intake and the five levels.',
  },
  {
    path: 'docs/expansion/FERPA-Consent-AI-Training-Policy-and-800-1-Checklist.pdf',
    title: 'Build a student support resource navigator: a filterable directory',
    what: 'The directory schema with an example row, the student filters and the six-step access workflow.',
  },
];

export const PROMISE = 'A student should never have to trade privacy for help, and an institution should never have to trade safety for usefulness.';

/** What a student does, in order. */
export const EXPERIENCE: readonly string[] = [
  '“I need help with…” — choose a category or type a plain-language request',
  'See institution-verified options first',
  'See eligibility, cost, hours, location, language, accessibility and documents',
  'Start a private checklist',
  'Book, or hand off to the official service',
  'Save, return, or ask for a human navigator',
  'Report outdated information',
];

// ── Categories, against the support directory ────────────────────────────────

export interface Category {
  name: string;
  /** The office ids in `offices.ts` an entry for it would route to. Empty when none fits. */
  offices: readonly OfficeId[];
}

export const CATEGORIES: readonly Category[] = [
  { name: 'Food and nutrition', offices: ['basicneeds', 'dining'] },
  { name: 'Housing and housing instability', offices: ['basicneeds', 'housing'] },
  { name: 'Emergency financial support', offices: ['deanofstudents', 'financialaid'] },
  { name: 'Technology, internet and device access', offices: [] },
  { name: 'Transportation and parking or transit', offices: ['transit'] },
  { name: 'Health-care and insurance navigation', offices: ['health'] },
  { name: 'Mental-health and wellness resource routing', offices: ['counseling', 'care'] },
  { name: 'Childcare and family support', offices: ['basicneeds'] },
  { name: 'Personal hygiene and clothing', offices: [] },
  { name: 'Legal aid or advocacy, where institutionally offered', offices: ['deanofstudents'] },
  { name: 'Safety and emergency information', offices: ['safety'] },
  { name: 'Financial aid and student-account services', offices: ['financialaid', 'bursar'] },
  { name: 'Employment and work-study', offices: ['career', 'financialaid'] },
  { name: 'Disability and accessibility services', offices: ['access'] },
  { name: 'International-student services', offices: ['international'] },
  { name: 'Veteran and military-connected services', offices: [] },
  { name: 'Community and public-benefits referrals', offices: [] },
];

/** Every entry of the support directory, flattened. */
export const entries = (): Entry[] => SECTIONS.flatMap((s) => s.groups.flatMap((g) => g.entries));

/** Whether the support directory already routes somewhere for a category. */
export const covered = (c: Category): boolean => c.offices.length > 0 && entries().some((e) => e.office && c.offices.includes(e.office));

// ── The resource object model, against the app's own fields ─────────────────

export interface Field {
  field: string;
  /** Which existing type carries it, or null. */
  carriedBy: { of: 'Entry' | 'CampusListing'; field: string } | null;
  note: string;
}

/** Every resource needs an accountable owner and freshness controls. */
export const RESOURCE_MODEL: readonly Field[] = [
  { field: 'Resource name', carriedBy: { of: 'Entry', field: 'title' }, note: 'What the student reads.' },
  { field: 'Institution, partner or official status', carriedBy: { of: 'Entry', field: 'studentRun' }, note: 'Only “student-run” is distinguished; institution, verified partner and public benefit are not.' },
  { field: 'Owner office or verified provider', carriedBy: { of: 'Entry', field: 'office' }, note: 'An office id with what it decides; no verified community provider can be an owner.' },
  { field: 'Who it is for and eligibility', carriedBy: null, note: 'Not on an entry. Office actions carry eligibility the student chose; resources do not.' },
  { field: 'What it provides', carriedBy: { of: 'Entry', field: 'what' }, note: 'One sentence.' },
  { field: 'Cost and payment details', carriedBy: null, note: 'Nothing says whether a resource is free.' },
  { field: 'Hours, locations, remote options', carriedBy: { of: 'CampusListing', field: 'details' }, note: 'Only where a school imported its directory; the shipped entries have no hours.' },
  { field: 'Languages and accessibility features', carriedBy: null, note: 'Nothing on either type.' },
  { field: 'Required documents', carriedBy: null, note: 'Nothing on either type.' },
  { field: 'Application, appointment or official handoff link', carriedBy: { of: 'CampusListing', field: 'url' }, note: 'The office link resolves through officeUrl(), which returns nothing rather than guess.' },
  { field: 'Emergency or non-emergency label', carriedBy: { of: 'Entry', field: 'call' }, note: 'The three national lines carry a number; the section says it is not an emergency service.' },
  { field: 'Last reviewed date', carriedBy: { of: 'CampusListing', field: 'starts' }, note: 'A directory carries one `updated` stamp for the whole import, not one per resource; an entry has none.' },
  { field: 'Expiry or review date', carriedBy: null, note: 'Nothing expires a resource.' },
  { field: 'Feedback and broken-link route', carriedBy: null, note: '“This source is out of date” under About this screen is a report about a screen, not a queue per resource.' },
  { field: 'Privacy note', carriedBy: { of: 'Entry', field: 'privacy' }, note: 'Confidential, private, reports or public, drawn before the link.' },
];

/** The directory schema’s example row, as the document gives it. */
export const EXAMPLE: readonly { field: string; example: string }[] = [
  { field: 'Resource name', example: 'Emergency grocery support' },
  { field: 'Category', example: 'Food and nutrition' },
  { field: 'Provider type', example: 'Institution office / verified community partner / public benefit' },
  { field: 'Owner', example: 'Basic Needs Center' },
  { field: 'Status', example: 'Institution verified' },
  { field: 'Eligibility', example: 'Currently enrolled students; check current policy' },
  { field: 'Documentation', example: 'Student ID; appointment may be required' },
  { field: 'Cost', example: 'Free' },
  { field: 'Access type', example: 'Walk-in, appointment, online request' },
  { field: 'Location / service area', example: 'Student Union, Room 120 / remote option' },
  { field: 'Hours', example: 'Mon–Fri, 9 AM–5 PM' },
  { field: 'Languages', example: 'English, Spanish, interpretation available' },
  { field: 'Accessibility', example: 'Step-free entrance; remote intake option' },
  { field: 'Privacy note', example: 'Browsing does not notify staff; a referral shares only selected details' },
  { field: 'Emergency note', example: 'Not an emergency service; use the official emergency route for immediate danger' },
  { field: 'Official source URL', example: 'Institution resource page' },
  { field: 'Last reviewed', example: '2026-09-15' },
  { field: 'Review due', example: '2026-12-15' },
  { field: 'Content owner', example: 'Named office or role' },
  { field: 'Report issue', example: 'Broken-link or outdated-information form' },
];

export const FILTERS: readonly string[] = [
  'Need category',
  'Urgency: today, this week, planning ahead',
  'Eligibility group, only if voluntarily selected',
  'Cost: free, low cost, insurance accepted',
  'Location and transit access',
  'Remote or hybrid availability',
  'Hours: evening, weekend, open now',
  'Language',
  'Accessibility features',
  'Appointment needed',
  'Documentation required',
  'Institutional or community provider',
];

/** The six-step access workflow, and the privacy each step keeps. */
export const WORKFLOW: readonly { step: string; keeps: string }[] = [
  { step: 'Browse', keeps: 'No login, or no staff-visible record, where feasible.' },
  { step: 'Save', keeps: 'A private student bookmark or checklist; no staff notification.' },
  { step: 'Prepare', keeps: 'The student sees documents, eligibility, hours, questions and the official link.' },
  { step: 'Request', keeps: 'The student explicitly selects a named recipient and shares only required fields.' },
  { step: 'Refer', keeps: 'The receiving office accepts or declines the assignment and updates a limited referral status.' },
  { step: 'Close', keeps: 'The student receives outcome options; sensitive details remain in the official service system, not the general Semester platform.' },
];

/** Default to resource discovery without personal disclosure; collect only what the designated owner needs. */
export const LEVELS: readonly { level: number; what: string }[] = [
  { level: 0, what: 'Browse anonymously where permitted.' },
  { level: 1, what: 'Save a private resource or checklist.' },
  { level: 2, what: 'Request an appointment or referral with the minimum necessary information.' },
  { level: 3, what: 'Consent to share a defined request with a named office.' },
  { level: 4, what: 'Follow the official office workflow outside Semester if sensitive intake is required.' },
];

export const NEVER =
  'Do not automatically notify an advisor, parent, faculty member, employer, club leader or institution simply because a student browsed a basic-needs resource.';

/** The line of the support screen that already says it. */
export const NEVER_LINE_IN_APP = 'Nobody is told that you opened this page.';
