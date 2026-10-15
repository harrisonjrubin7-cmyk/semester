import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";
import { BenchmarkDashboard, type Viewer } from "@/components/benchmark/benchmark-dashboard";
import { LOCAL_SUITE_ID, loadSuiteBundle, localTemplateBundle } from "@/lib/benchmark/repository";
import type { SuiteBundle } from "@/lib/benchmark/types";
import { getUser } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Benchmark suite · Semester Workflow Lab" };
export const dynamic = "force-dynamic";

export default async function SuitePage({ params }: { params: Promise<{ suiteId: string }> }) {
  const { suiteId } = await params;
  if (suiteId !== LOCAL_SUITE_ID && !z.uuid().safeParse(suiteId).success) notFound();

  const { supabase, user } = await getUser();
  let bundle: SuiteBundle | null;
  let viewer: Viewer;

  if (suiteId === LOCAL_SUITE_ID) {
    bundle = localTemplateBundle();
    viewer = { userId: user?.id ?? null, canWrite: false, readOnlyReason: "This is the canonical definition (local sample data). Create a suite from the Benchmark page to record runs and grades." };
  } else {
    if (!supabase) notFound();
    if (!user) {
      return (
        <div className="mx-auto max-w-md space-y-3 py-10">
          <h1 className="text-xl font-semibold">Sign in to view this suite</h1>
          <p className="text-sm text-muted">Saved suites are private to their owner or organization.</p>
          <Link href={`/auth/sign-in?next=/benchmark/${suiteId}`} className="inline-block rounded-md bg-accent px-3 py-2 text-sm font-semibold text-accent-fg">Sign in</Link>
        </div>
      );
    }
    try {
      bundle = await loadSuiteBundle(supabase, suiteId);
    } catch {
      return <p role="alert" className="rounded-md bg-bad-soft px-3 py-2 text-sm text-bad">This suite could not be loaded.</p>;
    }
    // A suite you cannot read and one that does not exist are indistinguishable by design.
    if (!bundle) notFound();

    let canWrite = !bundle.suite.isTemplate;
    let readOnlyReason = bundle.suite.isTemplate ? "The template suite is read-only." : "";
    if (bundle.suite.organizationId && canWrite) {
      const { data } = await supabase.from("organization_members").select("role").eq("organization_id", bundle.suite.organizationId).eq("user_id", user.id).maybeSingle();
      if (!data || data.role === "viewer") {
        canWrite = false;
        readOnlyReason = "You have the viewer role in this organization, so this suite is read-only for you.";
      }
    }
    viewer = { userId: user.id, canWrite, readOnlyReason };
  }

  return <BenchmarkDashboard bundle={bundle} viewer={viewer} exportSuiteId={suiteId} />;
}
