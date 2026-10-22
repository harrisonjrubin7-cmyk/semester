# Workflow architecture

_Semester design, intelligence, workflow and data system · 2026-10-05 · Source: uploads/expand further on brand identy algorthims workflow.pdf, reconciled with this design system (readme.md, tokens/, components/). Where they differ, this design system wins and the difference is listed._

> Semester should make an institutionally complex world feel personally clear.

## Definition model

```ts
type SemesterWorkflow = {
  id: string; version: number; tenantId: string | null;
  name: string; purpose: string; domain: string; trigger: string;
  actors: string[]; requiredCapabilities: string[];
  inputs: string[]; outputs: string[];
  sourceAuthority: string[]; dataClassification: string[];
  states: string[]; transitions: string[]; approvalRequirements: string[];
  auditEvents: string[]; sla?: string; supportOwner: string;
  rollbackPlan?: string; retentionPolicy?: string;
  accessibilityRequirements: string[]; aiPolicyRequirements?: string[];
  successMetrics: string[];
};
```

## Universal states

Draft → Submitted → Validating → Waiting for information → Waiting for approval → Approved → Executing → Completed · Failed · Escalated · Cancelled → Archived.

Runnable: ui_kits/workflow-runner/ (17 workflows, 319 steps, each through the 14-check control chain).
