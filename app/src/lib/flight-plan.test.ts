import { describe, expect, it } from "vitest";
import {
  createWorkspace,
  updateTask,
  buildPlan,
  answerConcept,
  restoreWorkspace,
} from "./flight-plan";
import * as flightPlan from "./flight-plan";

describe("Student Flight Plan", () => {
  it("supports every institutional preview role without an unsafe adapter", () => {
    expect(flightPlan.ROLES).toEqual(expect.arrayContaining([
      "student", "faculty", "teaching_assistant", "advisor", "campus_staff",
      "university_admin", "moderator", "employer", "applicant",
      "authorized_payer", "authorized_family", "alumni",
    ]));
  });
  it("holds uncertain work out of the plan until the student confirms its source", () => {
    const state = createWorkspace("northstar", "student");
    const uncertain = state.tasks.find((task) => !task.confirmed)!;
    expect(
      buildPlan(state).sessions.some((item) => item.taskId === uncertain.id),
    ).toBe(false);
    const next = updateTask(state, uncertain.id, "confirm");
    expect(
      buildPlan(next).sessions.some((item) => item.taskId === uncertain.id),
    ).toBe(true);
    expect(next.audit.at(-1)?.action).toContain("Confirmed");
  });
  it("never allocates more time than the available weekly capacity and exposes overflow", () => {
    const state = createWorkspace("northstar", "student");
    const plan = buildPlan({ ...state, availableHours: 1 });
    expect(
      plan.sessions.reduce((sum, session) => sum + session.minutes, 0),
    ).toBeLessThanOrEqual(60);
    expect(plan.unscheduledMinutes).toBeGreaterThan(0);
    expect(buildPlan({ ...state, availableHours: NaN }).sessions).toHaveLength(
      0,
    );
  });
  it("rejects actions from another tenant and preserves the original record", () => {
    const state = createWorkspace("northstar", "student");
    expect(updateTask(state, "cedar-coast-research", "complete")).toEqual(
      state,
    );
    expect(
      restoreWorkspace(JSON.stringify(state), "cedar-coast", "student"),
    ).toBeNull();
    expect(
      restoreWorkspace(JSON.stringify(state), "northstar", "faculty"),
    ).toBeNull();
  });
  it("requires a recovery choice before scheduling missed work", () => {
    const state = createWorkspace("northstar", "student");
    const missed = state.tasks.find((task) => task.status === "missed")!;
    expect(
      buildPlan(state).sessions.some((item) => item.taskId === missed.id),
    ).toBe(false);
    const recovered = updateTask(state, missed.id, "reschedule");
    expect(
      buildPlan(recovered).sessions.some((item) => item.taskId === missed.id),
    ).toBe(true);
    expect(recovered.audit.at(-1)?.action).toContain("Rescheduled");
  });
  it("does not turn a repeated answer into repeated mastery evidence", () => {
    const state = createWorkspace("northstar", "student");
    const once = answerConcept(state, "evidence", true);
    expect(once.mastery.evidence).toBe(1);
    expect(answerConcept(once, "evidence", true).mastery.evidence).toBe(1);
    expect(answerConcept(state, "made-up-concept", true)).toEqual(state);
  });
  it("rejects malformed and tampered backups", () => {
    expect(restoreWorkspace("{bad", "northstar", "student")).toBeNull();
    const state = createWorkspace("northstar", "student");
    expect(
      restoreWorkspace(
        JSON.stringify({ ...state, availableHours: -20 }),
        "northstar",
        "student",
      ),
    ).toBeNull();
    expect(
      restoreWorkspace(
        JSON.stringify({ ...state, tasks: [{ id: "foreign" }] }),
        "northstar",
        "student",
      ),
    ).toBeNull();
    expect(
      restoreWorkspace(JSON.stringify(state), "northstar", "student")?.tenant,
    ).toBe("northstar");
  });
  it("preserves source deadlines when recovering work and gates completion on verification", () => {
    const state = createWorkspace("northstar", "student");
    const missed = state.tasks.find((task) => task.status === "missed")!;
    missed.dueDay = 4;
    expect(
      updateTask(state, missed.id, "reschedule").tasks.find(
        (task) => task.id === missed.id,
      )?.dueDay,
    ).toBe(missed.dueDay);
    const uncertain = state.tasks.find((task) => !task.confirmed)!;
    expect(updateTask(state, uncertain.id, "complete")).toEqual(state);
  });
  it("rejects backups with invented learning evidence", () => {
    const state = createWorkspace("northstar", "student");
    expect(
      restoreWorkspace(
        JSON.stringify({ ...state, mastery: { evidence: 1 } }),
        "northstar",
        "student",
      ),
    ).toBeNull();
  });
  it("rejects a backup that changes a source deadline while keeping its citation", () => {
    const state = createWorkspace("northstar", "student");
    state.tasks[0].dueDay = 365;
    expect(
      restoreWorkspace(JSON.stringify(state), "northstar", "student"),
    ).toBeNull();
  });
  it("keeps draft identities unique when the activity log reaches its limit", () => {
    let state = createWorkspace("northstar", "student");
    for (let index = 0; index < 110; index++)
      state = updateTask(state, "northstar-reading", "help");
    expect(new Set(state.messages.map((message) => message.id)).size).toBe(
      state.messages.length,
    );
  });
  it("rejects restoration of a required task as dropped or unverified work as completed", () => {
    const state = createWorkspace("northstar", "student");
    state.tasks[0].status = "dropped";
    expect(
      restoreWorkspace(JSON.stringify(state), "northstar", "student"),
    ).toBeNull();
    state.tasks[0].status = "open";
    state.tasks[1].status = "done";
    expect(
      restoreWorkspace(JSON.stringify(state), "northstar", "student"),
    ).toBeNull();
  });

  it("ranks recovery before source confirmation and planned study", () => {
    const api = flightPlan as typeof flightPlan & {
      nextFlightAction: (state: ReturnType<typeof createWorkspace>) => {
        kind: string;
        taskId: string;
      };
    };
    expect(typeof api.nextFlightAction).toBe("function");

    const state = createWorkspace("northstar", "student");
    expect(api.nextFlightAction(state)).toEqual({
      kind: "recover",
      taskId: "northstar-reading",
    });

    const recovered = updateTask(state, "northstar-reading", "reschedule");
    expect(api.nextFlightAction(recovered)).toEqual({
      kind: "confirm-source",
      taskId: "northstar-reflection",
    });
  });

  it("uses a stable task id tie-breaker when two confirmed tasks have the same due day", () => {
    const state = createWorkspace("northstar", "student");
    const research = state.tasks.find(
      (task) => task.id === "northstar-research",
    )!;
    const project = state.tasks.find(
      (task) => task.id === "northstar-project",
    )!;
    research.dueDay = 2;
    project.dueDay = 2;
    state.tasks = [
      research,
      project,
      ...state.tasks.filter((task) => task !== project && task !== research),
    ];

    expect(buildPlan(state).sessions[0].taskId).toBe("northstar-project");
  });

  it("returns a new workspace for recovery without changing the source workspace", () => {
    const state = createWorkspace("northstar", "student");
    const before = structuredClone(state);
    const recovered = updateTask(state, "northstar-reading", "reduce");

    expect(state).toEqual(before);
    expect(recovered).not.toBe(state);
    expect(
      recovered.tasks.find((task) => task.id === "northstar-reading")?.minutes,
    ).toBe(23);
    expect(
      recovered.tasks.find((task) => task.id === "northstar-reading")?.dueDay,
    ).toBe(1);
  });
});
