import { toast } from 'sonner';
import { privacy } from 'zitejs/api';
import { Button } from '@project/components/ui/button';
import { Switch } from '@project/components/ui/switch';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@project/components/ui/alert-dialog';
import { logout } from 'zitejs/auth';
import { PageHeader, Panel, Empty, fmt, fmtDay, useLoad, Loadable, errMsg } from '../components/kit';
import { useWorkspace } from '../lib/workspace';
import FamilyShare from '../components/FamilyShare';
import { MyRecordsRights } from '../components/RecordsRights';

type C = { id: string; label: string; type: string; granted: boolean; recipient: string; expiresOn: string | null; family?: string | null };

export default function You() {
  const { membership, role } = useWorkspace();
  const state = useLoad(() => privacy({ action: 'get' }));
  const act = async (fn: () => Promise<unknown>, ok?: string) => { try { await fn(); if (ok) toast.success(ok); await state.reload(); } catch (e) { toast.error(errMsg(e)); } };
  const exportData = async () => {
    try {
      const r = await privacy({ action: 'export' });
      const blob = new Blob([JSON.stringify(r.data, null, 2)], { type: 'application/json' });
      const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'semester-export.json'; a.click();
    } catch (e) { toast.error(errMsg(e)); }
  };

  return (
    <>
      <PageHeader eyebrow="You" title="Privacy & data" sub="Every consent and share, who opened what, and your data." actions={<Button variant="outline" size="sm" onClick={() => logout()}>Sign out</Button>} />
      <Loadable state={state}>{(d) => (
        <div className="grid gap-4 lg:grid-cols-2">
          <Panel title="Shares and consents">
            {d.consents.length === 0 ? <Empty>No consents recorded.</Empty> : d.consents.map((c: C) => (
              <div key={c.id} className="flex items-center justify-between gap-3 border-b border-border py-2.5 text-sm last:border-0">
                <span>{c.label}{c.recipient && !c.label.includes(' → ') && ` → ${c.recipient}`}{c.expiresOn && <span className="text-muted-foreground"> · until {fmtDay(c.expiresOn)}</span>}{c.family && <span className="text-muted-foreground"> · {({ Pending: 'awaiting their acceptance', Accepted: 'accepted', Declined: 'declined', Revoked: 'revoked', Left: 'they stopped viewing' } as Record<string, string>)[c.family] ?? c.family}</span>}</span>
                {c.type === 'Terms' ? <span className="text-xs text-muted-foreground">✓ Accepted</span>
                  : c.type === 'AI Training' ? <span className="text-xs text-muted-foreground">Off · locked</span>
                  : c.type === 'Data Sharing' ? (c.granted ? <Button size="sm" variant="ghost" onClick={() => act(() => privacy({ action: 'revoke', id: c.id }), 'Revoked')}>Revoke</Button> : <span className="text-xs text-muted-foreground">Revoked</span>)
                  : <span className="flex items-center gap-2 text-xs text-muted-foreground">{c.granted ? 'On' : 'Off'}<Switch checked={c.granted} onCheckedChange={(v) => act(() => privacy({ action: 'setConsent', id: c.id, granted: v }))} /></span>}
              </div>))}
          </Panel>
          <Panel title="Your data">
            <p className="mb-2 text-sm"><a href="/you/files" className="text-primary underline">Files</a> — private uploads, shared only with people you name, until a date you set.</p>
            <p className="text-sm text-muted-foreground">Download everything Semester holds about you, or ask for it to be deleted. Private notes are never shared.</p>
            <div className="mt-4 flex flex-wrap gap-2">
              <Button variant="outline" onClick={exportData}>Export my data</Button>
              <AlertDialog>
                <AlertDialogTrigger asChild><Button variant="outline" className="border-destructive text-destructive">Request deletion</Button></AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader><AlertDialogTitle>Request deletion?</AlertDialogTitle>
                    <AlertDialogDescription>What goes: your personal tasks, notes, study items, achievements and consents. What stays: official academic records (enrollments, released grades) kept under {membership.institutionName}’s retention policy, and the audit log. The request goes to Student Services as a case.</AlertDialogDescription></AlertDialogHeader>
                  <AlertDialogFooter><AlertDialogCancel>Keep my data</AlertDialogCancel><AlertDialogAction onClick={() => act(() => privacy({ action: 'requestDeletion' }), 'Deletion request sent')}>Send request</AlertDialogAction></AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
            <div className="mt-6 text-sm"><p className="font-medium">Profile</p><p className="text-muted-foreground">{membership.institutionName} · roles: {membership.roles.join(', ')} · using {role}</p></div>
          </Panel>
          <FamilyShare onDone={state.reload} />
          <MyRecordsRights />
          <Panel title="When family looked" className="lg:col-span-2">
            {(d.familyAccess ?? []).length === 0 ? <Empty>No family views yet. When someone you share with opens Semester Family, it shows here.</Empty> : d.familyAccess.map((v: { id: number; recipient: string; categories: string[]; at: string }) => (
              <div key={v.id} className="flex justify-between gap-3 border-b border-border py-2 text-sm last:border-0"><span>{v.recipient} <span className="text-muted-foreground">viewed {v.categories.join(', ')}</span></span><span className="whitespace-nowrap text-xs text-muted-foreground">{fmt(v.at)}</span></div>))}
          </Panel>
          <Panel title="Access history" className="lg:col-span-2">
            {d.history.length === 0 ? <Empty>No access recorded yet.</Empty> : d.history.map((h: { id: string; action: string; actor: string; authority: string; at: string }) => (
              <div key={h.id} className="flex justify-between gap-3 border-b border-border py-2 text-sm last:border-0"><span>{h.action} · <span className="text-muted-foreground">{h.actor}{h.authority && ` (${h.authority})`}</span></span><span className="whitespace-nowrap text-xs text-muted-foreground">{fmt(h.at)}</span></div>))}
          </Panel>
        </div>
      )}</Loadable>
    </>
  );
}
