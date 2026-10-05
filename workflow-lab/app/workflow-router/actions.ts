"use server";

import { revalidatePath } from "next/cache";
import { NOT_CONFIGURED, SIGN_IN_REQUIRED, describeDbError, type ActionState } from "@/lib/actions/types";
import { getUser } from "@/lib/supabase/server";
import { fieldErrors, formToObject } from "@/lib/validation/common";
import { saveRecommendationSchema } from "@/lib/validation/workflow-router";
import { recommend } from "@/lib/workflow-router/engine";

/** Save a recommendation. The result is recomputed server-side from the selections. */
export async function saveRecommendation(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const { supabase, user } = await getUser();
  if (!supabase) return NOT_CONFIGURED;
  if (!user) return SIGN_IN_REQUIRED;

  const raw = formToObject(formData);
  const parsed = saveRecommendationSchema.safeParse({
    title: raw.title,
    organizationId: raw.organizationId,
    inputs: {
      deliverable: raw.deliverable,
      interaction: raw.interaction,
      backend: raw.backend,
      tech: raw.tech,
      persistence: raw.persistence,
      handoff: raw.handoff,
    },
  });
  if (!parsed.success) return { ok: false, message: "Check the highlighted fields.", errors: fieldErrors(parsed.error) };

  const rec = recommend(parsed.data.inputs);
  const { data, error } = await supabase
    .from("workflow_recommendations")
    .insert({
      user_id: user.id,
      organization_id: parsed.data.organizationId ?? null,
      title: parsed.data.title,
      inputs: parsed.data.inputs,
      result: JSON.parse(JSON.stringify(rec)),
      primary_platform: rec.primary,
      secondary_platform: rec.secondary,
      confidence: rec.confidence,
    })
    .select("id")
    .single();
  if (error) return { ok: false, message: describeDbError(error) };

  revalidatePath("/workflow-router");
  return { ok: true, message: "Recommendation saved.", id: data.id };
}

export async function deleteRecommendation(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const { supabase, user } = await getUser();
  if (!supabase) return NOT_CONFIGURED;
  if (!user) return SIGN_IN_REQUIRED;
  const id = String(formData.get("id") ?? "");
  if (!/^[0-9a-f-]{36}$/i.test(id)) return { ok: false, message: "Invalid recommendation id." };
  const { error, count } = await supabase.from("workflow_recommendations").delete({ count: "exact" }).eq("id", id);
  if (error) return { ok: false, message: describeDbError(error) };
  if (!count) return { ok: false, message: "Nothing was deleted: it does not exist or you cannot delete it." };
  revalidatePath("/workflow-router");
  return { ok: true, message: "Deleted." };
}
