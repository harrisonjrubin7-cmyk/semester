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
  if (f.sources.length === 0 && f.limitations.length === 0) {
    errors.push("An answer with no sources must state its limitations.");
  }
  if (f.sources.some((s) => s.authority === "none") && f.confidence === "high") {
    errors.push("An answer that cites an unsourced claim cannot be high confidence.");
  }
  return errors;
}
