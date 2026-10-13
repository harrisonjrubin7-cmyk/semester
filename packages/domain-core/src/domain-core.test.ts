import { describe, expect, it } from "vitest";
import {
  canIssueRefund,
  canReleaseGrade,
  canShowAsOfficial,
  validateAnswerFrame,
  validateDegreeScenario,
  validateStudentAction,
  type AIAnswerFrame,
  type DegreeScenario,
  type GradeEntry,
  type StudentAction,
} from "./index";

const grade = (over: Partial<GradeEntry> = {}): GradeEntry => ({
  id: "g1",
  studentId: "s1",
  assessmentId: "a1",
  status: "reviewed",
  accommodationVisibility: "not_applicable",
  ...over,
});

describe("canReleaseGrade", () => {
  it("lets an instructor or registrar release a reviewed grade", () => {
    expect(canReleaseGrade(grade(), { role: "instructor" })).toBe(true);
    expect(canReleaseGrade(grade(), { role: "registrar" })).toBe(true);
  });

  it("refuses a teaching assistant even on a reviewed grade", () => {
    expect(canReleaseGrade(grade(), { role: "teaching_assistant" })).toBe(false);
  });

  it("refuses a grade that is still a draft or already synchronized", () => {
    expect(canReleaseGrade(grade({ status: "draft" }), { role: "instructor" })).toBe(false);
    expect(canReleaseGrade(grade({ status: "synchronized" }), { role: "instructor" })).toBe(false);
  });

  it("refuses an AI-contributed grade until an instructor has reviewed the AI output", () => {
    const unreviewed = grade({ aiContribution: { used: true, reviewedByInstructor: false } });
    expect(canReleaseGrade(unreviewed, { role: "instructor" })).toBe(false);
    const reviewed = grade({ aiContribution: { used: true, reviewedByInstructor: true } });
    expect(canReleaseGrade(reviewed, { role: "instructor" })).toBe(true);
  });
});

describe("canIssueRefund", () => {
  it("issues a refund only for a settled payment", () => {
    expect(canIssueRefund("settled")).toBe(true);
    for (const state of [
      "created",
      "awaiting_customer_action",
      "authorized",
      "settling",
      "failed",
      "refunding",
      "refunded",
      "disputed",
      "cancelled",
    ] as const) {
      expect(canIssueRefund(state)).toBe(false);
    }
  });
});

describe("source labels", () => {
  it("shows a value as official only when institution-verified and current", () => {
    expect(canShowAsOfficial("institution_verified", "current")).toBe(true);
    expect(canShowAsOfficial("institution_verified", "stale")).toBe(false);
    expect(canShowAsOfficial("connected", "current")).toBe(false);
    expect(canShowAsOfficial("ai_assisted", "current")).toBe(false);
  });
});

const action = (over: Partial<StudentAction> = {}): StudentAction => ({
  id: "act1",
  title: "Review registration readiness",
  whyItAppears: "Your registration check is ready to review.",
  nextStep: "Open the readiness check",
  urgency: "soon",
  source: "institution_verified",
  freshness: "current",
  visibility: "shared_with_student",
  actionType: "review",
  ...over,
});

describe("validateStudentAction", () => {
  it("accepts a complete action", () => {
    expect(validateStudentAction(action())).toEqual([]);
  });

  it("requires an explanation and a next step", () => {
    expect(validateStudentAction(action({ whyItAppears: " " }))).toHaveLength(1);
    expect(validateStudentAction(action({ nextStep: "" }))).toHaveLength(1);
  });

  it("keeps a student-entered task private", () => {
    const shared = action({ source: "student_entered", visibility: "shared_with_student" });
    expect(validateStudentAction(shared)).toHaveLength(1);
    const priv = action({ source: "student_entered", visibility: "private" });
    expect(validateStudentAction(priv)).toEqual([]);
  });
});

const scenario = (over: Partial<DegreeScenario> = {}): DegreeScenario => ({
  id: "d1",
  tenantId: "t1",
  studentId: "s1",
  status: "draft",
  courses: [{ courseId: "BIO101", source: "institution_verified", scenarioRole: "completed" }],
  disclaimer: {
    required: true,
    text: "This is a planning scenario. Your institution determines official degree progress.",
  },
  createdAt: "2026-10-13T00:00:00Z",
  updatedAt: "2026-10-13T00:00:00Z",
  ...over,
});

describe("validateDegreeScenario", () => {
  it("accepts a scenario with its disclaimer", () => {
    expect(validateDegreeScenario(scenario())).toEqual([]);
  });

  it("refuses a scenario whose disclaimer is empty", () => {
    const bad = scenario({ disclaimer: { required: true, text: "  " } });
    expect(validateDegreeScenario(bad)).toHaveLength(1);
  });

  it("refuses a student-entered course marked as completed", () => {
    const bad = scenario({
      courses: [{ courseId: "ART200", source: "student_entered", scenarioRole: "completed" }],
    });
    expect(validateDegreeScenario(bad)).toHaveLength(1);
  });
});

const answer = (over: Partial<AIAnswerFrame> = {}): AIAnswerFrame => ({
  label: "AI-assisted",
  scopeStatement: "Answering from the approved course syllabus only.",
  answer: "The lab report is due Friday.",
  sources: [{ label: "Course syllabus", authority: "course", freshness: "current" }],
  limitations: [],
  confidence: "high",
  ...over,
});

describe("validateAnswerFrame", () => {
  it("accepts a sourced, labelled answer", () => {
    expect(validateAnswerFrame(answer())).toEqual([]);
  });

  it("requires limitations when there is no source", () => {
    expect(validateAnswerFrame(answer({ sources: [], limitations: [] }))).toHaveLength(1);
    expect(validateAnswerFrame(answer({ sources: [], limitations: ["No source found."] }))).toEqual(
      [],
    );
  });

  it("refuses high confidence on an unsourced claim", () => {
    const bad = answer({ sources: [{ label: "Unknown", authority: "none" }], confidence: "high" });
    expect(validateAnswerFrame(bad)).toHaveLength(1);
  });
});
