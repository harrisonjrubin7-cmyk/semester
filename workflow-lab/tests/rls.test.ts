/**
 * Executable RLS/auth test plan. Every assertion runs as a real database role
 * with auth.uid() set, so Row Level Security (not application code) is what is
 * being tested. docs/RLS-TEST-PLAN.md lists these cases in prose.
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { as, createDb, failure, rows, USERS, type Db } from "./helpers/db";

let db: Db;
beforeAll(async () => {
  db = await createDb();
});
afterAll(async () => {
  await db.close();
});

const q = <T = Record<string, unknown>>(sql: string, p: unknown[] = []) => rows<T>(db, sql, p);

async function cloneSuite(user: "alice" | "bob" | "carol" | "dave" | "erin", orgId: string | null = null, name = `${user}'s suite`) {
  return as(db, user, async () => (await q<{ id: string }>("select public.clone_benchmark_template($1, $2) as id", [name, orgId]))[0]!.id);
}
async function taskId(user: Parameters<typeof as>[1], suite: string, n: number) {
  return as(db, user, async () => (await q<{ id: string }>("select id from public.benchmark_tasks where suite_id = $1 and task_number = $2", [suite, n]))[0]!.id);
}
let attemptCounter = 100;
/** Insert a run as `user` with a never-reused attempt number, so tests cannot collide with each other. */
async function newRun(user: Parameters<typeof as>[1], suite: string, task: string, platform: string, cols: Record<string, string | number | boolean> = {}) {
  const uid = user === "anon" ? null : USERS[user];
  const all: Record<string, string | number | boolean> = { task_id: task, suite_id: suite, platform, attempt: ++attemptCounter, executed_prompt: "prompt", recorded_by: uid ?? "", ...cols };
  const keys = Object.keys(all);
  return as(db, user, async () => {
    const r = await q<{ id: string }>(
      `insert into public.benchmark_runs (${keys.join(",")}) values (${keys.map((_, i) => `$${i + 1}`).join(",")}) returning id`,
      keys.map((k) => all[k]),
    );
    return r[0]!.id;
  });
}
const insertRun = (suite: string, task: string, platform: string, by: keyof typeof USERS, extra = "") =>
  `insert into public.benchmark_runs (task_id, suite_id, platform, executed_prompt, recorded_by${extra ? ", " + extra.split("=")[0] : ""})
   values ('${task}', '${suite}', '${platform}', 'prompt', '${USERS[by]}'${extra ? ", " + extra.split("=")[1] : ""}) returning id`;

describe("personal data is private to its owner", () => {
  let suite: string, task: string, run: string;
  beforeAll(async () => {
    suite = await cloneSuite("alice");
    task = await taskId("alice", suite, 1);
    run = await as(db, "alice", async () => (await q<{ id: string }>(insertRun(suite, task, "claude-artifacts", "alice")))[0]!.id);
    await as(db, "alice", () => q("insert into public.benchmark_grades (run_id, suite_id, correctness) values ($1, $2, 4)", [run, suite]));
  });

  it("clone produces all 12 tasks for the owner", async () => {
    const n = await as(db, "alice", async () => (await q<{ n: string }>("select count(*)::text n from public.benchmark_tasks where suite_id = $1", [suite]))[0]!.n);
    expect(n).toBe("12");
  });

  it("another signed-in user sees none of the suite, tasks, runs or grades", async () => {
    await as(db, "bob", async () => {
      expect(await q("select id from public.benchmark_suites where id = $1", [suite])).toHaveLength(0);
      expect(await q("select id from public.benchmark_tasks where suite_id = $1", [suite])).toHaveLength(0);
      expect(await q("select id from public.benchmark_runs where suite_id = $1", [suite])).toHaveLength(0);
      expect(await q("select id from public.benchmark_grades where suite_id = $1", [suite])).toHaveLength(0);
    });
  });

  it("another user cannot write runs or grades into it, nor edit or delete what exists", async () => {
    await as(db, "bob", async () => {
      expect(await failure(db, insertRun(suite, task, "v0", "bob"))).toMatch(/row-level security/i);
      expect(await failure(db, "insert into public.benchmark_grades (run_id, suite_id, correctness) values ($1,$2,5)", [run, suite])).toMatch(/row-level security/i);
      expect((await db.query("update public.benchmark_runs set executed_prompt = 'x' where id = $1", [run])).affectedRows).toBe(0);
      expect((await db.query("delete from public.benchmark_runs where id = $1", [run])).affectedRows).toBe(0);
      expect((await db.query("delete from public.benchmark_suites where id = $1", [suite])).affectedRows).toBe(0);
    });
    const still = await q("select 1 from public.benchmark_runs where id = $1 and executed_prompt = 'prompt'", [run]);
    expect(still).toHaveLength(1);
  });

  it("a user cannot forge another user as grader or recorder", async () => {
    const t2 = await taskId("alice", suite, 2);
    await as(db, "alice", async () => {
      expect(await failure(db, insertRun(suite, t2, "v0", "bob"))).toMatch(/row-level security/i);
      expect(await failure(db, "insert into public.benchmark_grades (run_id, suite_id, grader_id, correctness) values ($1,$2,$3,5)", [run, suite, USERS.bob])).toMatch(/row-level security/i);
    });
  });

  it("anon role has no access at all", async () => {
    await as(db, "anon", async () => {
      expect(await failure(db, "select * from public.benchmark_suites")).toMatch(/permission denied/i);
      expect(await failure(db, "select * from public.workflow_recommendations")).toMatch(/permission denied/i);
      expect(await failure(db, "select * from public.organizations")).toMatch(/permission denied/i);
    });
  });

  it("private schema helpers are not callable by anon", async () => {
    await as(db, "anon", async () => {
      expect(await failure(db, "select private.is_org_member(gen_random_uuid())")).toMatch(/permission denied/i);
    });
  });
});

describe("the canonical template is read-only for everyone", () => {
  it("every signed-in user can read it", async () => {
    for (const u of ["alice", "dave"] as const) {
      const n = await as(db, u, async () => (await q<{ n: string }>("select count(*)::text n from public.benchmark_tasks t join public.benchmark_suites s on s.id = t.suite_id where s.is_template"))[0]!.n);
      expect(n).toBe("12");
    }
  });
  it("nobody can modify, add runs to, or delete it", async () => {
    await as(db, "alice", async () => {
      expect((await db.query("update public.benchmark_tasks set title = 'hacked' where suite_id in (select id from public.benchmark_suites where is_template)")).affectedRows).toBe(0);
      expect((await db.query("delete from public.benchmark_suites where is_template")).affectedRows).toBe(0);
      const t = (await q<{ id: string; suite_id: string }>("select id, suite_id from public.benchmark_tasks limit 1"))[0]!;
      expect(await failure(db, insertRun(t.suite_id, t.id, "v0", "alice"))).toMatch(/row-level security/i);
      expect(await failure(db, "insert into public.benchmark_suites (name, is_template, owner_id) values ('fake', true, null)")).toBeTruthy();
    });
  });
});

describe("organization-scoped sharing", () => {
  let orgA: string, orgB: string, shared: string, otherOrgSuite: string, aliceRun: string;

  beforeAll(async () => {
    orgA = await as(db, "alice", async () => (await q<{ id: string }>("insert into public.organizations (name, slug) values ('Org A', 'org-a') returning id"))[0]!.id);
    orgB = await as(db, "erin", async () => (await q<{ id: string }>("insert into public.organizations (name, slug) values ('Org B', 'org-b') returning id"))[0]!.id);
    await as(db, "alice", async () => {
      await q("insert into public.organization_members (organization_id, user_id, role) values ($1,$2,'member'), ($1,$3,'viewer')", [orgA, USERS.bob, USERS.carol]);
    });
    shared = await cloneSuite("alice", orgA, "Org A shared");
    otherOrgSuite = await cloneSuite("erin", orgB, "Org B shared");
    aliceRun = await newRun("alice", shared, await taskId("alice", shared, 2), "v0"); // read-only fixtures for the tests below
    await as(db, "alice", () => q("insert into public.benchmark_grades (run_id, suite_id, correctness) values ($1,$2,3)", [aliceRun, shared]));
  });

  it("the creator becomes owner automatically", async () => {
    const r = await as(db, "alice", () => q<{ role: string }>("select role from public.organization_members where organization_id = $1 and user_id = $2", [orgA, USERS.alice]));
    expect(r[0]?.role).toBe("owner");
  });

  it("members and viewers read the shared suite; outsiders and other orgs do not", async () => {
    for (const u of ["alice", "bob", "carol"] as const)
      expect(await as(db, u, () => q("select id from public.benchmark_suites where id = $1", [shared]))).toHaveLength(1);
    for (const u of ["dave", "erin"] as const) {
      expect(await as(db, u, () => q("select id from public.benchmark_suites where id = $1", [shared]))).toHaveLength(0);
      expect(await as(db, u, () => q("select id from public.benchmark_tasks where suite_id = $1", [shared]))).toHaveLength(0);
      expect(await as(db, u, () => q("select id from public.benchmark_runs where suite_id = $1", [shared]))).toHaveLength(0);
    }
    // and org A members never see org B's data
    expect(await as(db, "bob", () => q("select id from public.benchmark_suites where id = $1", [otherOrgSuite]))).toHaveLength(0);
  });

  it("a member can record runs and grade; the data is visible to every member", async () => {
    const run = await newRun("bob", shared, await taskId("bob", shared, 1), "claude-artifacts");
    await as(db, "bob", () => q("insert into public.benchmark_grades (run_id, suite_id, correctness, rendering) values ($1,$2,4,5)", [run, shared]));
    await as(db, "alice", () => q("insert into public.benchmark_grades (run_id, suite_id, correctness) values ($1,$2,3)", [run, shared]));
    const seen = await as(db, "carol", () => q("select grader_id from public.benchmark_grades where run_id = $1", [run]));
    expect(seen).toHaveLength(2); // the viewer sees both graders
  });

  it("a viewer is read-only", async () => {
    const t = await taskId("carol", shared, 3);
    await as(db, "carol", async () => {
      expect(await failure(db, insertRun(shared, t, "v0", "carol"))).toMatch(/row-level security/i);
      expect(await failure(db, "insert into public.workflow_recommendations (organization_id, title, inputs, result, primary_platform, secondary_platform, confidence) values ($1,'t','{}','{}','v0','chatgpt-canvas',90)", [orgA])).toMatch(/row-level security/i);
      expect(await failure(db, "insert into public.benchmark_grades (run_id, suite_id, correctness) values ($1,$2,5)", [aliceRun, shared])).toMatch(/row-level security/i);
      expect((await db.query("update public.benchmark_runs set executed_prompt = 'x' where id = $1", [aliceRun])).affectedRows).toBe(0);
    });
  });

  it("a user cannot edit another grader's grade", async () => {
    await as(db, "bob", async () => {
      expect((await db.query("update public.benchmark_grades set correctness = 0 where run_id = $1 and grader_id = $2", [aliceRun, USERS.alice])).affectedRows).toBe(0);
      expect((await db.query("delete from public.benchmark_grades where run_id = $1 and grader_id = $2", [aliceRun, USERS.alice])).affectedRows).toBe(0);
    });
    const g = await q<{ correctness: number }>("select correctness from public.benchmark_grades where run_id = $1 and grader_id = $2", [aliceRun, USERS.alice]);
    expect(g[0]!.correctness).toBe(3);
  });

  it("outsiders cannot write into an organization suite", async () => {
    const t = await taskId("alice", shared, 4);
    for (const u of ["dave", "erin"] as const)
      await as(db, u, async () => {
        expect(await failure(db, insertRun(shared, t, "v0", u))).toMatch(/row-level security/i);
      });
  });

  it("a non-member or viewer cannot create a suite inside someone else's organization", async () => {
    for (const u of ["dave", "carol"] as const)
      await as(db, u, async () => {
        expect(await failure(db, "select public.clone_benchmark_template('x', $1)", [orgA])).toMatch(/row-level security/i);
      });
  });

  it("saved recommendations: private to the author unless shared with an organization", async () => {
    const mk = (org: string | null) =>
      `insert into public.workflow_recommendations (organization_id, title, inputs, result, primary_platform, secondary_platform, confidence)
       values (${org ? `'${org}'` : "null"}, 't', '{}', '{}', 'v0', 'claude-artifacts', 88) returning id`;
    const priv = await as(db, "alice", async () => (await q<{ id: string }>(mk(null)))[0]!.id);
    const share = await as(db, "bob", async () => (await q<{ id: string }>(mk(orgA)))[0]!.id);
    expect(await as(db, "bob", () => q("select 1 from public.workflow_recommendations where id = $1", [priv]))).toHaveLength(0);
    expect(await as(db, "alice", () => q("select 1 from public.workflow_recommendations where id = $1", [share]))).toHaveLength(1);
    expect(await as(db, "carol", () => q("select 1 from public.workflow_recommendations where id = $1", [share]))).toHaveLength(1);
    expect(await as(db, "dave", () => q("select 1 from public.workflow_recommendations where id = $1", [share]))).toHaveLength(0);
    expect(await as(db, "erin", () => q("select 1 from public.workflow_recommendations where id = $1", [share]))).toHaveLength(0);
    // a user cannot insert a row owned by someone else
    await as(db, "dave", async () => {
      expect(await failure(db, `insert into public.workflow_recommendations (user_id, title, inputs, result, primary_platform, secondary_platform, confidence) values ('${USERS.alice}', 't','{}','{}','v0','claude-artifacts',1)`)).toMatch(/row-level security/i);
    });
  });
});

describe("organization roles", () => {
  let counter = 0;
  /** A fresh organization per test: alice owner, bob admin, carol member. */
  async function freshOrg() {
    const slug = `roles-org-${++counter}`;
    const org = await as(db, "alice", async () => (await q<{ id: string }>("insert into public.organizations (name, slug) values ($1, $2) returning id", [slug, slug]))[0]!.id);
    await as(db, "alice", () => q("insert into public.organization_members (organization_id, user_id, role) values ($1,$2,'admin'), ($1,$3,'member')", [org, USERS.bob, USERS.carol]));
    return org;
  }

  it("an admin can add members and viewers but not owners or admins", async () => {
    const org = await freshOrg();
    await as(db, "bob", async () => {
      expect(await failure(db, "insert into public.organization_members (organization_id, user_id, role) values ($1,$2,'viewer')", [org, USERS.dave])).toBeNull();
      expect(await failure(db, "insert into public.organization_members (organization_id, user_id, role) values ($1,$2,'owner')", [org, USERS.erin])).toMatch(/row-level security/i);
      expect(await failure(db, "insert into public.organization_members (organization_id, user_id, role) values ($1,$2,'admin')", [org, USERS.erin])).toMatch(/row-level security/i);
    });
  });

  it("an admin cannot promote a member to owner or touch the owner", async () => {
    const org = await freshOrg();
    await as(db, "bob", async () => {
      expect(await failure(db, "update public.organization_members set role = 'owner' where organization_id = $1 and user_id = $2", [org, USERS.carol])).toMatch(/row-level security/i);
      expect((await db.query("update public.organization_members set role = 'viewer' where organization_id = $1 and user_id = $2", [org, USERS.alice])).affectedRows).toBe(0);
      expect((await db.query("delete from public.organization_members where organization_id = $1 and user_id = $2", [org, USERS.alice])).affectedRows).toBe(0);
    });
    const still = await q<{ role: string }>("select role from public.organization_members where organization_id = $1 and user_id = $2", [org, USERS.alice]);
    expect(still[0]!.role).toBe("owner");
  });

  it("a plain member cannot manage membership", async () => {
    const org = await freshOrg();
    await as(db, "carol", async () => {
      expect(await failure(db, "insert into public.organization_members (organization_id, user_id, role) values ($1,$2,'viewer')", [org, USERS.erin])).toMatch(/row-level security/i);
      expect((await db.query("update public.organization_members set role = 'viewer' where organization_id = $1 and user_id = $2", [org, USERS.bob])).affectedRows).toBe(0);
    });
  });

  it("non-members cannot see an organization's member list", async () => {
    const org = await freshOrg();
    expect(await as(db, "erin", () => q("select 1 from public.organization_members where organization_id = $1", [org]))).toHaveLength(0);
    expect(await as(db, "erin", () => q("select 1 from public.organizations where id = $1", [org]))).toHaveLength(0);
  });

  it("the last owner cannot be demoted, removed or leave", async () => {
    const org = await freshOrg();
    await as(db, "alice", async () => {
      expect(await failure(db, "update public.organization_members set role = 'admin' where organization_id = $1 and user_id = $2", [org, USERS.alice])).toMatch(/at least one owner/);
      expect(await failure(db, "delete from public.organization_members where organization_id = $1 and user_id = $2", [org, USERS.alice])).toMatch(/at least one owner/);
    });
  });

  it("with a second owner the first may leave; the owner can delete the organization (cascade is not blocked)", async () => {
    const org = await freshOrg();
    await as(db, "alice", async () => {
      await q("update public.organization_members set role = 'owner' where organization_id = $1 and user_id = $2", [org, USERS.carol]);
      expect(await failure(db, "delete from public.organization_members where organization_id = $1 and user_id = $2", [org, USERS.alice])).toBeNull();
    });
    await as(db, "carol", async () => {
      expect(await failure(db, "delete from public.organizations where id = $1", [org])).toBeNull();
    });
    expect(await q("select 1 from public.organization_members where organization_id = $1", [org])).toHaveLength(0);
  });

  it("only an owner can delete an organization", async () => {
    const org = await freshOrg();
    await as(db, "bob", async () => {
      expect((await db.query("delete from public.organizations where id = $1", [org])).affectedRows).toBe(0);
    });
    expect(await q("select 1 from public.organizations where id = $1", [org])).toHaveLength(1);
  });
});

describe("persistence ceiling is enforced in the database", () => {
  let suite: string, task9: string, task1: string;
  beforeAll(async () => {
    suite = await cloneSuite("alice", null, "persistence");
    task9 = await taskId("alice", suite, 9); // requires persistence
    task1 = await taskId("alice", suite, 1); // does not
  });
  const persistRun = (cols: Record<string, string | number | boolean>, task = task9) => newRun("alice", suite, task, "claude-artifacts", cols);
  const grade = (runId: string, p: number) =>
    as(db, "alice", () => failure(db, "insert into public.benchmark_grades (run_id, suite_id, persistence) values ($1,$2,$3) on conflict (run_id, grader_id) do update set persistence = excluded.persistence", [runId, suite, p]));

  it("untested persistence on a persistence task caps the grade at 0", async () => {
    const run = await persistRun({});
    expect(await grade(run, 3)).toMatch(/exceeds the ceiling of 0/);
    expect(await grade(run, 0)).toBeNull();
  });

  it("local UI state that does not survive reload cannot earn more than 1", async () => {
    const run = await persistRun({ persistence_tested: true, persistence_survived_reload: false, persistence_mode: "local-preview" });
    expect(await grade(run, 2)).toMatch(/exceeds the ceiling of 1/);
    expect(await grade(run, 1)).toBeNull();
  });

  it("an unrecorded survival result is treated as not surviving", async () => {
    const run = await persistRun({ persistence_tested: true, persistence_mode: "database", persistence_evidence: "row 1" });
    expect(await grade(run, 2)).toMatch(/exceeds the ceiling of 1/);
  });

  it("browser-local that survived reload is capped at 3", async () => {
    const run = await persistRun({ persistence_tested: true, persistence_survived_reload: true, persistence_mode: "browser-local" });
    expect(await grade(run, 4)).toMatch(/exceeds the ceiling of 3/);
    expect(await grade(run, 3)).toBeNull();
  });

  it("database storage needs evidence to exceed 3", async () => {
    const bare = await persistRun({ persistence_tested: true, persistence_survived_reload: true, persistence_mode: "database" });
    expect(await grade(bare, 5)).toMatch(/exceeds the ceiling of 3/);
    const evidenced = await persistRun({ persistence_tested: true, persistence_survived_reload: true, persistence_mode: "database", persistence_evidence: "row 8f3a in artifacts table" });
    expect(await grade(evidenced, 5)).toBeNull();
    const viaUrl = await persistRun({ persistence_tested: true, persistence_survived_reload: true, persistence_mode: "project-backed", persistence_evidence_url: "https://example.test/log" });
    expect(await grade(viaUrl, 5)).toBeNull();
  });

  it("weakening the run's persistence facts pulls existing grades down", async () => {
    const run = await persistRun({ persistence_tested: true, persistence_survived_reload: true, persistence_mode: "database", persistence_evidence: "row 1" });
    expect(await grade(run, 5)).toBeNull();
    await as(db, "alice", () => q("update public.benchmark_runs set persistence_survived_reload = false where id = $1", [run]));
    const g = await q<{ persistence: number }>("select persistence from public.benchmark_grades where run_id = $1", [run]);
    expect(g[0]!.persistence).toBe(1);
  });

  it("tasks that do not require persistence are not capped", async () => {
    const run = await persistRun({}, task1);
    expect(await grade(run, 5)).toBeNull();
  });
});

describe("integrity constraints", () => {
  let suite: string, task: string;
  beforeAll(async () => {
    suite = await cloneSuite("dave", null, "integrity");
    task = await taskId("dave", suite, 4);
  });
  it("one row per task/platform/attempt, but platforms and attempts are independent", async () => {
    await as(db, "dave", async () => {
      expect(await failure(db, insertRun(suite, task, "v0", "dave"))).toBeNull();
      expect(await failure(db, insertRun(suite, task, "v0", "dave"))).toMatch(/unique|duplicate/i);
      expect(await failure(db, insertRun(suite, task, "chatgpt-canvas", "dave"))).toBeNull();
      expect(await failure(db, `insert into public.benchmark_runs (task_id, suite_id, platform, attempt, executed_prompt, recorded_by) values ('${task}','${suite}','v0',2,'p','${USERS.dave}')`)).toBeNull();
    });
  });
  it("a run must belong to a task in the same suite", async () => {
    const other = await cloneSuite("dave", null, "other");
    await as(db, "dave", async () => {
      expect(await failure(db, `insert into public.benchmark_runs (task_id, suite_id, platform, executed_prompt, recorded_by) values ('${task}','${other}','v0','p','${USERS.dave}')`)).toMatch(/foreign key|violates/i);
    });
  });
  it("scores are bounded 0-5 and a grade needs at least one score", async () => {
    const run = await newRun("dave", suite, task, "chatgpt-canvas");
    await as(db, "dave", async () => {
      expect(await failure(db, "insert into public.benchmark_grades (run_id, suite_id, correctness) values ($1,$2,6)", [run, suite])).toMatch(/check/i);
      expect(await failure(db, "insert into public.benchmark_grades (run_id, suite_id) values ($1,$2)", [run, suite])).toMatch(/check/i);
    });
  });
  it("survival can only be recorded when persistence was tested", async () => {
    await as(db, "dave", async () => {
      expect(await failure(db, `insert into public.benchmark_runs (task_id, suite_id, platform, attempt, executed_prompt, persistence_survived_reload, recorded_by) values ('${task}','${suite}','claude-artifacts',1,'p',true,'${USERS.dave}')`)).toMatch(/check/i);
    });
  });
  it("rubric weights must total 100 across all eight criteria", async () => {
    await as(db, "dave", async () => {
      const bad = await failure(db, `update public.benchmark_tasks set rubric_weights = '{"correctness":50}' where id = $1`, [task]);
      expect(bad).toMatch(/check/i);
      const ok = await failure(db, `update public.benchmark_tasks set rubric_weights = '{"correctness":30,"code_quality":20,"rendering":10,"state_management":10,"maintainability":10,"handoff":10,"sandbox_fit":5,"persistence":5}' where id = $1`, [task]);
      expect(ok).toBeNull();
      expect(await failure(db, `update public.benchmark_tasks set rubric_weights = '{"correctness":30,"code_quality":20,"rendering":10,"state_management":10,"maintainability":10,"handoff":10,"sandbox_fit":5,"persistence":6}' where id = $1`, [task])).toMatch(/check/i);
    });
  });
  it("output URLs must be http(s)", async () => {
    await as(db, "dave", async () => {
      expect(await failure(db, `insert into public.benchmark_runs (task_id, suite_id, platform, attempt, executed_prompt, output_url, recorded_by) values ('${task}','${suite}','claude-artifacts',1,'p','javascript:alert(1)','${USERS.dave}')`)).toMatch(/check/i);
    });
  });
});
