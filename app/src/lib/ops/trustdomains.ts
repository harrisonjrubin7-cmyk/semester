/**
 * What each product domain is required to have before it carries real
 * students: a threat model, a privacy review, an accessibility review, a
 * reliability objective, a support route and an incident playbook — and what
 * it has now.
 *
 * The six columns are the brief's own. The cell for each is one of four
 * standings, deliberately few:
 *
 *   held       a document or register in the tree covers this domain and says
 *              so in terms (the file is named and must exist).
 *   partial    something covers part of the domain, or covers the platform in
 *              general and the domain only by inheritance.
 *   drafted    written in `docs/integrated-trust/` as part of this package and
 *              not yet reviewed by the seat that must own it.
 *   absent     nothing.
 *
 * `drafted` is the standing this package can give and no better: the review
 * that turns a draft into `held` is a person's, and the seat that owns it is
 * named. A reviewed standing needs a file under `docs/evidence/`.
 */

import type { Seat } from '../launchreadiness';
import type { Domain } from './trustcontrols';

export const COLUMNS = ['threat', 'privacy', 'accessibility', 'reliability', 'support', 'incident'] as const;
export type Column = (typeof COLUMNS)[number];

export const COLUMN_TITLE: Record<Column, string> = {
  threat: 'Threat model',
  privacy: 'Privacy review',
  accessibility: 'Accessibility review',
  reliability: 'Reliability objective',
  support: 'Support route',
  incident: 'Incident playbook',
};

export type Standing = 'held' | 'partial' | 'drafted' | 'absent';

export interface Cell {
  standing: Standing;
  /** A file in the tree, or a playbook or journey id, that backs the standing. */
  ref?: string;
  /** What is missing, when the standing is not `held`. */
  note?: string;
}

export interface DomainRequirement {
  domain: Domain;
  /** The seat that reviews the cells and turns a `drafted` into a `held`. */
  reviewer: Seat;
  cells: Record<Column, Cell>;
  /** Playbooks that apply, in IR-nn form. */
  playbooks: readonly string[];
  /** Service-level journeys from `error-budgets.ts` that this domain depends on. */
  journeys: readonly string[];
}

const THREATS = 'docs/integrated-trust/THREAT-MODELS.md';
const A11Y = 'docs/integrated-trust/ACCESSIBILITY-PROGRAM.md';
const SUPPORT = 'docs/integrated-trust/SUPPORT-ROUTES.md';

export const REQUIREMENTS: readonly DomainRequirement[] = [
  {
    domain: 'identity',
    reviewer: 'security',
    playbooks: ['IR-01', 'IR-02', 'IR-14'],
    journeys: ['sign_in'],
    cells: {
      threat: { standing: 'partial', ref: 'docs/SECURITY-THREAT-MODEL.md', note: 'Spoofing rows only; no model of sessions, recovery or multi-factor.' },
      privacy: { standing: 'partial', ref: 'docs/security/ferpa-risk-and-permission-matrix.md', note: 'No assessment of the sign-in record or device list.' },
      accessibility: { standing: 'partial', ref: 'app/src/a11y/axe.test.tsx', note: 'The sign-in screen is in the first-run case; no manual pass.' },
      reliability: { standing: 'held', ref: 'sign_in' },
      support: { standing: 'drafted', ref: SUPPORT, note: 'Recovery has no owner or hours.' },
      incident: { standing: 'drafted', ref: 'IR-02' },
    },
  },
  {
    domain: 'academic',
    reviewer: 'data',
    playbooks: ['IR-01', 'IR-03', 'IR-12'],
    journeys: ['advisor_agenda_save'],
    cells: {
      threat: { standing: 'partial', ref: 'docs/INTEGRATION-THREAT-MODEL.md', note: 'Integration rows T14, T18 and T19 only; no model of the record workflow itself.' },
      privacy: { standing: 'partial', ref: 'docs/trust/FERPA-CONSENT-WORKFLOW.md', note: 'Academic-record-ledger is the one assessed surface.' },
      accessibility: { standing: 'absent', note: 'Registration, Degree and Grades appear in the journey smoke; no manual pass; tables and editors are unaudited.' },
      reliability: { standing: 'held', ref: 'advisor_agenda_save', note: 'No objective for registration, grade display or record export.' },
      support: { standing: 'drafted', ref: SUPPORT },
      incident: { standing: 'drafted', ref: 'IR-03' },
    },
  },
  {
    domain: 'learning',
    reviewer: 'product',
    playbooks: ['IR-04', 'IR-05', 'IR-11'],
    journeys: ['assignment_draft_save'],
    cells: {
      threat: { standing: 'absent', note: 'No model for submissions, gradebook or assessment; most of the learning domain is building.' },
      privacy: { standing: 'absent', note: 'No assessment of submissions or feedback.' },
      accessibility: { standing: 'drafted', ref: A11Y, note: 'Rich-text editors, media and charts are unaudited.' },
      reliability: { standing: 'held', ref: 'assignment_draft_save', note: 'Submission receipt durability has no objective of its own.' },
      support: { standing: 'drafted', ref: SUPPORT },
      incident: { standing: 'drafted', ref: 'IR-11' },
    },
  },
  {
    domain: 'productivity',
    reviewer: 'engineering',
    playbooks: ['IR-06', 'IR-07', 'IR-15'],
    journeys: ['today_load', 'plan_save', 'search'],
    cells: {
      threat: { standing: 'drafted', ref: THREATS, note: 'Uploads and shared documents had no model; drafted here.' },
      privacy: { standing: 'partial', ref: 'app/src/lib/governance/pia.test.ts', note: 'Notes and documents are not an assessed surface.' },
      accessibility: { standing: 'partial', ref: 'app/src/a11y/axe.test.tsx', note: 'Write, Sheet and Deck are outside the axe cases.' },
      reliability: { standing: 'held', ref: 'plan_save' },
      support: { standing: 'drafted', ref: SUPPORT },
      incident: { standing: 'drafted', ref: 'IR-07' },
    },
  },
  {
    domain: 'ai',
    reviewer: 'trust',
    playbooks: ['IR-04'],
    journeys: ['ask_semester'],
    cells: {
      threat: { standing: 'partial', ref: 'docs/ai-toolkit/AI-TOOLKIT-THREAT-MODEL.md', note: 'Covers the client-only toolkit, reviewed by an AI agent; the server function and gateway runtime have rows in the platform model only.' },
      privacy: { standing: 'held', ref: 'docs/trust/AI-RISK-ASSESSMENT.md', note: 'Controlled draft; the ai-conversations surface is assessed; provider terms unsigned.' },
      accessibility: { standing: 'partial', ref: 'app/src/ai/focusbar.test.tsx', note: 'Streaming answers are unaudited for screen readers.' },
      reliability: { standing: 'held', ref: 'ask_semester' },
      support: { standing: 'drafted', ref: SUPPORT, note: 'No report-an-answer flow reaches an owner.' },
      incident: { standing: 'drafted', ref: 'IR-04' },
    },
  },
  {
    domain: 'campus',
    reviewer: 'trust',
    playbooks: ['IR-09', 'IR-11'],
    journeys: [],
    cells: {
      threat: { standing: 'drafted', ref: THREATS, note: 'Community had a privacy and media model but no STRIDE; drafted here.' },
      privacy: { standing: 'held', ref: 'docs/COMMUNITY-PRIVACY-MODEL.md' },
      accessibility: { standing: 'absent', note: 'Maps, directory, events and community are outside every automated case.' },
      reliability: { standing: 'absent', note: 'No objective for campus feeds, freshness or alerts.' },
      support: { standing: 'drafted', ref: SUPPORT },
      incident: { standing: 'drafted', ref: 'IR-09' },
    },
  },
  {
    domain: 'family',
    reviewer: 'privacy',
    playbooks: ['IR-01', 'IR-08', 'IR-12'],
    journeys: [],
    cells: {
      threat: { standing: 'drafted', ref: THREATS, note: 'A data model and a permission matrix existed; no STRIDE; drafted here.' },
      privacy: { standing: 'held', ref: 'docs/security/guardian-data-model.md', note: 'Parental consent has not started counsel review.' },
      accessibility: { standing: 'absent', note: 'No guardian-facing screen exists to test; the share screens have no assistive-technology pass.' },
      reliability: { standing: 'absent', note: 'Revocation must take effect immediately; nothing measures it.' },
      support: { standing: 'drafted', ref: SUPPORT },
      incident: { standing: 'drafted', ref: 'IR-08' },
    },
  },
  {
    domain: 'finance',
    reviewer: 'finance',
    playbooks: ['IR-10', 'IR-03'],
    journeys: [],
    cells: {
      threat: { standing: 'partial', ref: 'docs/SECURITY-THREAT-MODEL.md', note: 'A forged-webhook row and the live-billing acceptance record; no model of the student-account ledger or payment plans.' },
      privacy: { standing: 'held', ref: 'app/src/lib/governance/pia.test.ts', note: 'Billing and student-accounts are assessed; no payment credential is stored.' },
      accessibility: { standing: 'absent', note: 'Bill and Costs use the shared field-error pattern; no pass on payment flows.' },
      reliability: { standing: 'absent', note: 'No objective for billing summary or payment confirmation.' },
      support: { standing: 'drafted', ref: SUPPORT },
      incident: { standing: 'drafted', ref: 'IR-10' },
    },
  },
  {
    domain: 'career',
    reviewer: 'product',
    playbooks: ['IR-13', 'IR-12'],
    journeys: [],
    cells: {
      threat: { standing: 'drafted', ref: THREATS, note: 'No model existed for credentials, portfolios or employer visibility; drafted here.' },
      privacy: { standing: 'absent', note: 'Employer visibility and credential verification have no assessment; minors are kept out in SQL.' },
      accessibility: { standing: 'absent', note: 'Portfolio, Opportunities and Pathway are outside every automated case.' },
      reliability: { standing: 'absent', note: 'No objective for applications or credential display.' },
      support: { standing: 'drafted', ref: SUPPORT },
      incident: { standing: 'drafted', ref: 'IR-13' },
    },
  },
  {
    domain: 'marketplace',
    reviewer: 'trust',
    playbooks: ['IR-13', 'IR-10'],
    journeys: [],
    cells: {
      threat: { standing: 'drafted', ref: THREATS, note: 'No marketplace exists; the model is written so its controls can be required before it is built.' },
      privacy: { standing: 'partial', ref: 'docs/security/ferpa-risk-and-permission-matrix.md', note: 'P2 finding only: no purpose-limited application boundary.' },
      accessibility: { standing: 'absent', note: 'No marketplace screen exists; the opportunity listing screens are outside every automated case.' },
      reliability: { standing: 'absent', note: 'Nothing to measure until orders exist.' },
      support: { standing: 'drafted', ref: SUPPORT },
      incident: { standing: 'drafted', ref: 'IR-13' },
    },
  },
  {
    domain: 'administration',
    reviewer: 'security',
    playbooks: ['IR-01', 'IR-05', 'IR-08'],
    journeys: [],
    cells: {
      threat: { standing: 'partial', ref: 'docs/security/operations-console-access-model.md', note: 'An access model, not a threat model.' },
      privacy: { standing: 'partial', ref: 'docs/security/operations-console-access-model.md', note: 'Staff reads are modelled and logged for reveals; no assessment covers what the console shows by default.' },
      accessibility: { standing: 'absent', note: 'The institution console is outside every automated accessibility case.' },
      reliability: { standing: 'absent', note: 'Integration freshness has targets in prose; no objective is measured.' },
      support: { standing: 'drafted', ref: SUPPORT },
      incident: { standing: 'drafted', ref: 'IR-08' },
    },
  },
  {
    domain: 'safety-support',
    reviewer: 'trust',
    playbooks: ['IR-08', 'IR-09', 'IR-12'],
    journeys: ['privacy_request_intake'],
    cells: {
      threat: { standing: 'drafted', ref: THREATS },
      privacy: { standing: 'held', ref: 'docs/SUPPORT-RELIABILITY-AND-ABUSE-PREVENTION.md' },
      accessibility: { standing: 'absent', note: 'Help and the ticket form have no manual pass.' },
      reliability: { standing: 'held', ref: 'privacy_request_intake', note: 'Intake only; handling a request has no objective because no handling exists.' },
      support: { standing: 'partial', ref: 'docs/SUPPORT-RELIABILITY-AND-ABUSE-PREVENTION.md', note: 'Tickets are behind a flag that is off; no owner or hours.' },
      incident: { standing: 'drafted', ref: 'IR-09' },
    },
  },
  {
    domain: 'mobile-offline',
    reviewer: 'engineering',
    playbooks: ['IR-02', 'IR-07'],
    journeys: ['plan_save'],
    cells: {
      threat: { standing: 'drafted', ref: THREATS, note: 'No mobile threat model existed; the app is a web app and installable PWA, with no native client.' },
      privacy: { standing: 'partial', ref: 'docs/security/ferpa-risk-and-permission-matrix.md', note: 'P1 finding: sensitive browser persistence is not centrally classified or encrypted.' },
      accessibility: { standing: 'absent', note: 'No Dynamic Type, TalkBack or VoiceOver result; touch targets are measured locally only.' },
      reliability: { standing: 'partial', ref: 'docs/OFFLINE-MODE.md', note: 'Sync conflict and queue drain have simulations; no objective.' },
      support: { standing: 'drafted', ref: SUPPORT },
      incident: { standing: 'drafted', ref: 'IR-07' },
    },
  },
];

export const requirement = (domain: Domain): DomainRequirement | undefined => REQUIREMENTS.find((r) => r.domain === domain);

/** Count of cells in each standing, across the whole matrix. */
export function standings(): Record<Standing, number> {
  const out: Record<Standing, number> = { held: 0, partial: 0, drafted: 0, absent: 0 };
  for (const r of REQUIREMENTS) for (const c of COLUMNS) out[r.cells[c].standing] += 1;
  return out;
}
