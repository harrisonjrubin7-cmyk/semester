"use client";

import Link from "next/link";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { ArrowLeft, CheckCircle2, KeyRound, LockKeyhole, RefreshCw, Send } from "lucide-react";
import { PlatformShell } from "@/components/platform-shell";
import { api, token } from "@/lib/api";

type CommandType =
  | "registration.add"
  | "registration.drop"
  | "grades.submit_final"
  | "records.hold_release";

type CommandReceipt = {
  id: string;
  command_type: CommandType;
  status: string;
  created_at: string;
  replayed?: boolean;
};

type CommandReceiptPage = {
  items: CommandReceipt[];
  next_cursor: string | null;
};

const commandOptions: Array<{ value: CommandType; label: string; capability: string }> = [
  { value: "registration.add", label: "Add course registration", capability: "registration.write" },
  { value: "registration.drop", label: "Drop course registration", capability: "registration.write" },
  { value: "grades.submit_final", label: "Submit final grades", capability: "grades.write" },
  { value: "records.hold_release", label: "Release records hold", capability: "records.hold.write" },
];

function newIdempotencyKey() {
  return typeof crypto === "undefined" ? `semester-${Date.now()}` : `semester-${crypto.randomUUID()}`;
}

export default function ActionCenterPage() {
  const [authenticated, setAuthenticated] = useState(false);
  const [institutionId, setInstitutionId] = useState("");
  const [commandType, setCommandType] = useState<CommandType>("registration.add");
  const [payloadText, setPayloadText] = useState(
    JSON.stringify({ student_user_id: "", course_section_id: "" }, null, 2),
  );
  const [idempotencyKey, setIdempotencyKey] = useState("");
  const [receipt, setReceipt] = useState<CommandReceipt | null>(null);
  const [history, setHistory] = useState<CommandReceipt[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const selected = useMemo(
    () => commandOptions.find((option) => option.value === commandType)!,
    [commandType],
  );

  useEffect(() => {
    setAuthenticated(Boolean(token()));
    setIdempotencyKey(newIdempotencyKey());
  }, []);

  function chooseCommand(value: CommandType) {
    setCommandType(value);
    setIdempotencyKey(newIdempotencyKey());
    setReceipt(null);
    const templates: Record<CommandType, object> = {
      "registration.add": { student_user_id: "", course_section_id: "" },
      "registration.drop": { student_user_id: "", course_section_id: "" },
      "grades.submit_final": { course_section_id: "", grades: [] },
      "records.hold_release": { student_user_id: "", hold_id: "" },
    };
    setPayloadText(JSON.stringify(templates[value], null, 2));
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      const payload = JSON.parse(payloadText) as Record<string, unknown>;
      const created = await api<CommandReceipt>(`/institutions/${institutionId}/commands`, {
        method: "POST",
        headers: { "Idempotency-Key": idempotencyKey },
        body: JSON.stringify({ command_type: commandType, payload }),
      });
      setReceipt(created);
      setHistory((current) => [created, ...current.filter((item) => item.id !== created.id)]);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to submit this command");
    } finally {
      setBusy(false);
    }
  }

  async function loadHistory(cursor?: string) {
    setBusy(true);
    setError("");
    try {
      const suffix = cursor ? `?cursor=${encodeURIComponent(cursor)}` : "";
      const page = await api<CommandReceiptPage>(`/institutions/${institutionId}/commands${suffix}`);
      setHistory((current) => cursor ? [...current, ...page.items] : page.items);
      setNextCursor(page.next_cursor);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to load command receipts");
    } finally {
      setBusy(false);
    }
  }

  return (
    <PlatformShell current="workflows">
      <Link href="/os/workflows" className="back-link"><ArrowLeft size={16} /> Workflows</Link>
      <header className="action-header">
        <div>
          <p className="kicker">Governed execution</p>
          <h1>Action center</h1>
          <p className="os-lede">Consequential institutional actions enter a deny-by-default command boundary. Accepted requests receive an immutable receipt and enter a transactional outbox for an approved provider adapter.</p>
        </div>
        <div className="action-contract">
          <span><LockKeyhole size={16} /> Active role grant</span>
          <span><CheckCircle2 size={16} /> Approved capability</span>
          <span><KeyRound size={16} /> Idempotent receipt</span>
        </div>
      </header>

      {!authenticated && (
        <section className="action-notice" role="status">
          <LockKeyhole size={20} />
          <div><strong>Authentication required</strong><p>Sign in through the course workspace first. Institutional grants and capability approval are verified again by the API.</p></div>
          <Link href="/">Sign in</Link>
        </section>
      )}

      <div className="action-layout">
        <form className="action-form" onSubmit={submit}>
          <div className="section-heading"><div><p className="kicker">New command</p><h2>Prepare request</h2></div></div>
          <label>Institution ID<input required value={institutionId} onChange={(event) => setInstitutionId(event.target.value)} placeholder="UUID from the institution workspace" /></label>
          <label>Action<select value={commandType} onChange={(event) => chooseCommand(event.target.value as CommandType)}>{commandOptions.map((option) => <option value={option.value} key={option.value}>{option.label}</option>)}</select></label>
          <div className="capability-callout"><span>Required capability</span><code>{selected.capability}</code><small>An administrator must enable this capability with an approval reference. A kill switch can pause it immediately.</small></div>
          <label>Command payload<textarea required rows={9} spellCheck={false} value={payloadText} onChange={(event) => setPayloadText(event.target.value)} /></label>
          <label>Idempotency key<div className="key-input"><input required minLength={16} value={idempotencyKey} onChange={(event) => setIdempotencyKey(event.target.value)} /><button type="button" onClick={() => setIdempotencyKey(newIdempotencyKey())} aria-label="Generate a new idempotency key"><RefreshCw size={16} /></button></div></label>
          {error && <div className="action-error" role="alert">{error}</div>}
          <button className="action-submit" disabled={busy || !authenticated}><Send size={16} />{busy ? "Working…" : "Submit governed command"}</button>
        </form>

        <section className="receipt-panel" aria-live="polite">
          <div className="section-heading"><div><p className="kicker">Durable evidence</p><h2>Command receipts</h2></div><button type="button" disabled={busy || !institutionId || !authenticated} onClick={() => void loadHistory()}>Refresh</button></div>
          {receipt && <article className="receipt-feature"><CheckCircle2 size={22} /><div><span>{receipt.replayed ? "Safely replayed" : "Accepted"}</span><h3>{receipt.command_type}</h3><code>{receipt.id}</code><p>Accepted means recorded for governed processing. It does not claim the downstream SIS or records provider has completed the action.</p></div></article>}
          <div className="receipt-list">{history.map((item) => <article key={item.id}><div><strong>{item.command_type}</strong><small>{new Date(item.created_at).toLocaleString()}</small></div><span>{item.status}</span><code>{item.id}</code></article>)}{!history.length && <div className="receipt-empty">No receipts loaded. Submit a command or refresh with a registrar or operations grant.</div>}</div>
          {nextCursor && <button className="receipt-more" type="button" disabled={busy} onClick={() => void loadHistory(nextCursor)}>Load older receipts</button>}
        </section>
      </div>
    </PlatformShell>
  );
}
