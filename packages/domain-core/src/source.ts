// Source and freshness labels. Source: brief "Shipping rules" and StudentAction.
// "institution_verified" is only for authority-confirmed information, and stale
// data is never shown as current.

export type SourceLabel =
  | "institution_verified"
  | "connected"
  | "student_entered"
  | "estimated"
  | "ai_assisted";

export type Freshness = "current" | "updating" | "stale" | "unknown";

export const SOURCE_LABEL_WORDS: Record<SourceLabel, string> = {
  institution_verified: "Official",
  connected: "Connected",
  student_entered: "You entered this",
  estimated: "Estimated",
  ai_assisted: "AI-assisted",
};

export function canShowAsOfficial(label: SourceLabel, freshness: Freshness): boolean {
  return label === "institution_verified" && freshness === "current";
}
