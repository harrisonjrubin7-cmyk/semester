import { Link } from 'react-router-dom';
import { toast } from 'sonner';
import { learn } from 'zitejs/api';
import { Button } from '@project/components/ui/button';
import { PageHeader, Panel, Empty, SourceTag, useLoad, Loadable, errMsg } from '../components/kit';
import { useWorkspace } from '../lib/workspace';

type Sec = { id: string; code: string; title: string; term: string; times: string; policy: string; role: string };

function SecCard({ s }: { s: Sec }) {
  return (
    <Link to={`/learn/${s.id}`} className="block rounded-md border border-border bg-card p-4 transition-colors hover:border-primary/50">
      <div className="flex justify-between"><p className="eyebrow">{s.term} · {s.role === 'Faculty' ? 'Teaching' : 'Enrolled'}</p><SourceTag source="Sample" /></div>
      <p className="mt-1 font-display text-xl">{s.code} · {s.title}</p>
      <p className="text-sm text-muted-foreground">{s.times} · AI policy: {s.policy}</p>
    </Link>
  );
}

export default function Courses() {
  const { role } = useWorkspace();
  const state = useLoad(() => learn({ action: 'list' }));
  return (
    <>
      <PageHeader eyebrow="Learn" title="Courses" sub="Syllabus, assignments, materials and grades for each of your sections." />
      <Loadable state={state}>{(d) => (
        <div className="space-y-6">
          {d.grading?.length > 0 && (
            <div>
              <h2 className="mb-2 text-lg">Grading</h2>
              <p className="mb-2 text-xs text-muted-foreground">Sections where an instructor asked you to grade. You can grade submitted work; the instructor releases grades.</p>
              <div className="grid gap-3 md:grid-cols-2">{d.grading.map((s: Sec) => <SecCard key={s.id} s={s} />)}</div>
            </div>)}
          {(role === 'Faculty' || d.teaching.length > 0) && (
            <div>
              <h2 className="mb-2 text-lg">Teaching</h2>
              {d.teaching.length === 0 ? <Empty>You aren’t teaching a section yet.</Empty> : <div className="grid gap-3 md:grid-cols-2">{d.teaching.map((s: Sec) => <SecCard key={s.id} s={s} />)}</div>}
              {d.canTeach.length > 0 && (
                <Panel title="Sample sections you can take on" className="mt-3">
                  {d.canTeach.map((s: Sec) => (
                    <div key={s.id} className="flex items-center justify-between border-b border-border py-2 text-sm last:border-0">
                      <span>{s.code} · {s.title}</span>
                      <Button size="sm" variant="outline" onClick={async () => { try { await learn({ action: 'teach', sectionId: s.id }); state.reload(); } catch (e) { toast.error(errMsg(e)); } }}>Teach this</Button>
                    </div>))}
                </Panel>)}
            </div>)}
          <div>
            <h2 className="mb-2 text-lg">Learning</h2>
            {d.learning.length === 0 ? <Empty>You aren’t enrolled in any sections. Plan one in Registration.</Empty> : <div className="grid gap-3 md:grid-cols-2">{d.learning.map((s: Sec) => <SecCard key={s.id} s={s} />)}</div>}
          </div>
        </div>
      )}</Loadable>
    </>
  );
}
