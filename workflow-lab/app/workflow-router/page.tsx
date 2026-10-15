import type { Metadata } from "next";
import { WorkflowRouter, type SessionMode } from "@/components/workflow-router/workflow-router";
import type { SavedRecommendation } from "@/components/workflow-router/saved-list";
import { listMyOrganizations, listRecommendations } from "@/lib/benchmark/repository";
import { getUser } from "@/lib/supabase/server";
import { routerInputsSchema } from "@/lib/validation/workflow-router";

export const metadata: Metadata = { title: "Workflow router · Semester Workflow Lab" };
export const dynamic = "force-dynamic";

export default async function WorkflowRouterPage() {
  const { supabase, user } = await getUser();
  let session: SessionMode = { kind: "prototype" };
  let saved: SavedRecommendation[] = [];
  let organizations: Array<{ id: string; name: string; role: string }> = [];
  let loadError: string | null = null;

  if (supabase) {
    session = user ? { kind: "signed-in", email: user.email ?? null } : { kind: "signed-out" };
    if (user) {
      try {
        const [rows, orgs] = await Promise.all([listRecommendations(supabase), listMyOrganizations(supabase)]);
        organizations = orgs;
        saved = rows.flatMap((r) => {
          // Re-validate stored selections; skip any row that no longer parses rather than crash the page.
          const inputs = routerInputsSchema.safeParse(r.inputs);
          if (!inputs.success) return [];
          return [{
            id: r.id,
            title: r.title,
            createdAt: r.created_at,
            primary: r.primary_platform,
            confidence: r.confidence,
            shared: r.organization_id !== null,
            mine: r.user_id === user.id,
            inputs: inputs.data,
          }];
        });
      } catch {
        loadError = "Saved recommendations could not be loaded. Check that the migrations have been applied.";
      }
    }
  }

  return (
    <>
      {loadError && <p role="alert" className="mb-4 rounded-md bg-bad-soft px-3 py-2 text-sm text-bad">{loadError}</p>}
      <WorkflowRouter session={session} saved={saved} organizations={organizations} />
    </>
  );
}
