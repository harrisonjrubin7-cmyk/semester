import { ReactNode, useState } from 'react';
import { toast } from 'sonner';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@project/components/ui/sheet';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@project/components/ui/alert-dialog';
import { SourceTag } from './kit';

const SENTENCE: Record<string, string> = {
  'Official': 'Your institution’s own record, read from its system.',
  'Connected': 'From a calendar or account you connected. Semester has not checked it with your institution.',
  'Made Here': 'Semester built this from sources you gave it — a rule-based extraction, not an AI draft.',
  'Yours': 'You entered this yourself. Nothing has checked it.',
  'Sample': 'Illustrative data shipped as a demonstration. Not your semester.',
  'AI Assisted': 'Drafted with Ask Semester. It can be wrong — check the sources before you act on it.',
};

/** "Source & details" — origin, freshness, used in, who can see this, limitations, report. */
export function SourceDetails({ source, updated, usedIn, visibility, limitations, children }: { source: string; updated?: string; usedIn?: string; visibility?: string; limitations?: string; children?: ReactNode }) {
  const rows: [string, ReactNode][] = [
    ['Origin', <span className="flex flex-col gap-1"><SourceTag source={source} /><span className="text-muted-foreground">{SENTENCE[source]}</span></span>],
    ['Freshness', updated ?? 'Update time not recorded'],
    ['Used in', usedIn ?? 'Today · Search'],
    ['Who can see this', visibility ?? 'Only you and the people your institution authorizes'],
    ['Limitations', limitations ?? (source === 'Official' ? 'Your institution’s system is the record; Semester shows a copy.' : 'Not checked with your institution.')],
  ];
  return (
    <Sheet>
      <SheetTrigger asChild>{children ?? <button className="text-xs text-muted-foreground underline decoration-dotted underline-offset-2">Source & details</button>}</SheetTrigger>
      <SheetContent>
        <SheetHeader><SheetTitle className="font-display">Source & details</SheetTitle></SheetHeader>
        <dl className="mt-6 space-y-4 text-sm">
          {rows.map(([k, v]) => <div key={k}><dt className="eyebrow">{k}</dt><dd className="mt-1">{v}</dd></div>)}
        </dl>
        <button className="mt-8 text-xs text-muted-foreground underline" onClick={() => toast('Report recorded. The owning office reviews it; nothing changes until they do.')}>Report incorrect information</button>
      </SheetContent>
    </Sheet>
  );
}

/** Dialog + ActionPreview for consequential actions. Focus lands on the safe choice. */
export function ConfirmAction({ trigger, title, confirmLabel, keepLabel = 'Keep as is', destructive, onConfirm, children }: { trigger: ReactNode; title: string; confirmLabel: string; keepLabel?: string; destructive?: boolean; onConfirm: () => Promise<void> | void; children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  return (
    <>
      <span onClick={() => setOpen(true)}>{trigger}</span>
      <AlertDialog open={open} onOpenChange={setOpen}>
        <AlertDialogContent>
          <AlertDialogHeader><AlertDialogTitle className="font-display">{title}</AlertDialogTitle></AlertDialogHeader>
          {children}
          <AlertDialogFooter>
            <AlertDialogCancel autoFocus>{keepLabel}</AlertDialogCancel>
            <AlertDialogAction disabled={busy} className={destructive ? 'border border-destructive bg-transparent text-destructive hover:bg-destructive/10' : ''}
              onClick={async (e) => { e.preventDefault(); setBusy(true); try { await onConfirm(); setOpen(false); } catch (err) { toast(`! ${err instanceof Error ? err.message : 'That didn’t go through'}`); } finally { setBusy(false); } }}>
              {busy ? 'Working…' : confirmLabel}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

/** Reversible personal work: do it, then offer Undo. */
export function undoToast(message: string, onUndo: () => void) {
  toast(message, { action: { label: 'Undo', onClick: onUndo }, duration: 6000 });
}
