import { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { teaching } from 'zitejs/api';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@project/components/ui/tabs';
import { Card, CardContent } from '@project/components/ui/card';
import { ArrowLeft } from 'lucide-react';
import { useLoad } from '../lib/useLoad';
import { loadOh } from '../lib/oh';
import { LoadingBlock, DeniedOrError, Empty, PageHeader } from '../components/States';
import Attendance from '../components/Attendance';
import NewAssignment from '../components/NewAssignment';

export default function SectionPage() {
  const { id = '' } = useParams();
  const oh = useLoad(loadOh);
  const roster = useLoad(() => teaching({ action: 'roster', sectionId: id }) as Promise<{ students: { id: string; name: string }[] }>);
  const [tab, setTab] = useState('roster');
  const label = oh.data?.teaching.find((t) => t.id === id)?.label ?? 'Section';

  return (
    <div>
      <Link to="/" className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"><ArrowLeft className="h-4 w-4" />Teaching</Link>
      <PageHeader title={label} sub="Roster, attendance and assignments. Only the instructor of record can make changes." />
      {roster.loading && !roster.data ? <LoadingBlock /> : roster.error ? <DeniedOrError message={roster.error} onRetry={roster.reload} /> : (
        <Tabs value={tab} onValueChange={setTab}>
          <TabsList><TabsTrigger value="roster">Roster ({roster.data!.students.length})</TabsTrigger><TabsTrigger value="attendance">Attendance</TabsTrigger><TabsTrigger value="assign">New assignment</TabsTrigger></TabsList>
          <TabsContent value="roster">
            {roster.data!.students.length === 0 ? <Empty title="No enrolled students yet" /> : (
              <Card><CardContent className="divide-y divide-border p-0">
                {roster.data!.students.map((s) => <p key={s.id} className="px-5 py-3 text-sm font-medium">{s.name}</p>)}
              </CardContent></Card>
            )}
          </TabsContent>
          <TabsContent value="attendance"><Attendance sectionId={id} /></TabsContent>
          <TabsContent value="assign"><NewAssignment sectionId={id} students={roster.data!.students.length} onDone={() => setTab('roster')} /></TabsContent>
        </Tabs>
      )}
    </div>
  );
}
