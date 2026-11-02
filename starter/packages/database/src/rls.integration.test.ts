import { afterAll, describe, expect, it } from "vitest";
import { getPool } from "./client";
import { withRlsTransaction } from "./rls";

// Runs only when a disposable migrated database is provided (see supabase/tests/run.sh).
const url = process.env.TEST_DATABASE_URL;
const d = url ? describe : describe.skip;

d("withRlsTransaction against Postgres", () => {
  process.env.DATABASE_URL = url;
  const A = "00000000-0000-0000-0000-00000000000a";
  const B = "00000000-0000-0000-0000-00000000000b";
  const U1 = "00000000-0000-0000-0000-0000000000a1";
  const U2 = "00000000-0000-0000-0000-0000000000a2";

  afterAll(async () => {
    await getPool().end();
  });

  it("sees only rows bound to the scope, in one transaction", async () => {
    await getPool().query(
      `insert into public.tenants (id, slug, name) values ($1,'ta','A'),($2,'tb','B') on conflict do nothing`,
      [A, B],
    );
    await getPool().query(
      `insert into public.accounts (id, primary_email) values ($1,'x1@t'),($2,'x2@t') on conflict do nothing`,
      [U1, U2],
    );
    // Reruns against the same database must not accumulate rows.
    await getPool().query("delete from public.student_tasks where tenant_id = $1", [A]);
    await getPool().query(
      `insert into public.student_tasks (tenant_id, owner_account_id, title) values ($1,$2,'mine'),($1,$3,'theirs')`,
      [A, U1, U2],
    );

    const titles = await withRlsTransaction({ accountId: U1, tenantId: A }, async (client) => {
      const { rows } = await client.query<{ title: string }>("select title from public.student_tasks");
      return rows.map((r) => r.title);
    });
    expect(titles).toEqual(["mine"]);
  });

  it("denies insert on behalf of another owner", async () => {
    await expect(
      withRlsTransaction({ accountId: U1, tenantId: A }, async (client) => {
        await client.query(
          "insert into public.student_tasks (tenant_id, owner_account_id, title) values ($1,$2,'forged')",
          [A, U2],
        );
      }),
    ).rejects.toMatchObject({ code: "42501" });
  });
});
