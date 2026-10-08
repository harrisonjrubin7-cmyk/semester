'use client';
import { useState, useTransition } from 'react';
import { PERSISTENCE_MODES, PLATFORMS, PLATFORM_LABEL, type WorkflowSpec } from '@/lib/benchmark/benchmark.config';
import { recordRun } from '@/app/benchmark/actions';
import { capabilityGuard } from '@/lib/benchmark/adapters/capability-guard';
export function RunForm({ taskId, task }: { taskId: string; task: WorkflowSpec }) {
  const [platform, setPlatform] = useState<(typeof PLATFORMS)[number]>(task.recommended); const guard = capabilityGuard(platform, task);
  const [said, setSaid] = useState(''); const [pending, start] = useTransition();
  return (<form className="grid gap-3" onSubmit={(e) => { e.preventDefault(); const f = new FormData(e.currentTarget); start(async () => {
      const r = await recordRun({ taskId, platform, executedPrompt: f.get('prompt'), modelName: f.get('model') || undefined, status: f.get('status'), statusReason: f.get('reason') || undefined, outputUrl: f.get('url') || '', runtimeNotes: f.get('runtime') || undefined, consoleNotes: f.get('console') || undefined, durationMs: f.get('ms') ? Number(f.get('ms')) : undefined, sourceManifest: String(f.get('manifest') || '').split('\n').filter(Boolean).map((path) => ({ path })), persistenceTested: f.get('ptested') === 'on', persistenceSurvivedReload: f.get('psurvived') === 'yes' ? true : f.get('psurvived') === 'no' ? false : null, persistenceMode: f.get('pmode'), persistenceEvidence: f.get('pevidence') || undefined });
      setSaid(r.ok ? 'Run recorded.' : 'Not recorded: ' + JSON.stringify(r.error)); }); }}>
    <label className="grid gap-1 text-sm">Platform<select value={platform} onChange={(e) => setPlatform(e.target.value as typeof platform)} className="min-h-10 rounded border px-2">{PLATFORMS.map((p) => <option key={p} value={p}>{PLATFORM_LABEL[p]}</option>)}</select></label>
    {!guard.ok && <p role="status" className="rounded border border-amber-600/50 bg-amber-50 p-2 text-sm">Unsupported: {guard.reason}</p>}
    <label className="grid gap-1 text-sm">Exact executed prompt<textarea name="prompt" required defaultValue={task.prompt} className="min-h-24 rounded border p-2 font-mono text-xs" /></label>
    <div className="grid grid-cols-2 gap-3"><label className="grid gap-1 text-sm">Model name/version<input name="model" className="min-h-10 rounded border px-2" /></label>
      <label className="grid gap-1 text-sm">Status<select name="status" defaultValue={guard.ok ? 'manual-review-required' : 'unsupported'} className="min-h-10 rounded border px-2">{['completed', 'manual-review-required', 'unsupported', 'failed'].map((s) => <option key={s}>{s}</option>)}</select></label></div>
    <label className="grid gap-1 text-sm">Status reason<input name="reason" defaultValue={guard.ok ? '' : guard.reason} className="min-h-10 rounded border px-2" /></label>
    <label className="grid gap-1 text-sm">Output URL<input name="url" type="url" className="min-h-10 rounded border px-2" /></label>
    <label className="grid gap-1 text-sm">Source/file manifest (one path per line)<textarea name="manifest" className="min-h-16 rounded border p-2 font-mono text-xs" /></label>
    <div className="grid grid-cols-3 gap-3"><label className="grid gap-1 text-sm">Duration (ms)<input name="ms" type="number" min={0} className="min-h-10 rounded border px-2" /></label><label className="col-span-2 grid gap-1 text-sm">Runtime/sandbox notes<input name="runtime" className="min-h-10 rounded border px-2" /></label></div>
    <label className="grid gap-1 text-sm">Console/log notes<textarea name="console" className="min-h-16 rounded border p-2 font-mono text-xs" /></label>
    <fieldset className="grid gap-2 rounded border p-3"><legend className="px-1 text-sm font-medium">Persistence test{task.requiresPersistence ? ' (required)' : ''}</legend>
      <label className="text-sm"><input type="checkbox" name="ptested" defaultChecked={task.requiresPersistence} /> Tested reload/refresh</label>
      <label className="grid gap-1 text-sm">Survived reload?<select name="psurvived" className="min-h-10 rounded border px-2"><option value="">Not recorded</option><option value="yes">Yes</option><option value="no">No</option></select></label>
      <label className="grid gap-1 text-sm">Storage mode<select name="pmode" className="min-h-10 rounded border px-2">{PERSISTENCE_MODES.map((m) => <option key={m}>{m}</option>)}</select></label>
      <label className="grid gap-1 text-sm">Evidence (URL, row id, screenshot or log)<input name="pevidence" className="min-h-10 rounded border px-2" /></label></fieldset>
    <button disabled={pending} className="min-h-10 rounded bg-slate-800 px-4 text-sm text-white">Record run</button><p role="status" className="text-sm">{said}</p></form>);
}
