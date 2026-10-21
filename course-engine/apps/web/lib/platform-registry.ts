import type { LucideIcon } from "lucide-react";
import {
  BookOpen,
  BriefcaseBusiness,
  Building2,
  GraduationCap,
  HeartHandshake,
  Landmark,
  Network,
  Settings2,
  ShieldCheck,
  Sparkles,
  Users,
  Workflow,
} from "lucide-react";

export type CapabilityState = "live" | "connected" | "foundation";

export type PlatformCapability = {
  name: string;
  description: string;
  state: CapabilityState;
  href?: string;
};

export type PlatformDomain = {
  slug: string;
  name: string;
  audience: string;
  description: string;
  icon: LucideIcon;
  capabilities: PlatformCapability[];
};

export const platformDomains: PlatformDomain[] = [
  {
    slug: "learning",
    name: "Learning",
    audience: "Students and faculty",
    description: "Evidence-linked course work, study tools, assessment, and progress.",
    icon: BookOpen,
    capabilities: [
      { name: "Course engine", description: "Source ingestion, review, calendar, and generated study assets.", state: "live", href: "/" },
      { name: "Course studio", description: "Faculty authoring, assignments, announcements, and grading.", state: "foundation" },
      { name: "Academic intelligence", description: "Degree planning, advising, and risk-aware recommendations.", state: "foundation" },
    ],
  },
  {
    slug: "student-life",
    name: "Student life",
    audience: "Students and families",
    description: "The daily campus layer for schedules, support, housing, meals, and community.",
    icon: GraduationCap,
    capabilities: [
      { name: "Student home", description: "A single view of today, courses, deadlines, and campus activity.", state: "connected" },
      { name: "Campus services", description: "Housing, meals, athletics, support, and opportunities.", state: "foundation" },
      { name: "Family access", description: "Consent-governed information sharing and delegated access.", state: "foundation" },
    ],
  },
  {
    slug: "institution",
    name: "Institution",
    audience: "Registrar, leadership, and staff",
    description: "Governed institutional operations, approvals, records, and service delivery.",
    icon: Building2,
    capabilities: [
      { name: "Institution console", description: "Operational health, approvals, queues, and accountable ownership.", state: "connected" },
      { name: "Registrar workspace", description: "Registration, records, holds, exceptions, and degree progress.", state: "foundation" },
      { name: "Executive OS", description: "Decision trails, initiatives, readiness, and institutional outcomes.", state: "foundation" },
    ],
  },
  {
    slug: "people",
    name: "People",
    audience: "Advisors, faculty, staff, and partners",
    description: "Role-aware workspaces with clear authority, delegation, and support handoffs.",
    icon: Users,
    capabilities: [
      { name: "Role workspaces", description: "Purpose-built surfaces for every participant in the ecosystem.", state: "connected" },
      { name: "Directory", description: "Institution-scoped identity, membership, teams, and relationships.", state: "foundation" },
      { name: "Delegation", description: "Time-bound authority, consent, and auditable acting-on-behalf-of flows.", state: "foundation" },
    ],
  },
  {
    slug: "operations",
    name: "Operations",
    audience: "Support and service owners",
    description: "Queues, incidents, communications, and reliable day-to-day execution.",
    icon: Settings2,
    capabilities: [
      { name: "Operations inbox", description: "Prioritized work, SLA timers, escalation, and resolution history.", state: "connected" },
      { name: "Service health", description: "Dependency health, incidents, maintenance, and support handoffs.", state: "foundation" },
      { name: "Communications", description: "Audience-aware announcements and delivery monitoring.", state: "foundation" },
    ],
  },
  {
    slug: "workflows",
    name: "Workflows",
    audience: "Cross-functional teams",
    description: "Connected actions that move safely between people, systems, and approvals.",
    icon: Workflow,
    capabilities: [
      { name: "Action center", description: "Submit governed institutional commands and trace their durable receipts.", state: "live", href: "/os/workflows/actions" },
      { name: "Workflow router", description: "Policy-aware orchestration across Semester domains.", state: "foundation" },
      { name: "Automation", description: "Scheduled and event-driven work with human checkpoints.", state: "foundation" },
    ],
  },
  {
    slug: "governance",
    name: "Trust and governance",
    audience: "Security, privacy, and compliance",
    description: "Policy, provenance, permissions, risk, and evidence built into every action.",
    icon: ShieldCheck,
    capabilities: [
      { name: "Trust center", description: "Controls, evidence, policies, and transparent system status.", state: "connected" },
      { name: "Permission center", description: "Consent, sessions, delegated access, and revocation.", state: "foundation" },
      { name: "AI governance", description: "Model inventory, evaluation, provenance, and guarded execution.", state: "foundation" },
    ],
  },
  {
    slug: "integrations",
    name: "Integrations",
    audience: "IT and system owners",
    description: "A governed connection layer for LMS, SIS, identity, productivity, and campus systems.",
    icon: Network,
    capabilities: [
      { name: "Connection registry", description: "Provider status, ownership, scopes, and data contracts.", state: "connected" },
      { name: "LMS and SIS gateway", description: "Standards-based exchange with institutional systems of record.", state: "foundation" },
      { name: "Identity and provisioning", description: "SSO, lifecycle, roles, and tenant boundaries.", state: "foundation" },
    ],
  },
  {
    slug: "business",
    name: "Business",
    audience: "Semester company team",
    description: "The internal operating system for launch, partnerships, finance, and company execution.",
    icon: BriefcaseBusiness,
    capabilities: [
      { name: "Company OS", description: "Plans, decisions, initiatives, documents, and operating cadence.", state: "connected" },
      { name: "Partnerships", description: "Institution pipeline, pilots, readiness, and accountable next steps.", state: "foundation" },
      { name: "Finance", description: "Budgets, scenarios, runway, approvals, and source-linked reporting.", state: "foundation" },
    ],
  },
  {
    slug: "ecosystem",
    name: "Ecosystem",
    audience: "Applicants, alumni, employers, and partners",
    description: "External journeys that remain connected to the institution without exposing internal systems.",
    icon: HeartHandshake,
    capabilities: [
      { name: "External portals", description: "Role-specific applicant, alumni, employer, guardian, and partner entry points.", state: "connected" },
      { name: "Career network", description: "Opportunities, employers, outcomes, and lifelong relationships.", state: "foundation" },
      { name: "Campus marketplace", description: "Governed exchange for services, events, and community resources.", state: "foundation" },
    ],
  },
  {
    slug: "intelligence",
    name: "Intelligence",
    audience: "Every authorized role",
    description: "Contextual assistance grounded in sources, permissions, and explainable decisions.",
    icon: Sparkles,
    capabilities: [
      { name: "Semester assistant", description: "Role-aware help that cites sources and respects authority boundaries.", state: "connected" },
      { name: "Knowledge graph", description: "Connected institutional context with provenance and data-zone controls.", state: "foundation" },
      { name: "Evaluation layer", description: "Quality, safety, usefulness, and drift monitoring.", state: "foundation" },
    ],
  },
  {
    slug: "platform",
    name: "Platform",
    audience: "Engineering and platform owners",
    description: "Shared identity, data, events, observability, and delivery infrastructure beneath every domain.",
    icon: Landmark,
    capabilities: [
      { name: "Platform shell", description: "Unified navigation, role context, command surface, and responsive chrome.", state: "live", href: "/os" },
      { name: "Capability registry", description: "Machine-readable ownership, maturity, routes, and dependencies.", state: "live", href: "/os/platform" },
      { name: "Control plane", description: "Tenant configuration, feature gates, policy, and operational controls.", state: "foundation" },
    ],
  },
];

export const capabilityCounts = platformDomains
  .flatMap((domain) => domain.capabilities)
  .reduce(
    (counts, capability) => ({ ...counts, [capability.state]: counts[capability.state] + 1 }),
    { live: 0, connected: 0, foundation: 0 } satisfies Record<CapabilityState, number>,
  );

export function getPlatformDomain(slug: string) {
  return platformDomains.find((domain) => domain.slug === slug);
}
