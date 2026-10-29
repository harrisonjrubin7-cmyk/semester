import { useState } from 'react';
import { platform, sandbox } from 'zitejs/api';
import { useAuth } from 'zitejs/auth';
import { Toaster } from '@project/components/ui/sonner';
import { Skeleton } from '@project/components/ui/skeleton';
import { Button } from '@project/components/ui/button';
import { cn } from '@project/components/lib/utils';
import { useLoad } from './hooks';
import { ReviewQueue, AppsTable, KeysTable, AuditLog } from './components/Console';
import { Sandbox, Docs } from './components/Sandbox';
import { MyApps } from './components/MyApps';
import { Wordmark } from '@project/components/brand/Mark';
import { AppSwitcher } from '../../semester/src/components/AppSwitcher';

const TABS = [
  { id: 'review', label: 'Review queue', group: 'Platform' }, { id: 'apps', label: 'Apps', group: 'Platform' },
  { id: 'keys', label: 'Tokens', group: 'Platform' }, { id: 'audit', label: 'Audit', group: 'Platform' },
  { id: 'sandbox', label: 'Sandbox', group: 'Build' }, { id: 'myapps', label: 'My apps', group: 'Build' }, { id: 'docs', label: 'API reference', group: 'Build' },
] as const;
type Tab = (typeof TABS)[number]['id'];

const Loading = () => <div className="space-y-2"><Skeleton className="h-16" /><Skeleton className="h-16" /><Skeleton className="h-16" /></div>;
const Notice = ({ children }: { children: React.ReactNode }) => <p className="rounded-lg border bg-card p-6 text-sm text-muted-foreground">{children}</p>;

function PlatformArea({ tab }: { tab: Tab }) {
  const s = useLoad(() => platform({ action: 'list' }));
  if (s.error) return <Notice>{s.error} <Button size="sm" variant="link" onClick={s.reload}>Retry</Button></Notice>;
  if (!s.data) return <Loading />;
  const d = s.data;
  if (!d.reviewer || !d.ready) return <Notice>{d.message}</Notice>;
  if (tab === 'review') return <ReviewQueue d={d} set={(x) => s.setData(x as never)} />;
  if (tab === 'apps') return <AppsTable d={d} set={(x) => s.setData(x as never)} />;
  if (tab === 'keys') return <KeysTable d={d} set={(x) => s.setData(x as never)} />;
  return <AuditLog d={d} />;
}

function BuildArea({ tab }: { tab: Tab }) {
  const s = useLoad(() => sandbox({ action: 'list' }));
  if (tab === 'myapps') return <MyApps />;
  if (s.error) return <Notice>{s.error}</Notice>;
  if (!s.data) return <Loading />;
  if (!s.data.ready) return <Notice>{s.data.message}</Notice>;
  return tab === 'sandbox' ? <Sandbox d={s.data} set={(x) => s.setData(x as never)} /> : <Docs d={s.data} />;
}

export default function App() {
  const { user, isLoading } = useAuth();
  const [tab, setTab] = useState<Tab>('review');
  if (isLoading || !user) return null;
  const isPlatform = TABS.find((t) => t.id === tab)!.group === 'Platform';
  return (
    <div className="min-h-screen">
      <header className="bg-sidebar text-sidebar-foreground">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4">
          <div><p className="text-sm text-sidebar-foreground/80"><Wordmark /></p><h1 className="text-xl text-sidebar-accent-foreground">Developer platform</h1></div>
          <span className="text-xs">{user.email}</span>
        </div>
        <nav className="mx-auto flex max-w-6xl gap-1 overflow-x-auto px-4">
          {TABS.map((t, i) => (
            <button key={t.id} onClick={() => setTab(t.id)} className={cn('whitespace-nowrap border-b-2 px-3 py-2 text-sm transition-colors', i === 4 && 'ml-4',
              tab === t.id ? 'border-sidebar-primary text-sidebar-accent-foreground' : 'border-transparent text-sidebar-foreground/70 hover:text-sidebar-accent-foreground')}>{t.label}</button>))}
        </nav>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-6">
        {isPlatform ? <PlatformArea key="p" tab={tab} /> : <BuildArea key="b" tab={tab} />}
      </main>
      <AppSwitcher current="developers" /><Toaster />
    </div>
  );
}
