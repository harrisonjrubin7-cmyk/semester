import { useState } from 'react';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';
import { Fragment } from 'react';
import { institutionConsole as consoleApi, approvals } from 'zitejs/api';
import { Button } from '@project/components/ui/button';
import { Input } from '@project/components/ui/input';
import { Checkbox } from '@project/components/ui/checkbox';
import PrivacyOffice from '../components/RecordsRights';
import IntelligenceRegistry from '../components/Intelligence';
import { RoleAppsGapMap, ExpansionRegister } from './RoleApps';
import EventDelivery from '../components/EventDelivery';
import IntegrationMappings from '../components/IntegrationMappings';
import Reconciliation from '../components/Reconciliation';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@project/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@project/components/ui/select';
import { ArrowLeft } from 'lucide-react';
import { Panel, Empty, Status, fmt, useLoad, Loadable, errMsg } from '../components/kit';
import { SecurityOps, SupportQueue } from '../components/ConsoleOps';
import RoleRegister from '../components/RoleRegister';
import Readiness from '../components/Readiness';
import DevApps from '../components/DevApps';
import MigrationApprovals from '../components/MigrationApprovals';
import SupportAccess from '../components/SupportAccess';

type Int = { id: string; name: string; connector: string; authorized: boolean; syncStatus: string; retryCount: number; lastSyncedAt: string | null; lastReconciliation: string };
type Feat = { id: string; feature: string; designed: boolean; implemented: boolean; tested: boolean; deployed: boolean; institutionAuthorized: boolean; testCases: string };
type Mem = { id: string; name: string; roles: string[]; status: string; self: boolean };
type Appr = { id: string; title: string; status: string; reason: string; requestedBy: string; requestedById: string; approver: string };
const FIELDS = ['designed', 'implemented', 'tested', 'deployed', 'institutionAuthorized'] as const;
const ROLES = ['Student', 'Faculty', 'Advisor', 'Tutor', 'Staff', 'Administrator', 'Alumni', 'Employer'] as const;

function Approvals() {
  const state = useLoad(() => approvals({ action: 'list' }));
  const decide = async (id: string, approve: boolean) => { try { await approvals({ action: 'decide', id, approve }); state.reload(); } catch (e) { toast.error(errMsg(e)); } };
  return <Loadable state={state}>{(d) => d.items.length === 0 ? <Empty>No requests.</Empty> : <div>{d.items.map((x: Appr) => (
    <div key={x.id} className="border-b border-border py-2.5 text-sm last:border-0">
      <div className="flex justify-between"><span className="font-medium">{x.title}</span><Status value={x.status} /></div>
      <p className="text-xs text-muted-foreground">Requested by {x.requestedById === d.me ? 'you' : x.requestedBy}{x.approver && ` · decided by ${x.approver}`} · {x.reason}</p>
      {x.status === 'Pending Approval' && (x.requestedById === d.me ? <p className="text-xs">… Pending second approver</p> : <div className="mt-1 flex gap-2"><Button size="sm" variant="outline" onClick={() => decide(x.id, false)}>Reject</Button><Button size="sm" onClick={() => decide(x.id, true)}>Approve</Button></div>)}
    </div>))}</div>}</Loadable>;
}

export default function Console() {
  const state = useLoad(() => consoleApi({ action: 'get' }));
  const [roleReq, setRoleReq] = useState<Record<string, string>>({});
  const [days, setDays] = useState('');
  const [confirm, setConfirm] = useState('');
  const act = async (fn: () => Promise<unknown>, ok?: string) => { try { await fn(); if (ok) toast.success(ok); await state.reload(); } catch (e) { toast.error(errMsg(e)); } };

  return (
    <div className="min-h-screen bg-background">
      <Loadable state={state}>{(d) => (<>
        <div className="flex flex-wrap gap-x-6 gap-y-1 bg-sidebar px-4 py-2 text-xs text-sidebar-foreground md:px-8">
          <span>◆ {d.institution.isSample ? 'Sandbox' : 'Production'}</span><span>Scope: {d.institution.name}</span><span>Operator: {d.operator}</span><span>Role: Administrator</span><span>Session: {new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span><span>Every record view is logged</span>
        </div>
        <div className="mx-auto max-w-6xl px-4 py-6 md:px-8">
          <Link to="/today" className="mb-3 inline-flex items-center gap-1 text-sm text-muted-foreground"><ArrowLeft className="h-4 w-4" />Back to Semester</Link>
          <p className="eyebrow">Institution Console</p><h1 className="mb-5 text-3xl">{d.institution.name}</h1>
          <Tabs defaultValue="readiness">
            <TabsList className="flex-wrap"><TabsTrigger value="readiness">Readiness</TabsTrigger><TabsTrigger value="integrations">Integrations</TabsTrigger><TabsTrigger value="roles">Roles</TabsTrigger><TabsTrigger value="people">Memberships</TabsTrigger><TabsTrigger value="approvals">Approvals</TabsTrigger><TabsTrigger value="features">Feature status</TabsTrigger><TabsTrigger value="data">Retention</TabsTrigger><TabsTrigger value="audit">Audit log</TabsTrigger><TabsTrigger value="security">Security operations</TabsTrigger><TabsTrigger value="support">Support queue</TabsTrigger><TabsTrigger value="apps">Developer apps</TabsTrigger><TabsTrigger value="migrations">Migrations</TabsTrigger><TabsTrigger value="supportaccess">Support access</TabsTrigger><TabsTrigger value="privacy">Privacy & access reviews</TabsTrigger><TabsTrigger value="intelligence">Intelligence registry</TabsTrigger><TabsTrigger value="roleapps">Role apps</TabsTrigger><TabsTrigger value="events">Event delivery</TabsTrigger><TabsTrigger value="mappings">Mappings & drift</TabsTrigger><TabsTrigger value="recon">Scopes & reconciliation</TabsTrigger></TabsList>
            <TabsContent value="readiness"><Readiness /></TabsContent>
            <TabsContent value="apps"><DevApps /></TabsContent>
            <TabsContent value="migrations"><MigrationApprovals /></TabsContent>
            <TabsContent value="supportaccess"><SupportAccess /></TabsContent>
            <TabsContent value="privacy"><PrivacyOffice /></TabsContent>
            <TabsContent value="intelligence"><IntelligenceRegistry /></TabsContent>
            <TabsContent value="roleapps"><div className="space-y-4"><RoleAppsGapMap /><ExpansionRegister /></div></TabsContent>
            <TabsContent value="events"><EventDelivery /></TabsContent>
            <TabsContent value="mappings"><IntegrationMappings /></TabsContent>
            <TabsContent value="recon"><Reconciliation /></TabsContent>
            <TabsContent value="roles"><RoleRegister /></TabsContent>
            <TabsContent value="security"><SecurityOps /></TabsContent>
            <TabsContent value="support"><SupportQueue /></TabsContent>
            <TabsContent value="integrations" className="grid gap-4 lg:grid-cols-3">
              <Panel title="Connectors" className="lg:col-span-2">
                {d.integrations.map((x: Int) => (
                  <div key={x.id} className="border-b border-border py-3 text-sm last:border-0">
                    <div className="flex flex-wrap items-center justify-between gap-2"><span className="font-medium">{x.connector}</span><span className="flex items-center gap-3">{x.authorized ? <Status value={x.syncStatus} /> : <span className="text-xs text-muted-foreground">○ Off · not authorized</span>}<span className="font-mono text-xs text-muted-foreground">{x.lastSyncedAt ? fmt(x.lastSyncedAt) : '—'}</span></span></div>
                    {x.lastReconciliation && <p className="mt-1 text-xs text-muted-foreground">{x.lastReconciliation}</p>}
                    <div className="mt-2 flex flex-wrap gap-2">
                      <Button size="sm" variant="outline" onClick={() => act(() => consoleApi({ action: 'setAuthorized', id: x.id, authorized: !x.authorized }))}>{x.authorized ? 'Withdraw authorization' : 'Authorize'}</Button>
                      <Button size="sm" variant="outline" disabled={!x.authorized} onClick={() => act(() => consoleApi({ action: 'runSync', id: x.id }))}>Run sync{x.retryCount ? ` · retry ${x.retryCount}` : ''}</Button>
                      <Button size="sm" variant="ghost" disabled={x.syncStatus === 'Never Run'} onClick={() => act(() => consoleApi({ action: 'rollback', id: x.id }))}>Roll back</Button>
                    </div>
                  </div>))}
                <p className="mt-2 text-xs text-muted-foreground">No live system is configured in the foundation phase. Syncs record an honest failure until a real connection is set up.</p>
              </Panel>
              <div className="space-y-4">
                <Panel title="Activation checklist">{d.checklist.map((c: { label: string; done: boolean }) => <p key={c.label} className="py-1 text-sm">{c.done ? '☑' : '☐'} {c.label}</p>)}</Panel>
                <Panel title="Invite-only joining">
                  <p className="text-sm text-muted-foreground">People join with this code. Their membership stays pending until an administrator approves it under Memberships.</p>
                  <p className="mt-3 font-mono text-2xl tracking-widest">{d.institution.inviteCode || '—'}</p>
                  <div className="mt-3 flex gap-2">
                    <Button size="sm" variant="outline" onClick={() => act(() => consoleApi({ action: 'newInviteCode' }), d.institution.inviteCode ? 'New code issued. The old one no longer works.' : 'Invite code issued')}>{d.institution.inviteCode ? 'Replace code' : 'Issue code'}</Button>
                    {d.institution.inviteCode && <Button size="sm" variant="ghost" onClick={() => { navigator.clipboard.writeText(d.institution.inviteCode); toast.success('Copied'); }}>Copy</Button>}
                  </div>
                </Panel>
                {d.institution.isSample && <Panel title="Remove sample data">
                  <p className="text-sm text-muted-foreground">Deletes the sample catalog, requirements, sections, groups, events and every member’s Sample-labeled tasks, enrollments and study items. Memberships, consents, records members made themselves and the audit log stay. This can’t be undone.</p>
                  <Input className="mt-3 font-mono" placeholder="Type REMOVE to confirm" value={confirm} onChange={(e) => setConfirm(e.target.value)} />
                  <Button size="sm" variant="destructive" className="mt-2" disabled={confirm !== 'REMOVE'} onClick={() => act(async () => { const r = await consoleApi({ action: 'removeSample', confirm: 'REMOVE' }); setConfirm(''); toast.success(`${r.removed} sample records removed`); })}>Remove sample data</Button>
                </Panel>}
              </div>
            </TabsContent>
            <TabsContent value="people"><Panel title={`${d.memberships.length} memberships`}>
              {d.memberships.map((m: Mem) => (
                <div key={m.id} className="flex flex-wrap items-center justify-between gap-2 border-b border-border py-2.5 text-sm last:border-0">
                  <span>{m.name}{m.self && ' (you)'} <span className="text-muted-foreground">· {m.roles.join(', ')}</span> <Status value={m.status} /></span>
                  <span className="flex items-center gap-2">
                    <Select value={roleReq[m.id]} onValueChange={(v) => setRoleReq({ ...roleReq, [m.id]: v })}><SelectTrigger className="h-8 w-36"><SelectValue placeholder="Add role" /></SelectTrigger><SelectContent>{ROLES.filter((r) => !m.roles.includes(r)).map((r) => <SelectItem key={r} value={r}>{r}</SelectItem>)}</SelectContent></Select>
                    <Button size="sm" variant="outline" disabled={!roleReq[m.id]} onClick={() => act(() => consoleApi({ action: 'requestRole', membershipId: m.id, role: roleReq[m.id] as (typeof ROLES)[number], reason: 'Requested in console' }), 'Sent for second approval')}>Request</Button>
                    {!m.self && m.status === 'Pending' ? <><Button size="sm" variant="outline" onClick={() => act(() => consoleApi({ action: 'setMemberStatus', membershipId: m.id, status: 'Suspended' }), 'Join request declined')}>Decline</Button><Button size="sm" onClick={() => act(() => consoleApi({ action: 'setMemberStatus', membershipId: m.id, status: 'Active' }), 'Membership approved')}>Approve</Button></>
                    : !m.self && <Button size="sm" variant="ghost" onClick={() => act(() => consoleApi({ action: 'setMemberStatus', membershipId: m.id, status: m.status === 'Suspended' ? 'Active' : 'Suspended' }))}>{m.status === 'Suspended' ? 'Reactivate' : 'Suspend'}</Button>}
                  </span>
                </div>))}
              <p className="mt-2 text-xs text-muted-foreground">Role changes need a second administrator. The audit entry is written before the change applies.</p>
            </Panel></TabsContent>
            <TabsContent value="approvals"><Panel title="Approvals · decision trail"><Approvals /></Panel></TabsContent>
            <TabsContent value="features"><Panel>
              <p className="mb-2 text-xs text-muted-foreground">Read-only. Semester maintains this list with test evidence; institutions can't change it.</p>
              <div className="overflow-x-auto"><table className="w-full text-sm">
                <thead><tr className="eyebrow text-left"><th className="py-1 font-semibold">Feature</th>{['Designed', 'Implemented', 'Tested', 'Deployed', 'Inst. authorized'].map((h) => <th key={h} className="font-semibold">{h}</th>)}</tr></thead>
                <tbody>{d.features.map((f: Feat) => (<Fragment key={f.id}>
                  <tr key={f.id} className="border-t border-border"><td className="py-2 font-medium">{f.feature}</td>{FIELDS.map((k) => <td key={k}><Checkbox checked={f[k]} disabled aria-label={`${f.feature}: ${k} ${f[k] ? 'yes' : 'no'}`} /></td>)}</tr>
                  <tr key={f.id + 't'}><td colSpan={6} className="pb-2 text-xs text-muted-foreground">{f.testCases.split('\n').map((t) => <span key={t} className="mr-3">{t.startsWith('PASS') ? '✓' : t.startsWith('FAIL') ? '✕' : '○'} {t.replace(/^\w+:\s*/, '')}</span>)}</td></tr>
                </Fragment>))}</tbody>
              </table></div>
            </Panel></TabsContent>
            <TabsContent value="data"><Panel title="Retention" className="max-w-lg">
              <p className="text-sm text-muted-foreground">Currently {d.institution.retentionDays} days. {d.consentCount} consent records on file.</p>
              <div className="mt-3 flex gap-2"><Input type="number" placeholder="Days (30–3650)" value={days} onChange={(e) => setDays(e.target.value)} /><Button disabled={!days} onClick={() => act(() => consoleApi({ action: 'setRetention', days: Number(days) }), 'Retention updated').then(() => setDays(''))}>Save</Button></div>
              <p className="mt-4 text-sm font-medium">AI policy</p><p className="text-sm text-muted-foreground">{d.institution.aiPolicy || 'Not set'}</p>
            </Panel></TabsContent>
            <TabsContent value="audit"><Panel title="Audit log">
              {d.audit.length === 0 ? <Empty>No events yet.</Empty> : d.audit.map((a: { id: string; action: string; actor: string; recordRef: string; authority: string; viaAssistant: boolean; at: string }) => (
                <div key={a.id} className="grid grid-cols-1 gap-1 border-b border-border py-2 text-sm last:border-0 md:grid-cols-4">
                  <span>{a.action}{a.viaAssistant && ' · ✦ via assistant'}</span><span className="text-muted-foreground">{a.actor} · {a.authority}</span><span className="truncate font-mono text-xs text-muted-foreground">{a.recordRef}</span><span className="text-xs text-muted-foreground md:text-right">{fmt(a.at)}</span>
                </div>))}
            </Panel></TabsContent>
          </Tabs>
        </div>
      </>)}</Loadable>
    </div>
  );
}
