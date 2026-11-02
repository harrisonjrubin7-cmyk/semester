import { useState } from 'react';
import { toast } from 'sonner';
import { appReview, AppReviewOutputType } from 'zitejs/api';
import { Button } from '@project/components/ui/button';
import { Textarea } from '@project/components/ui/textarea';
import { Header, Panel, Chip, Loadable, useLoad, fmt, errMsg } from './ui';

type A = AppReviewOutputType['apps'][0];

function Decide({ a, me, onDone }: { a: A; me: string; onDone: (d: AppReviewOutputType) => void }) {
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  if (a.developerId === me) return <p className="text-xs text-muted-foreground">You registered this app, so someone else must review it.</p>;
  const go = async (approve: boolean) => {
    setBusy(true);
    try { const d = await appReview({ action: 'decide', appId: a.id, approve, seenScopes: a.scopes, note }); toast.success(d.message); onDone(d); setNote(''); }
    catch (e) { toast.error(errMsg(e)); }
    setBusy(false);
  };
  return (
    <div className="mt-2 space-y-2">
      <Textarea aria-label={`Review note for ${a.name}`} placeholder="What you checked and why (required)" value={note} onChange={(e) => setNote(e.target.value)} rows={2} />
      <div className="flex gap-2">
        <Button size="sm" disabled={busy || note.trim().length < 5} onClick={() => go(true)}>Approve these scopes</Button>
        <Button size="sm" variant="outline" disabled={busy || note.trim().length < 5} onClick={() => go(false)}>Reject</Button>
      </div>
    </div>
  );
}

export default function AppReviewPage() {
  const state = useLoad(() => appReview({ action: 'list' }), []);
  const [view, setView] = useState<AppReviewOutputType | null>(null);
  return (
    <div className="mx-auto max-w-5xl">
      <Header eyebrow="Developer platform" title="App review"
        sub="Approving lets other institutions install an app for exactly the scopes shown. Each institution still approves its own install, and any change to the scopes needs a new review." />
      <Loadable state={state}>{(loaded) => {
        const d = view ?? loaded;
        if (!d.ready) return <Panel><p className="text-sm">{d.message}</p></Panel>;
        if (!d.apps.length) return <Panel><p className="text-sm text-muted-foreground">No developer apps registered yet.</p></Panel>;
        return (
          <div className="space-y-3">
            {d.apps.map((a) => (
              <Panel key={a.id} title={<span className="flex flex-wrap items-center gap-2">{a.name} <Chip value={a.review} />{a.status === 'suspended' && <Chip value="suspended" />}</span>}>
                <p className="text-sm">Developer: {a.developer} · {a.installs} active install{a.installs === 1 ? '' : 's'}</p>
                <p className="mt-1 font-mono text-xs">{a.scopes.join(' · ') || 'No scopes declared'}</p>
                {a.review !== 'unreviewed' && <p className="mt-1 text-xs text-muted-foreground">{a.review} by {a.reviewedBy} · {fmt(a.reviewedAt)}{a.note ? ` · “${a.note}”` : ''}</p>}
                {a.review === 'unreviewed' && a.scopes.length > 0 && a.status !== 'suspended' && <Decide a={a} me={d.me} onDone={setView} />}
              </Panel>
            ))}
          </div>
        );
      }}</Loadable>
    </div>
  );
}
