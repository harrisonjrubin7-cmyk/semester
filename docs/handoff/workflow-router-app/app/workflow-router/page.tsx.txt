import { requireUser } from '@/lib/supabase/server';
import { WorkflowRouter } from '@/components/workflow-router/workflow-router';
import { FeatureMatrix } from '@/components/workflow-router/feature-matrix';
import { PlatformMatrix } from '@/components/workflow-router/platform-matrix';
export default async function Page() {
  const { user } = await requireUser();
  return (<div className="grid gap-10"><header><p className="text-xs uppercase tracking-wider text-neutral-600">Workflow router</p><h1 className="text-2xl font-semibold">Where should this be built?</h1></header>
    <WorkflowRouter signedIn={!!user} /><section><h2 className="mb-3 text-lg font-semibold">Feature matrix</h2><FeatureMatrix /></section><section><h2 className="mb-3 text-lg font-semibold">Twelve canonical workflows</h2><PlatformMatrix /></section></div>);
}
