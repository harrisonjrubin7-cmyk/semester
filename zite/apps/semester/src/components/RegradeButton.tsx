import { useState } from 'react';
import { toast } from 'sonner';
import { regrade } from 'zitejs/api';
import { Button } from '@project/components/ui/button';
import { Textarea } from '@project/components/ui/textarea';
import { Label } from '@project/components/ui/label';
import { ActionPreview, errMsg } from './kit';
import { ConfirmAction } from './overlays';

export type MyRegrade = { id: string; label: string; enrollmentId: string; status: string; gradeAtRequest: string; newGrade: string; note: string };

/** Per-grade regrade control on the student's Grades page. */
export function RegradeButton({ enrollmentId, code, grade, existing, onDone }: { enrollmentId: string; code: string; grade: string; existing?: MyRegrade; onDone: () => void }) {
  const [reason, setReason] = useState('');
  if (existing?.status === 'Pending') {
    return (
      <span className="flex items-center gap-2 text-xs">
        <span className="text-muted-foreground">◐ Regrade requested</span>
        <Button size="sm" variant="ghost" onClick={async () => { try { await regrade({ action: 'withdraw', id: existing.id }); toast('Regrade request withdrawn.'); onDone(); } catch (e) { toast(`! ${errMsg(e)}`); } }}>Withdraw</Button>
      </span>
    );
  }
  if (existing && existing.status !== 'Withdrawn') {
    return <span className="text-xs text-muted-foreground" title={existing.note}>{existing.status === 'Grade Changed' ? `✓ Changed ${existing.gradeAtRequest} → ${existing.newGrade}` : `✓ Reviewed · ${existing.gradeAtRequest} kept`}</span>;
  }
  const id = `regrade-reason-${enrollmentId}`;
  return (
    <ConfirmAction trigger={<Button size="sm" variant="outline">Ask for regrade</Button>} title={`Ask for a regrade of ${code} (${grade})?`} confirmLabel="Send request"
      onConfirm={async () => { await regrade({ action: 'request', enrollmentId, reason }); toast('Regrade request sent to your instructor.'); setReason(''); onDone(); }}>
      <ActionPreview says="Your instructor (or the Registrar) reviews the grade and either keeps it or changes it. You get a note either way." stays={`Your grade stays ${grade} until someone decides.`} recovery={{ kind: 'undo', how: 'withdraw the request any time before it is decided.' }} />
      <Label htmlFor={id} className="mt-3 block text-xs">What should be reviewed, and why? (at least 20 characters)</Label>
      <Textarea id={id} rows={3} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. Question 3 on the final was marked wrong but matches the answer key in the syllabus." />
    </ConfirmAction>
  );
}
