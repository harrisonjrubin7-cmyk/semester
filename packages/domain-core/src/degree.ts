// Degree planning scenario. Source: brief "Degree scenario model" and the
// Plan hard boundaries: Semester does not certify degree completion.

export type DegreeScenarioStatus = "draft" | "shared_with_advisor" | "reviewed" | "archived";

export type DegreeScenarioCourse = {
  courseId: string;
  termId?: string;
  source: "institution_verified" | "student_entered";
  scenarioRole: "completed" | "planned" | "considering";
};

export type DegreeScenario = {
  id: string;
  tenantId: string;
  studentId: string;
  status: DegreeScenarioStatus;
  courses: DegreeScenarioCourse[];
  officialDegreeAuditReference?: string;
  disclaimer: { required: true; text: string };
  createdAt: string;
  updatedAt: string;
};

// Returns the reasons a scenario must not be shown or shared. An empty list means valid.
export function validateDegreeScenario(s: DegreeScenario): string[] {
  const errors: string[] = [];
  if (!s.disclaimer || s.disclaimer.required !== true || s.disclaimer.text.trim() === "") {
    errors.push("A planning scenario must carry its disclaimer.");
  }
  for (const course of s.courses) {
    if (course.scenarioRole === "completed" && course.source === "student_entered") {
      // Completed courses are shown as planning input only when the institution confirmed them.
      errors.push(`Course ${course.courseId} is marked completed but was entered by the student.`);
    }
  }
  return errors;
}
