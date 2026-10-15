"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { api, API } from "@/lib/api";

const fieldClass = "min-h-11 w-full rounded border border-[color:var(--border-strong)] bg-[color:var(--surface-panel)] px-4 text-[color:var(--text-primary)]";

export function AuthLaunch() {
  const router = useRouter();
  const [mode, setMode] = useState<"login" | "register">("login");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setError("");
    const data = new FormData(event.currentTarget);
    try {
      const response = await fetch(`${API}/auth/${mode}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email: data.get("email"), password: data.get("password") }) });
      if (!response.ok) throw new Error(await response.text());
      const auth = await response.json();
      localStorage.setItem("course_engine_token", auth.access_token);
      let courses = await api<Array<{ id: string }>>("/courses");
      if (!courses.length) {
        const course = await api<{ id: string }>("/courses", { method: "POST", body: JSON.stringify({ title: data.get("course") || "My Course", term: data.get("term") || null, timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || "America/Chicago" }) });
        courses = [course];
      }
      router.push(`/courses/${courses[0].id}/overview`);
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Unable to continue"); }
    finally { setBusy(false); }
  }

  return <form aria-busy={busy} className="mt-8 grid gap-4" onSubmit={submit}>
    <div aria-label="Account action" className="grid grid-cols-2 rounded border border-[color:var(--border-default)] p-1 text-sm" role="group"><button aria-pressed={mode === "login"} className={`min-h-11 rounded ${mode === "login" ? "bg-[color:var(--ink-950)] text-white" : "text-[color:var(--text-secondary)]"}`} onClick={() => setMode("login")} type="button">Sign in</button><button aria-pressed={mode === "register"} className={`min-h-11 rounded ${mode === "register" ? "bg-[color:var(--ink-950)] text-white" : "text-[color:var(--text-secondary)]"}`} onClick={() => setMode("register")} type="button">Create account</button></div>
    <label className="grid gap-2 text-sm font-medium" htmlFor="email">Email<input autoComplete="email" className={fieldClass} id="email" name="email" required type="email" /></label>
    <label className="grid gap-2 text-sm font-medium" htmlFor="password">Password<input aria-describedby="password-help" autoComplete={mode === "login" ? "current-password" : "new-password"} className={fieldClass} id="password" minLength={10} name="password" required type="password" /></label><p className="muted -mt-2 text-xs" id="password-help">Use at least 10 characters.</p>
    {mode === "register" ? <div className="grid gap-4 sm:grid-cols-2"><label className="grid gap-2 text-sm font-medium" htmlFor="course">Course name<input className={fieldClass} id="course" name="course" /></label><label className="grid gap-2 text-sm font-medium" htmlFor="term">Term<input className={fieldClass} id="term" name="term" /></label></div> : null}
    {error ? <p className="text-sm text-[color:var(--danger)]" role="alert">{error}</p> : null}
    <button className="button button-primary" disabled={busy}>{busy ? "Opening workspace…" : mode === "login" ? "Open workspace" : "Create course workspace"}</button>
  </form>;
}
