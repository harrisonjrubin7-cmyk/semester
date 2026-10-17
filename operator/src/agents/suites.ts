/**
 * The 12-role suite from the Semester agent suite document (§1) and the
 * handoff routes from the runner design (§1). The 33 agents in roster.ts
 * each belong to one suite; a handoff is allowed between two agents when
 * the sender's suite routes to the receiver's suite, or both share a suite.
 */
export interface Suite { key: string; name: string; responsibility: string; routes: string[]; failureMode: string }

export const SUITES: readonly Suite[] = [
  { key: 'coordinator', name: 'Coordinator', responsibility: 'Priorities, dependencies, and delegation', routes: ['product', 'architecture', 'company'], failureMode: 'Unbounded or duplicate delegation' },
  { key: 'product', name: 'Product & Ecosystem', responsibility: 'Requirements and ecosystem coverage', routes: ['architecture', 'frontend', 'backend'], failureMode: 'Invented scope or vague acceptance criteria' },
  { key: 'architecture', name: 'Architecture & Data', responsibility: 'Architecture, contracts, and data design', routes: ['frontend', 'backend', 'integrations'], failureMode: 'Incompatible contracts or unsafe migrations' },
  { key: 'frontend', name: 'UX & Frontend', responsibility: 'UX, screens, components, accessibility', routes: ['backend', 'qa'], failureMode: 'Static UI mistaken for working functionality' },
  { key: 'backend', name: 'Backend & Identity', responsibility: 'APIs, domain rules, identity, authorization', routes: ['integrations', 'qa', 'repair'], failureMode: 'Tenant leakage or incomplete authorization' },
  { key: 'integrations', name: 'Integrations & Automation', responsibility: 'Provider contracts and background automation', routes: ['backend', 'qa'], failureMode: 'Incorrect contracts or repeated side effects' },
  { key: 'qa', name: 'QA & Verification', responsibility: 'Acceptance criteria and independent evidence', routes: ['repair', 'release'], failureMode: 'Unsupported passing claims' },
  { key: 'repair', name: 'Repair & Security', responsibility: 'Defect investigation and security review', routes: ['qa', 'release'], failureMode: 'Speculative or repeated unsuccessful repair' },
  { key: 'release', name: 'Release & Reliability', responsibility: 'Release readiness, incidents, recovery', routes: ['qa', 'capacity', 'company'], failureMode: 'Wrong artifact or premature readiness claims' },
  { key: 'capacity', name: 'Capacity & Analytics', responsibility: 'Performance, analytics, and cost', routes: ['architecture', 'backend'], failureMode: 'Scaling without evidence' },
  { key: 'growth', name: 'Customer & Growth', responsibility: 'Customer experience and growth experiments', routes: ['product', 'company'], failureMode: 'Unsupported claims or unauthorized outreach' },
  { key: 'company', name: 'Company & Knowledge', responsibility: 'Documentation and business coordination', routes: ['coordinator', 'growth'], failureMode: 'Estimates presented as facts' },
];

export function suite(key: string): Suite | undefined { return SUITES.find((item) => item.key === key); }

export function suiteRouteAllowed(sender: string, receiver: string): boolean {
  if (sender === receiver) return true;
  return suite(sender)?.routes.includes(receiver) ?? false;
}
