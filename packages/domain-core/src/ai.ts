// AI answer frame. Source: brief "AI gateway" (AIAnswerFrame and response contract).
// Every answer is labelled AI-assisted, states its limits, and never presents a
// proposed action as done without a human confirming it.

export type AIAnswerFrame = {
  label: "AI-assisted";
  scopeStatement: string;
  answer: string;
  sources: Array<{
    label: string;
    authority: "institution" | "course" | "student" | "public" | "none";
    freshness?: "current" | "stale" | "unknown";
  }>;
  limitations: string[];
  confidence: "high" | "limited" | "needs_review";
  proposedAction?: {
    type: string;
    preview: string;
    requiresHumanConfirmation: true;
  };
  safeHandoff?: { destination: string; reason: string };
};

// Returns the reasons an answer must not be shown as-is. An empty list means valid.
export function validateAnswerFrame(f: AIAnswerFrame): string[] {
  const errors: string[] = [];
  if (f.label !== "AI-assisted") errors.push("Every AI answer must carry the AI-assisted label.");
  if (f.scopeStatement.trim() === "") errors.push("Every AI answer must state its scope.");
  // A blank answer would leave the answer surface empty; it must be an answer or a refusal.
  if (f.answer.trim() === "") errors.push("Every AI answer must carry an answer or a safe refusal.");
  // A limitation that is only whitespace states nothing, so it does not count.
  if (f.limitations.some((l) => l.trim() === "")) {
    errors.push("Every stated limitation must say something.");
  }
  // A source with authority "none" is no source at all, so it needs a stated limitation too.
  // A source with no label has nothing to show, so it does not count either.
  const hasSource = f.sources.some((s) => s.authority !== "none" && s.label.trim() !== "");
  if (!hasSource && f.limitations.every((l) => l.trim() === "")) {
    errors.push("An answer with no sources must state its limitations.");
  }
  // No sources means no source-backed claim, so high confidence is unsupported too.
  if (
    (f.sources.length === 0 || f.sources.some((s) => s.authority === "none")) &&
    f.confidence === "high"
  ) {
    errors.push("An answer without a source for each claim cannot be high confidence.");
  }
  // The student must be shown what a consequential action will do before confirming it.
  if (f.proposedAction && f.proposedAction.preview.trim() === "") {
    errors.push("A proposed action must include a preview of what it will do.");
  }
  // The type says `true`, but a value from JavaScript or an untyped payload may not.
  if (f.proposedAction && f.proposedAction.requiresHumanConfirmation !== true) {
    errors.push("A proposed action must require a human to confirm it.");
  }
  if (f.safeHandoff && (f.safeHandoff.destination.trim() === "" || f.safeHandoff.reason.trim() === "")) {
    errors.push("A safe handoff must name its destination and its reason.");
  }
  return errors;
}
