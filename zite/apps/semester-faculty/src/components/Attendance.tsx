import { useEffect, useState } from 'react';
import { teaching } from 'zitejs/api';
import { Button } from '@project/components/ui/button';
import { Card, CardContent } from '@project/components/ui/card';
import { DatePicker } from '@project/components/ui/date-picker';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { cn } from '@project/components/lib/utils';
import { errMsg } from '../lib/useLoad';
import { LoadingBlock, Empty } from './States';

const STATUSES = ['Present', 'Late', 'Absent', 'Excused'] as const;
type Status = typeof STATUSES[number];
type Row = { id: string; name: string; status: Status | null };

export default function Attendance({ sectionId }: { sectionId: string }) {
  const [date, setDate] = useState<Date>(new Date());
  const [rows, setRows] = useState<Row[] | null>(null);
  const [saving, setSaving] = useState(false);
  const day = format(date, 'yyyy-MM-dd');

  useEffect(() => {
    setRows(null);
    teaching({ action: 'attendance', sectionId, date: day })
      .then((d) => setRows((d as { rows: Row[] }).rows ?? []))
      .catch((e) => { toast.error(errMsg(e)); setRows([]); });
  }, [sectionId, day]);

  const save = async () => {
    const marks = (rows ?? []).filter((r) => r.status).map((r) => ({ studentId: r.id, status: r.status! }));
    setSaving(true);
    try { await teaching({ action: 'saveAttendance', sectionId, date: day, marks }); toast.success(`Attendance saved for ${format(date, 'PP')}.`); }
    catch (e) { toast.error(errMsg(e)); } finally { setSaving(false); }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <div className="w-56"><DatePicker value={date} onChange={(d) => d && setDate(d)} /></div>
        <Button variant="outline" size="sm" disabled={!rows?.length} onClick={() => setRows(rows!.map((r) => ({ ...r, status: r.status ?? 'Present' })))}>Mark rest present</Button>
        <Button size="sm" className="ml-auto" disabled={saving || !rows?.some((r) => r.status)} onClick={save}>{saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Save attendance</Button>
      </div>
      {!rows ? <LoadingBlock rows={3} /> : rows.length === 0 ? <Empty title="No enrolled students" /> : (
        <Card><CardContent className="divide-y divide-border p-0">
          {rows.map((r) => (
            <div key={r.id} className="flex flex-wrap items-center gap-3 px-5 py-3">
              <p className="min-w-0 flex-1 text-sm font-medium">{r.name}</p>
              <div className="flex gap-1">
                {STATUSES.map((s) => (
                  <button key={s} onClick={() => setRows(rows.map((x) => x.id === r.id ? { ...x, status: s } : x))}
                    className={cn('rounded-md border px-2.5 py-1 text-xs font-medium transition-colors', r.status === s ? 'border-primary bg-primary text-primary-foreground' : 'border-border text-muted-foreground hover:bg-muted')}>{s}</button>
                ))}
              </div>
            </div>
          ))}
        </CardContent></Card>
      )}
    </div>
  );
}
