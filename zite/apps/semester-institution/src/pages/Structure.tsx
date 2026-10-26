import { useState } from 'react';
import { sectionRequests } from 'zitejs/api';
import { Card, CardContent, CardHeader, CardTitle } from '@project/components/ui/card';
import { Button } from '@project/components/ui/button';
import { Input } from '@project/components/ui/input';
import { Label } from '@project/components/ui/label';
import { Switch } from '@project/components/ui/switch';
import { Badge } from '@project/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@project/components/ui/dialog';
import { Plus, Pencil, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { useLoad, errMsg } from '../lib/useLoad';
import { LoadingBlock, DeniedOrError, PageHeader } from '../components/States';
import type { SreqData } from '../components/sreqTypes';

type Edit = { kind: 'dept' | 'room'; id?: number; name: string; extra: string; active: boolean };
const emailOk = (s: string) => !s || /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(s);

export default function Structure() {
  const q = useLoad(() => sectionRequests({ action: 'get' }) as Promise<SreqData>);
  const [edit, setEdit] = useState<Edit | null>(null);
  const [busy, setBusy] = useState(false);
  const valid = !!edit && edit.name.trim().length >= 2 && (edit.kind === 'dept' ? emailOk(edit.extra.trim()) : Number(edit.extra) >= 1);
  const error = !edit ? '' : edit.name.trim().length < 2 ? 'Name needs at least 2 characters.' : edit.kind === 'dept' ? (emailOk(edit.extra.trim()) ? '' : 'Enter a valid email.') : Number(edit.extra) >= 1 ? '' : 'Capacity must be at least 1.';

  const save = async () => {
    if (!edit || !valid) return;
    setBusy(true);
    try {
      const d = (await sectionRequests(edit.kind === 'dept'
        ? { action: 'saveDepartment', id: edit.id, name: edit.name.trim(), chairEmail: edit.extra.trim() || undefined, active: edit.active }
        : { action: 'saveRoom', id: edit.id, name: edit.name.trim(), capacity: Number(edit.extra), active: edit.active })) as SreqData;
      q.setData(d); toast.success('Saved.'); setEdit(null);
    } catch (e) { toast.error(errMsg(e)); } finally { setBusy(false); }
  };

  if (q.loading && !q.data) return <LoadingBlock />;
  if (q.error) return <DeniedOrError message={q.error} onRetry={q.reload} />;
  const d = q.data!;
  if (!d.me.isAdmin) return <><PageHeader title="Departments & rooms" sub="Academic structure used by section requests." /><DeniedOrError message="Only institution administrators can manage departments and rooms." /></>;

  return (
    <div>
      <PageHeader title="Departments & rooms" sub="Academic structure used by section requests. Chairs review their department's requests." />
      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader className="flex-row items-center justify-between space-y-0"><CardTitle className="text-base">Departments</CardTitle>
            <Button size="sm" onClick={() => setEdit({ kind: 'dept', name: '', extra: '', active: true })}><Plus className="mr-1 h-4 w-4" />Add</Button></CardHeader>
          <CardContent className="divide-y divide-border">
            {d.departments.length === 0 && <p className="py-3 text-sm text-muted-foreground">No departments yet.</p>}
            {d.departments.map((x) => (
              <div key={x.id} className="flex items-center gap-3 py-3">
                <div className="min-w-0 flex-1"><p className="font-medium">{x.name}</p><p className="text-xs text-muted-foreground">Chair: {x.chair ?? 'none assigned'}</p></div>
                {!x.active && <Badge variant="outline">Inactive</Badge>}
                <Button size="icon" variant="ghost" aria-label="Edit" onClick={() => setEdit({ kind: 'dept', id: x.id, name: x.name, extra: '', active: x.active })}><Pencil className="h-4 w-4" /></Button>
              </div>
            ))}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex-row items-center justify-between space-y-0"><CardTitle className="text-base">Rooms</CardTitle>
            <Button size="sm" onClick={() => setEdit({ kind: 'room', name: '', extra: '', active: true })}><Plus className="mr-1 h-4 w-4" />Add</Button></CardHeader>
          <CardContent className="divide-y divide-border">
            {d.rooms.length === 0 && <p className="py-3 text-sm text-muted-foreground">No rooms yet.</p>}
            {d.rooms.map((x) => (
              <div key={x.id} className="flex items-center gap-3 py-3">
                <div className="min-w-0 flex-1"><p className="font-medium">{x.name}</p><p className="text-xs text-muted-foreground">{x.capacity} seats</p></div>
                {!x.active && <Badge variant="outline">Inactive</Badge>}
                <Button size="icon" variant="ghost" aria-label="Edit" onClick={() => setEdit({ kind: 'room', id: x.id, name: x.name, extra: String(x.capacity), active: x.active })}><Pencil className="h-4 w-4" /></Button>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
      <Dialog open={!!edit} onOpenChange={(o) => !o && setEdit(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>{edit?.id ? 'Edit' : 'Add'} {edit?.kind === 'dept' ? 'department' : 'room'}</DialogTitle></DialogHeader>
          {edit && (
            <div className="space-y-4">
              <div className="space-y-1.5"><Label>Name</Label><Input value={edit.name} onChange={(e) => setEdit({ ...edit, name: e.target.value })} /></div>
              {edit.kind === 'dept'
                ? <div className="space-y-1.5"><Label>Chair email</Label><Input type="email" value={edit.extra} onChange={(e) => setEdit({ ...edit, extra: e.target.value })} placeholder={edit.id ? 'Leave blank to clear the chair' : 'Optional'} /><p className="text-xs text-muted-foreground">Must be an active faculty, staff or administrator member.</p></div>
                : <div className="space-y-1.5"><Label>Seats</Label><Input type="number" min={1} value={edit.extra} onChange={(e) => setEdit({ ...edit, extra: e.target.value })} /></div>}
              <label className="flex items-center gap-2 text-sm"><Switch checked={edit.active} onCheckedChange={(v) => setEdit({ ...edit, active: v })} />Active</label>
              {error && <p className="text-xs text-destructive">{error}</p>}
            </div>
          )}
          <DialogFooter><Button variant="outline" onClick={() => setEdit(null)}>Cancel</Button>
            <Button disabled={!valid || busy} onClick={save}>{busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Save</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
