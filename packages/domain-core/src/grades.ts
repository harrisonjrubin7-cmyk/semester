// Grade release guard. Source: brief "Grade-release guard" and GradeEntry model.
// Semester may stage a grade for release; only an instructor or registrar may
// release it, and only after a human has reviewed any AI contribution.

export type GradeStatus =
  | "draft"
  | "reviewed"
  | "approved_for_release"
  | "submitted_for_sync"
  | "synchronized"
  | "sync_needs_review";

export type AccommodationVisibility =
  | "not_applicable"
  | "shown_to_authorized_grader_only"
  | "withheld";

export type GradeEntry = {
  id: string;
  studentId: string;
  assessmentId: string;
  score?: number;
  feedback?: string;
  status: GradeStatus;
  aiContribution?: {
    used: boolean;
    outputReference?: string;
    reviewedByInstructor: boolean;
    reviewedAt?: string;
  };
  accommodationVisibility: AccommodationVisibility;
  officialRecordReference?: string;
};

export type GradeActor = {
  role: "instructor" | "teaching_assistant" | "registrar";
};

export function canReleaseGrade(entry: GradeEntry, actor: GradeActor): boolean {
  if (entry.status !== "reviewed" && entry.status !== "approved_for_release") {
    return false;
  }
  if (entry.aiContribution?.used && !entry.aiContribution.reviewedByInstructor) {
    return false;
  }
  // A teaching assistant can grade assigned work but cannot release a grade.
  return actor.role === "instructor" || actor.role === "registrar";
}
