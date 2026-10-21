import { afterAll, describe, expect, it } from "vitest";
import { grantsForRole } from "@semester/permissions/roles";
import { getPool } from "../client";
import { createTask, queryOwnTasks } from "./tasks";

// Needs a migrated Postgres (TEST_DATABASE_URL) and a running OPA (OPA_BASE_URL).
const url = process.env.TEST_DATABASE_URL;
const opa = process.env.OPA_BASE_URL;
const d = url && opa ? describe : describe.skip;

d("tasks DAL against Postgres and OPA", () => {
  process.env.DATABASE_URL = url;
  const tenant = "00000000-0000-0000-0000-0000000000c1";
  const account = "00000000-0000-0000-0000-0000000000c2";
  const actor = { accountId: account, tenantId: tenant, grants: grantsForRole("student") };

  afterAll(async () => {
    await getPool().end();
  });

  it("creates a task through policy and reads it back under RLS", async () => {
    await getPool().query("insert into public.tenants (id, slug, name) values ($1,'tc','C') on conflict do nothing", [tenant]);
    await getPool().query("insert into public.accounts (id, primary_email) values ($1,'c2@t') on conflict do nothing", [account]);

    const created = await createTask(actor, { title: "read the syllabus" });
    expect(created).toMatchObject({ title: "read the syllabus", status: "open" });

    const mine = await queryOwnTasks(actor, 20);
    expect(mine.map((t) => t.title)).toContain("read the syllabus");
  });

  it("denies creation when the actor holds no grant", async () => {
    await expect(createTask({ ...actor, grants: [] }, { title: "nope" })).rejects.toThrow(
      "FORBIDDEN:default_deny",
    );
  });

  it("rejects invalid input before touching the database", async () => {
    await expect(createTask(actor, { title: "   " })).rejects.toThrow();
  });
});
