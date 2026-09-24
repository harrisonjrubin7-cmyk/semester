export const TENANTS = {
  northstar: {
    name: "Northstar University",
    initials: "NU",
    course: "Foundations of Inquiry",
    seminar: "Community & Society",
    color: "#235d50",
  },
  "cedar-coast": {
    name: "Cedar Coast College",
    initials: "CC",
    course: "Coastal Systems",
    seminar: "People & Place",
    color: "#285a83",
  },
} as const;
export type TenantId = keyof typeof TENANTS;
export const ROLES = [
  "student",
  "faculty",
  "teaching_assistant",
  "advisor",
  "campus_staff",
  "university_admin",
  "moderator",
  "employer",
  "applicant",
  "authorized_payer",
  "authorized_family",
  "alumni",
] as const;
export type FlightRole = (typeof ROLES)[number];
export const ROLE_NAMES: Record<FlightRole, string> = {
  student: "Student",
  faculty: "Faculty",
  teaching_assistant: "Teaching assistant",
  advisor: "Advisor",
  campus_staff: "Student success",
  university_admin: "Administrator",
  moderator: "Moderator",
  employer: "Employer",
  applicant: "Applicant",
  authorized_payer: "Authorized payer",
  authorized_family: "Authorized family",
  alumni: "Alumni",
};
export type TaskAction =
  "confirm" | "complete" | "reschedule" | "reduce" | "help" | "office" | "drop";
export type NextFlightAction =
  | { kind: "recover"; taskId: string }
  | { kind: "confirm-source"; taskId: string }
  | { kind: "study"; taskId: string }
  | { kind: "complete"; taskId: "" };
export interface FlightTask {
  id: string;
  title: string;
  course: string;
  minutes: number;
  dueDay: number;
  confirmed: boolean;
  status: "open" | "missed" | "done" | "dropped";
  source: string;
  sourceText: string;
  conflict?: string;
}
export interface FlightWorkspace {
  version: 1;
  tenant: TenantId;
  role: FlightRole;
  availableHours: number;
  tasks: FlightTask[];
  mastery: Record<string, number>;
  attempts: Record<string, boolean>;
  saved: string[];
  audit: { action: string; at: string }[];
  messages: {
    id: string;
    subject: string;
    body: string;
    read: boolean;
    draft: boolean;
  }[];
  cases: {
    id: string;
    title: string;
    consent: boolean;
    resolved: boolean;
    note: string;
  }[];
}
export const CONCEPTS = [
  {
    id: "evidence",
    name: "Evaluate evidence",
    prerequisite: "Identify a claim",
    question: "Which source best supports a claim about student study habits?",
    choices: [
      "A representative survey with a documented method",
      "A single anonymous comment",
      "A headline without a source",
    ],
    correct: 0,
    hint: "Consider whose experiences are represented and whether another researcher could repeat the method.",
    explanation:
      "A representative sample and transparent method make the evidence more useful. They still do not prove causation.",
    source: "Synthetic course reader · Chapter 2, Evidence and sampling",
  },
  {
    id: "causation",
    name: "Reason about causation",
    prerequisite: "Evaluate evidence",
    question:
      "Students who study longer have higher grades. What can we conclude?",
    choices: [
      "More study time always causes a higher grade",
      "The variables are associated; other explanations must be considered",
      "Study time has no relationship to grades",
    ],
    correct: 1,
    hint: "Could preparation, resources, or motivation affect both variables?",
    explanation:
      "An association alone does not establish causation. Consider confounders and study design before making a causal claim.",
    source: "Synthetic course reader · Chapter 3, Causal reasoning",
  },
  {
    id: "synthesis",
    name: "Synthesize an argument",
    prerequisite: "Reason about causation",
    question: "What makes a synthesis stronger than a summary?",
    choices: [
      "Repeating each source in order",
      "Removing all disagreement",
      "Explaining how sources agree, differ, and support a reasoned claim",
    ],
    correct: 2,
    hint: "Look for relationships between sources, not just what each says.",
    explanation:
      "Synthesis connects evidence across sources while explaining limitations and disagreements.",
    source: "Synthetic assessment rubric · Criterion 2, Synthesis",
  },
] as const;

export function createWorkspace(
  tenant: TenantId,
  role: FlightRole,
): FlightWorkspace {
  const school = TENANTS[tenant];
  return {
    version: 1,
    tenant,
    role,
    availableHours: 8,
    mastery: {},
    attempts: {},
    saved: [],
    audit: [],
    tasks: [
      {
        id: `${tenant}-research`,
        title: "Research brief",
        course: school.course,
        minutes: 120,
        dueDay: 2,
        confirmed: true,
        status: "open",
        source: "Sample LMS · Assignment 03",
        sourceText:
          "Submit a 900-word brief on Friday of the demonstration week. Include two cited sources.",
      },
      {
        id: `${tenant}-reflection`,
        title: "Seminar reflection",
        course: school.seminar,
        minutes: 60,
        dueDay: 3,
        confirmed: false,
        status: "open",
        source: "Sample syllabus · Page 4",
        sourceText: "Reflection due Saturday, 5 pm.",
        conflict:
          "The sample LMS says Sunday, 5 pm. Confirm the syllabus date before planning.",
      },
      {
        id: `${tenant}-reading`,
        title: "Evidence & sampling practice",
        course: school.course,
        minutes: 45,
        dueDay: 1,
        confirmed: true,
        status: "missed",
        source: "Sample course reader · Chapter 2",
        sourceText:
          "Read the sampling section and answer the three practice questions before seminar.",
      },
      {
        id: `${tenant}-project`,
        title: "Community project outline",
        course: school.seminar,
        minutes: 180,
        dueDay: 5,
        confirmed: true,
        status: "open",
        source: "Sample LMS · Project milestone",
        sourceText:
          "Prepare a project question, stakeholder map, and source list for Monday.",
      },
    ],
    messages: [
      {
        id: `${tenant}-welcome`,
        subject: `Welcome to ${school.name}`,
        body: `Your ${school.course} workspace is ready to explore. These are sample messages, not a connected mailbox.`,
        read: false,
        draft: false,
      },
      {
        id: `${tenant}-advising`,
        subject: "Prepare for your advising conversation",
        body: "Bring your course plan and one question about your workload. No appointment has been booked.",
        read: false,
        draft: false,
      },
    ],
    cases: [
      {
        id: `${tenant}-case-a`,
        title: "Sample student A · workload review",
        consent: true,
        resolved: false,
        note: "",
      },
      {
        id: `${tenant}-case-b`,
        title: "Sample student B · outreach consent required",
        consent: false,
        resolved: false,
        note: "",
      },
    ],
  };
}

export function logAction(
  state: FlightWorkspace,
  action: string,
): FlightWorkspace {
  return {
    ...state,
    audit: [...state.audit, { action, at: new Date().toISOString() }].slice(
      -100,
    ),
  };
}

export function updateTask(
  state: FlightWorkspace,
  id: string,
  action: TaskAction,
): FlightWorkspace {
  if (state.role !== "student") return state;
  const task = state.tasks.find((item) => item.id === id);
  if (!task || !id.startsWith(`${state.tenant}-`)) return state;
  if (action === "complete" && !task.confirmed) return state;
  const copy = { ...task };
  const labels: Record<TaskAction, string> = {
    confirm: "Confirmed syllabus date for",
    complete: "Completed",
    reschedule: "Rescheduled missed work:",
    reduce: "Reduced personal work estimate for",
    help: "Drafted help request for",
    office: "Added office-hours preparation for",
    drop: "Removed optional practice from plan:",
  };
  if (action === "confirm") copy.confirmed = true;
  if (action === "complete") copy.status = "done";
  if (action === "reschedule") {
    copy.status = "open";
  }
  if (action === "reduce") {
    copy.minutes = Math.max(15, Math.ceil(copy.minutes / 2));
    copy.status = "open";
  }
  if (action === "drop") {
    if (!id.endsWith("-reading")) return state;
    copy.status = "dropped";
  }
  let next = {
    ...state,
    tasks: state.tasks.map((item) => (item.id === id ? copy : item)),
  };
  if (action === "help" || action === "office")
    next = {
      ...next,
      messages: [
        ...next.messages,
        {
          id: `${id}-${action}-${state.messages.length}-${state.audit.length}`,
          subject:
            action === "help"
              ? `Help with ${task.title}`
              : `Office-hours preparation: ${task.title}`,
          body: `I am working on ${task.title} in ${task.course}. I would like help identifying the next useful step. Could we discuss an appropriate plan?`,
          read: true,
          draft: true,
        },
      ],
    };
  return logAction(next, `${labels[action]} ${task.title}`);
}

export function buildPlan(state: FlightWorkspace) {
  let capacity = Number.isFinite(state.availableHours)
    ? Math.max(0, Math.min(40, state.availableHours)) * 60
    : 0;
  const tasks = state.tasks
    .filter((task) => task.confirmed && task.status === "open")
    .sort((a, b) => a.dueDay - b.dueDay || a.id.localeCompare(b.id));
  const sessions: {
    taskId: string;
    title: string;
    minutes: number;
    day: number;
    reason: string;
  }[] = [];
  let unscheduledMinutes = 0;
  let slot = 0;
  for (const task of tasks) {
    let remaining = task.minutes;
    while (remaining > 0 && capacity > 0) {
      const minutes = Math.min(45, remaining, capacity);
      sessions.push({
        taskId: task.id,
        title: task.title,
        minutes,
        day: Math.min(Math.floor(slot / 2), Math.max(0, task.dueDay - 1)),
        reason: `Confirmed source; due in ${task.dueDay} day${task.dueDay === 1 ? "" : "s"}. Split into focused sessions within your weekly capacity.`,
      });
      remaining -= minutes;
      capacity -= minutes;
      slot++;
    }
    unscheduledMinutes += remaining;
  }
  return { sessions, unscheduledMinutes, remainingMinutes: capacity };
}

export function nextFlightAction(state: FlightWorkspace): NextFlightAction {
  const ranked = (tasks: FlightTask[]) =>
    [...tasks].sort((a, b) => a.dueDay - b.dueDay || a.id.localeCompare(b.id));
  const missed = ranked(
    state.tasks.filter((task) => task.status === "missed"),
  )[0];
  if (missed) return { kind: "recover", taskId: missed.id };
  const uncertain = ranked(
    state.tasks.filter((task) => task.status === "open" && !task.confirmed),
  )[0];
  if (uncertain) return { kind: "confirm-source", taskId: uncertain.id };
  const session = buildPlan(state).sessions[0];
  if (session) return { kind: "study", taskId: session.taskId };
  return { kind: "complete", taskId: "" };
}

export function answerConcept(
  state: FlightWorkspace,
  id: string,
  correct: boolean,
): FlightWorkspace {
  if (
    state.role !== "student" ||
    !CONCEPTS.some((concept) => concept.id === id) ||
    id in state.attempts
  )
    return state;
  return logAction(
    {
      ...state,
      attempts: { ...state.attempts, [id]: correct },
      mastery: { ...state.mastery, [id]: correct ? 1 : 0 },
    },
    `Practice evidence recorded: ${id} — ${correct ? "correct" : "review needed"}`,
  );
}

export function restoreWorkspace(
  raw: string,
  tenant: TenantId,
  role: FlightRole,
): FlightWorkspace | null {
  try {
    if (raw.length > 1_000_000) return null;
    const value = JSON.parse(raw) as FlightWorkspace;
    const expected = createWorkspace(tenant, role);
    if (
      !value ||
      value.version !== 1 ||
      value.tenant !== tenant ||
      value.role !== role ||
      !Number.isFinite(value.availableHours) ||
      value.availableHours < 0 ||
      value.availableHours > 40
    )
      return null;
    if (
      !Array.isArray(value.tasks) ||
      value.tasks.length !== expected.tasks.length
    )
      return null;
    if (
      new Set(value.tasks.map((task) => task.id)).size !== expected.tasks.length
    )
      return null;
    for (const task of value.tasks) {
      const source = expected.tasks.find(
        (candidate) => candidate.id === task.id,
      );
      if (
        !source ||
        task.title !== source.title ||
        task.course !== source.course ||
        task.source !== source.source ||
        task.sourceText !== source.sourceText ||
        task.dueDay !== source.dueDay ||
        task.conflict !== source.conflict ||
        !Number.isFinite(task.minutes) ||
        task.minutes < 15 ||
        task.minutes > 600 ||
        !Number.isInteger(task.dueDay) ||
        task.dueDay < 0 ||
        task.dueDay > 365 ||
        typeof task.confirmed !== "boolean" ||
        !["open", "missed", "done", "dropped"].includes(task.status)
      )
        return null;
      if (
        (task.status === "dropped" && !task.id.endsWith("-reading")) ||
        (task.status === "done" && !task.confirmed)
      )
        return null;
    }
    if (
      !value.mastery ||
      !value.attempts ||
      Object.entries(value.mastery).some(
        ([key, n]) =>
          !CONCEPTS.some((c) => c.id === key) || ![0, 1].includes(n),
      ) ||
      Object.entries(value.attempts).some(
        ([key, yes]) =>
          !CONCEPTS.some((c) => c.id === key) || typeof yes !== "boolean",
      )
    )
      return null;
    if (
      !Array.isArray(value.audit) ||
      value.audit.length > 100 ||
      value.audit.some(
        (item) =>
          typeof item.action !== "string" || typeof item.at !== "string",
      )
    )
      return null;
    if (
      !Array.isArray(value.saved) ||
      value.saved.some(
        (id) => typeof id !== "string" || !id.startsWith(`${tenant}-`),
      )
    )
      return null;
    if (
      !Array.isArray(value.messages) ||
      value.messages.length > 500 ||
      value.messages.some(
        (item) =>
          typeof item.id !== "string" ||
          !item.id.startsWith(`${tenant}-`) ||
          typeof item.subject !== "string" ||
          typeof item.body !== "string" ||
          typeof item.read !== "boolean" ||
          typeof item.draft !== "boolean",
      )
    )
      return null;
    if (
      !Array.isArray(value.cases) ||
      value.cases.length !== expected.cases.length ||
      new Set(value.cases.map((item) => item.id)).size !==
        expected.cases.length ||
      value.cases.some(
        (item) =>
          !expected.cases.some(
            (source) =>
              source.id === item.id &&
              source.consent === item.consent &&
              source.title === item.title,
          ) ||
          typeof item.resolved !== "boolean" ||
          typeof item.note !== "string",
      )
    )
      return null;
    if (
      CONCEPTS.some(
        (concept) =>
          concept.id in value.mastery !== concept.id in value.attempts ||
          (concept.id in value.attempts &&
            value.mastery[concept.id] !== (value.attempts[concept.id] ? 1 : 0)),
      )
    )
      return null;
    return value;
  } catch {
    return null;
  }
}
