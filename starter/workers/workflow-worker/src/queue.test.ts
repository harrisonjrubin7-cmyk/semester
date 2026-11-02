import { afterAll, describe, expect, it } from "vitest";
import { getPool } from "@semester/database/client";
import { runOnce, handlers } from "./queue";

const url = process.env.TEST_DATABASE_URL;
const d = url ? describe : describe.skip;

d("workflow queue against Postgres", () => {
  process.env.DATABASE_URL = url;
  afterAll(async () => {
    await getPool().end();
  });

  it("runs a registered job once and fails an unregistered kind", async () => {
    const seen: string[] = [];
    handlers["test.echo"] = async (job) => { seen.push(job.id); };
    await getPool().query("delete from public.jobs");
    const ok = await getPool().query("insert into public.jobs (kind) values ('test.echo') returning id");
    const bad = await getPool().query("insert into public.jobs (kind) values ('no.such.kind') returning id");

    expect(await runOnce()).toBe(true);
    expect(await runOnce()).toBe(true);
    expect(await runOnce()).toBe(false);

    expect(seen).toEqual([ok.rows[0].id]);
    const { rows } = await getPool().query("select id, status from public.jobs order by created_at");
    expect(rows.find((r) => r.id === ok.rows[0].id)?.status).toBe("done");
    expect(rows.find((r) => r.id === bad.rows[0].id)?.status).toBe("failed");
    delete handlers["test.echo"];
  });
});
