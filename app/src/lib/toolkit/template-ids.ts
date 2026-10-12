export const TEMPLATE_IDS = [
  "problem_set",
  "essay",
  "lab_report",
  "research_paper",
  "coding_project",
  "design_project",
  "case_analysis",
  "presentation",
  "group_project",
  "exam_preparation",
  "policy_memo",
  "annotated_bibliography",
  "technical_report",
  "office_hours"
] as const;

export type TemplateId = (typeof TEMPLATE_IDS)[number];

const TEMPLATE_ID_SET: ReadonlySet<string> = new Set(TEMPLATE_IDS);

export const isTemplateId = (value: unknown): value is TemplateId =>
  typeof value === 'string' && TEMPLATE_ID_SET.has(value);
