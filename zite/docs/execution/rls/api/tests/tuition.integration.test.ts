// §9 tuition acceptance: real webhook route, real signature check, real database, sandbox values only.
import express from "express";
import request from "supertest";
import pg from "pg";
import { createHmac, randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { withTenant } from "../src/database";
import { webhookRouter } from "../src/webhook";

const { Pool } = pg;
const conn = { host: process.env.TEST_PG_SOCKET!, port: Number(process.env.TEST_PG_PORT), database: "semester_rls_test" };
const runtime = new Pool({ ...conn, user: "semester_runtime_login", max: 5 });
const webhookDb = new Pool({ ...conn, user: "semester_webhook_login", max: 5 });
const admin = new Pool({ ...conn, user: "postgres", max: 3 });
const SECRET = "whsec_test_only_" + randomUUID();
const app = express().use(webhookRouter(webhookDb, { sandbox: SECRET }));

const TA = "a0000000-0000-0000-0000-00000000000a";
const ALICE = "00000000-0000-0000-0000-000000000001", ALEX = "00000000-0000-0000-0000-000000000002";
const ACCT = "00000000-0000-0000-0004-000000000001", ACCT_ALEX = "00000000-0000-0000-0004-000000000002";
const asAlice = <T>(fn: (db: pg.PoolClient) => Promise<T>) => withTenant(runtime, { userId: ALICE, tenantId: TA }, fn);

const sign = (body: string, t = Math.floor(Date.now() / 1000), secret = SECRET) =>
  `t=${t},v1=${createHmac("sha256", secret).update(`${t}.${body}`).digest("hex")}`;
const deliver = (evt: object, header?: string) => {
  const body = JSON.stringify(evt);
  return request(app).post("/api/v1/webhooks/payments/sandbox").set("content-type", "application/json").set("x-signature", header ?? sign(body)).send(body);
};
const event = (type: string, ref: string, amount: number, currency = "USD", id = `evt_${randomUUID()}`, account = "acct_A") =>
  ({ id, type, account, data: { provider_ref: ref, amount_minor: amount, currency } });

async function initiate(amount: number, key = `key-${randomUUID()}`) {
  return asAlice(async (db) => (await db.query<{ id: string; provider_ref: string }>(
    "insert into student_accounts.payment_operations (tenant_id, account_id, amount_minor, currency, idempotency_key) values ($1,$2,$3,'USD',$4) returning id, provider_ref",
    [TA, ACCT, amount, key])).rows[0]);
}
const balance = async () => Number((await admin.query("select coalesce(sum(amount_minor),0) as b from student_accounts.ledger_entries where account_id = $1", [ACCT])).rows[0].b);
const opState = async (id: string) => (await admin.query("select state from student_accounts.payment_operations where id = $1", [id])).rows[0].state;

beforeAll(async () => {
  await admin.query("insert into student_accounts.provider_accounts values ('sandbox','acct_A',$1)", [TA]);
  await admin.query("insert into student_accounts.accounts (id, tenant_id, student_user_id, currency) values ($1,$3,$4,'USD'),($2,$3,$5,'USD')", [ACCT, ACCT_ALEX, TA, ALICE, ALEX]);
  await admin.query("insert into student_accounts.ledger_entries (tenant_id, account_id, kind, amount_minor, currency, memo) values ($1,$2,'charge',500000,'USD','Fall 2026 tuition (synthetic)')", [TA, ACCT]);
});
afterAll(async () => {
  for (const t of ["ledger_entries", "provider_event_receipts", "payment_operations", "accounts", "provider_accounts"]) await admin.query(`delete from student_accounts.${t}`);
  await runtime.end(); await webhookDb.end(); await admin.end();
});

describe("§9 tuition acceptance", () => {
  it("browser-side initiation alone does not change the balance", async () => {
    await initiate(100000);
    expect(await balance()).toBe(500000);
  });
  it("forged webhook is rejected and leaves no receipt", async () => {
    const op = await initiate(200000);
    const evt = event("payment.succeeded", op.provider_ref, 200000);
    const res = await deliver(evt, sign(JSON.stringify(evt), undefined, "whsec_attacker"));
    expect(res.status).toBe(401);
    expect((await admin.query("select count(*)::int as n from student_accounts.provider_event_receipts where event_id = $1", [evt.id])).rows[0].n).toBe(0);
    expect(await opState(op.id)).toBe("initiated");
  });
  it("replayed signature outside the 5-minute tolerance is rejected", async () => {
    const op = await initiate(1000);
    const evt = event("payment.succeeded", op.provider_ref, 1000);
    expect((await deliver(evt, sign(JSON.stringify(evt), Math.floor(Date.now() / 1000) - 3600))).status).toBe(401);
  });
  it("partial payment updates the balance correctly; duplicate delivery posts once", async () => {
    const op = await initiate(200000);
    const evt = event("payment.succeeded", op.provider_ref, 200000);
    expect((await deliver(evt)).body.outcome).toBe("applied:confirmed");
    expect((await deliver(evt)).body.outcome).toBe("duplicate_ignored");
    expect(await balance()).toBe(300000);
  });
  it("same success re-sent with a new event id does not post twice", async () => {
    const op = await initiate(50000);
    await deliver(event("payment.succeeded", op.provider_ref, 50000));
    expect((await deliver(event("payment.succeeded", op.provider_ref, 50000))).body.outcome).toBe("stale_or_invalid_transition_ignored");
    expect(await balance()).toBe(250000);
  });
  it("reordered events do not regress a confirmed payment", async () => {
    const op = await initiate(10000);
    await deliver(event("payment.succeeded", op.provider_ref, 10000));
    expect((await deliver(event("payment.pending", op.provider_ref, 10000))).body.outcome).toBe("stale_or_invalid_transition_ignored");
    expect((await deliver(event("payment.failed", op.provider_ref, 10000))).body.outcome).toBe("stale_or_invalid_transition_ignored");
    expect(await opState(op.id)).toBe("confirmed");
  });
  it("wrong currency or amount stops processing and routes to reconciliation", async () => {
    const op = await initiate(30000);
    expect((await deliver(event("payment.succeeded", op.provider_ref, 30000, "EUR"))).body.outcome).toBe("reconciliation_required");
    expect((await deliver(event("payment.succeeded", op.provider_ref, 30000))).body.outcome).toBe("held_for_reconciliation");
    const op2 = await initiate(30000);
    expect((await deliver(event("payment.succeeded", op2.provider_ref, 29999))).body.outcome).toBe("reconciliation_required");
    expect(await balance()).toBe(240000);
  });
  it("refund is a new auditable entry; the original payment stays", async () => {
    const op = await initiate(40000);
    await deliver(event("payment.succeeded", op.provider_ref, 40000));
    const refundEvt = event("refund.succeeded", op.provider_ref, 15000);
    expect((await deliver(refundEvt)).body.outcome).toBe("applied:refunded");
    expect((await deliver(refundEvt)).body.outcome).toBe("duplicate_ignored");
    const rows = (await admin.query("select kind, amount_minor::int as a from student_accounts.ledger_entries where operation_id = $1 order by posted_at", [op.id])).rows;
    expect(rows).toEqual([{ kind: "payment", a: -40000 }, { kind: "refund", a: 15000 }]);
  });
  it("an unknown provider account is refused", async () => {
    const op = await initiate(5000);
    expect((await deliver(event("payment.succeeded", op.provider_ref, 5000, "USD", undefined, "acct_unknown"))).status).toBe(403);
  });

  it("students cannot post events, write the ledger, change payment state, or pay into someone else's account", async () => {
    await expect(asAlice((db) => db.query("select student_accounts.apply_provider_event('sandbox','acct_A','evt_x','payment.succeeded','pi_x',1,'USD')"))).rejects.toMatchObject({ code: "42501" });
    await expect(asAlice((db) => db.query("insert into student_accounts.ledger_entries (tenant_id, account_id, kind, amount_minor, currency, operation_id) select $1,$2,'payment',-500000,'USD',id from student_accounts.payment_operations limit 1", [TA, ACCT]))).rejects.toMatchObject({ code: "42501" });
    await expect(asAlice((db) => db.query("update student_accounts.payment_operations set state = 'confirmed'"))).rejects.toMatchObject({ code: "42501" });
    await expect(asAlice((db) => db.query("insert into student_accounts.payment_operations (tenant_id, account_id, amount_minor, currency, idempotency_key) values ($1,$2,100,'USD','key-other-acct')", [TA, ACCT_ALEX]))).rejects.toMatchObject({ code: "42501" });
  });
  it("a student sees only their own account and ledger", async () => {
    const ids = await asAlice(async (db) => (await db.query("select distinct account_id from student_accounts.ledger_entries")).rows.map((r) => r.account_id));
    expect(ids).toEqual([ACCT]);
  });
  it("retrying initiation with the same key does not create a second operation", async () => {
    await initiate(7000, "key-retry-same-0001");
    await expect(initiate(7000, "key-retry-same-0001")).rejects.toMatchObject({ code: "23505" });
  });
});
