"use client";

import { withBasePath } from "@/lib/base-path";
import { useActionState } from "react";
import { saveRecommendation } from "@/app/workflow-router/actions";
import { ActionMessage, Field, SubmitButton, fieldError, inputClass } from "@/components/ui/form-bits";
import type { ActionState } from "@/lib/actions/types";
import type { RouterInputs } from "@/lib/workflow-router/inputs";
import type { SessionMode } from "./workflow-router";

export function SaveRecommendation({ inputs, session, organizations }: {
  inputs: RouterInputs;
  session: SessionMode;
  organizations: Array<{ id: string; name: string; role: string }>;
}) {
  const [state, action] = useActionState<ActionState, FormData>(saveRecommendation, null);

  if (session.kind === "prototype")
    return <p className="rounded-md bg-warn-soft px-3 py-2 text-sm text-warn">Prototype mode: Supabase is not configured, so recommendations cannot be saved. You can still copy and export them.</p>;
  if (session.kind === "signed-out")
    return <p className="rounded-md bg-surface-2 px-3 py-2 text-sm">Saving is protected. <a href={withBasePath("/auth/sign-in?next=/workflow-router")} className="font-medium underline">Sign in</a> to save this recommendation.</p>;

  const writable = organizations.filter((o) => o.role !== "viewer");
  return (
    <form action={action} className="space-y-3">
      {Object.entries(inputs).map(([k, v]) => <input key={k} type="hidden" name={k} value={v} />)}
      <Field label="Title" name="title" error={fieldError(state, "title")}>
        <input id="title" name="title" required maxLength={200} className={inputClass} placeholder="e.g. Billing dashboard routing" aria-describedby="title-error" />
      </Field>
      {writable.length > 0 && (
        <Field label="Share with" name="organizationId" hint="Private to you unless you pick an organization.">
          <select id="organizationId" name="organizationId" className={inputClass} defaultValue="">
            <option value="">Only me</option>
            {writable.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
          </select>
        </Field>
      )}
      <SubmitButton>Save recommendation</SubmitButton>
      <ActionMessage state={state} />
    </form>
  );
}
