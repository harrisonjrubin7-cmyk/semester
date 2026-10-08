"use client";

import { useActionState } from "react";
import { createSuite } from "@/app/benchmark/actions";
import { ActionMessage, Field, SubmitButton, fieldError, inputClass } from "@/components/ui/form-bits";
import type { ActionState } from "@/lib/actions/types";

export function CreateSuiteForm({ organizations }: { organizations: Array<{ id: string; name: string; role: string }> }) {
  const [state, action] = useActionState<ActionState, FormData>(createSuite, null);
  const writable = organizations.filter((o) => o.role !== "viewer");
  return (
    <form action={action} className="space-y-3">
      <Field label="Suite name" name="name" error={fieldError(state, "name")} hint="Leave blank to use the canonical name.">
        <input id="name" name="name" maxLength={200} className={inputClass} placeholder="e.g. Q4 platform bake-off" />
      </Field>
      <Field label="Visibility" name="organizationId" hint="Personal suites are visible only to you. Organization suites are visible to every member; viewers are read-only.">
        <select id="organizationId" name="organizationId" className={inputClass} defaultValue="">
          <option value="">Personal (only me)</option>
          {writable.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
        </select>
      </Field>
      <SubmitButton pendingLabel="Creating…">Create suite with all 12 workflows</SubmitButton>
      <ActionMessage state={state} />
    </form>
  );
}
