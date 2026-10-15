// Student action center item. Source: brief "Today and Action Center" export type
// StudentAction and ranking constraints.

import type { Freshness, SourceLabel } from "./source.ts";

export type StudentAction = {
  id: string;
  title: string;
  whyItAppears: string;
  nextStep: string;
  urgency: "attention" | "soon" | "when_ready";
  source: SourceLabel;
  freshness: Freshness;
  visibility: "private" | "shared_with_student";
  actionType: "open" | "review" | "handoff" | "external_link";
};

// Returns the reasons an action is incomplete or breaks a ranking constraint.
// An empty list means the action may be shown.
export function validateStudentAction(a: StudentAction): string[] {
  const errors: string[] = [];
  if (a.whyItAppears.trim() === "") errors.push("Every action must explain why it appears.");
  if (a.nextStep.trim() === "") errors.push("Every action must name a safe next step.");
  // Student-entered tasks stay private unless the student chooses to share them.
  if (a.source === "student_entered" && a.visibility !== "private") {
    errors.push("A student-entered task must stay private unless the student shares it.");
  }
  return errors;
}
