'use server';
import { revalidatePath } from 'next/cache';
import { requireUser } from '@/lib/supabase/server';
import { SaveRecommendationSchema } from '@/lib/validation/workflow-router';
import { recommend } from '@/lib/workflow-router/engine';
export async function saveRecommendation(input: unknown) {
  const parsed = SaveRecommendationSchema.safeParse(input);
  if (!parsed.success) return { ok: false as const, error: parsed.error.flatten() };
  const { supabase, user } = await requireUser();
  if (!user) return { ok: false as const, error: 'Sign in to save recommendations.' };
  const r = recommend(parsed.data.answers); // recomputed on the server; the client's result is never trusted
  const { error, data } = await supabase.from('workflow_recommendations').insert({ owner_id: user.id, organization_id: parsed.data.organizationId, visibility: parsed.data.visibility, title: parsed.data.title, answers: parsed.data.answers, primary_platform: r.primary, secondary_platform: r.secondary, confidence: r.confidence, result: r }).select('id').single();
  if (error) return { ok: false as const, error: error.message };
  revalidatePath('/workflow-router');
  return { ok: true as const, id: data.id };
}
