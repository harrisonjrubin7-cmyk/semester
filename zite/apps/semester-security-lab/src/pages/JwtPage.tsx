import { useMemo, useState } from 'react';
import { toast } from 'sonner';
import { recordSimulationRun } from 'zitejs/api';
import { Button } from '@project/components/ui/button';
import { Card } from '@project/components/ui/card';
import { Input } from '@project/components/ui/input';
import { Label } from '@project/components/ui/label';
import { Switch } from '@project/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@project/components/ui/select';
import { CheckCircle2, MinusCircle, XCircle } from 'lucide-react';
import { BASE, evaluate, JwtInput, PRESETS } from '../lib/jwt';
import { ModeBadge, PageHeader } from '../components/Badges';

const TEXT: (keyof JwtInput)[] = ['alg', 'kid', 'iss', 'aud', 'sub', 'typ', 'tenant', 'workspace', 'targetTenant', 'targetWorkspace'];
const BOOL: (keyof JwtInput)[] = ['signatureValid', 'capabilityGranted', 'assignmentExpired', 'consentRequired', 'consentActive', 'entitlementActive'];

export default function JwtPage() {
  const [preset, setPreset] = useState('valid');
  const [v, setV] = useState<JwtInput>(BASE);
  const [saving, setSaving] = useState(false);
  const res = useMemo(() => evaluate(v), [v]);
  const set = (k: keyof JwtInput, val: unknown) => setV((p) => ({ ...p, [k]: val }));

  const save = async () => {
    setSaving(true);
    try {
      await recordSimulationRun({ runType: 'JWT', title: `JWT scenario: ${preset}`, status: 'recorded', summary: `Decision ${res.effectiveDecision}. ${res.reasonCodes.join(', ') || 'No denials'}`, evidence: JSON.stringify({ input: v, result: res }, null, 2) });
      toast.success('Saved as a simulation run');
    } catch { toast.error('Could not save'); } finally { setSaving(false); }
  };

  return (
    <div>
      <PageHeader title="JWT claims & scope" sub="Synthetic claims only. Never paste a real token. Each layer is checked separately, so a token can be valid and still be denied.">
        <div className="flex items-center gap-2">
          <Select value={preset} onValueChange={(p) => { setPreset(p); setV({ ...BASE, ...PRESETS[p] }); }}>
            <SelectTrigger className="w-56"><SelectValue /></SelectTrigger>
            <SelectContent>{Object.keys(PRESETS).map((k) => <SelectItem key={k} value={k}>{k}</SelectItem>)}</SelectContent>
          </Select>
          <Button onClick={save} disabled={saving}>Save run</Button>
        </div>
      </PageHeader>
      <div className="grid gap-6 lg:grid-cols-[1fr_1fr]">
        <Card className="space-y-4 p-5">
          <div className="grid grid-cols-2 gap-3">
            {TEXT.map((k) => (
              <div key={k} className="space-y-1"><Label className="font-mono text-xs">{k}</Label>
                <Input className="font-mono text-sm" value={String(v[k])} onChange={(e) => set(k, e.target.value)} /></div>
            ))}
            {(['expOffset', 'nbfOffset'] as const).map((k) => (
              <div key={k} className="space-y-1"><Label className="font-mono text-xs">{k} (s from now)</Label>
                <Input type="number" className="font-mono text-sm" value={v[k]} onChange={(e) => set(k, Number(e.target.value))} /></div>
            ))}
          </div>
          <div className="grid grid-cols-2 gap-3 border-t pt-4">
            <label className="flex items-center justify-between gap-2 text-sm font-mono">membership active
              <Switch checked={v.membership === 'active'} onCheckedChange={(c) => set('membership', c ? 'active' : 'revoked')} /></label>
            {BOOL.map((k) => (
              <label key={k} className="flex items-center justify-between gap-2 font-mono text-sm">{k}
                <Switch checked={Boolean(v[k])} onCheckedChange={(c) => set(k, c)} /></label>
            ))}
          </div>
        </Card>
        <div className="space-y-4">
          <Card className="p-5">
            <div className="mb-4 flex items-center justify-between">
              <div className="text-sm text-muted-foreground">Effective decision</div><ModeBadge mode="simulation" />
            </div>
            <div className={`text-3xl font-semibold uppercase tracking-tight ${res.effectiveDecision === 'allow' ? 'text-emerald-700' : 'text-destructive'}`}>{res.effectiveDecision}</div>
            <ol className="mt-5 divide-y">
              {res.layers.map((l) => (
                <li key={l.name} className="flex items-center justify-between py-2.5 text-sm">
                  <span className="flex items-center gap-2">
                    {l.result === 'pass' ? <CheckCircle2 className="h-4 w-4 text-emerald-600" /> : l.result === 'fail' ? <XCircle className="h-4 w-4 text-destructive" /> : <MinusCircle className="h-4 w-4 text-muted-foreground" />}
                    {l.name}</span>
                  <span className="font-mono text-xs text-muted-foreground">{l.codes.join(', ') || l.result}</span>
                </li>
              ))}
            </ol>
          </Card>
          <Card className="p-5">
            <div className="mb-2 text-sm font-medium">Access = identity ∩ membership ∩ capability ∩ scope ∩ consent ∩ entitlement</div>
            <pre className="overflow-auto rounded bg-secondary p-3 font-mono text-xs text-secondary-foreground">{JSON.stringify({ mode: res.mode, effectiveDecision: res.effectiveDecision, reasonCodes: res.reasonCodes }, null, 2)}</pre>
            <p className="mt-3 text-xs text-muted-foreground">A role claim in a token is never treated as a current role assignment. Platform operator ≠ student content; registrar ≠ counseling notes; guardian is a consent recipient, not a superior role.</p>
          </Card>
        </div>
      </div>
    </div>
  );
}
