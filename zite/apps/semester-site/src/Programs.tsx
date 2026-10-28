import { useEffect, useState } from 'react';
import { Skeleton } from '@project/components/ui/skeleton';
import { Button } from '@project/components/ui/button';
import { programs, ProgramsOutputType } from 'zitejs/api';
import { PageTitle } from './Layout';

/** Programs institutions chose to publish. Applying happens in Semester Applicants, after sign-in; nothing about an
 *  application is shown here. */
export function Programs() {
  const [d, setD] = useState<ProgramsOutputType | null>(null);
  const [err, setErr] = useState(false);
  useEffect(() => { programs({}).then(setD).catch(() => setErr(true)); }, []);
  const apply = (p: ProgramsOutputType['programs'][0]) => d?.applyUrl ? `${d.applyUrl}?institution=${encodeURIComponent(p.institutionId)}&program=${encodeURIComponent(p.name)}` : null;
  return (
    <>
      <PageTitle eyebrow="Programs" title="Study with an institution on Semester" intro="Each institution decides what it publishes here. Applying opens Semester Applicants, where you sign in and your application stays private to you and the institution." />
      <div className="mx-auto max-w-5xl px-4 pb-16 sm:px-6">
        {err ? <p className="border-t border-border pt-8 text-muted-foreground">Programs could not be loaded. Try again later.</p>
          : !d ? <div className="space-y-4"><Skeleton className="h-24" /><Skeleton className="h-24" /></div>
          : d.programs.length === 0 ? <p className="border-t border-border pt-8 text-muted-foreground">No institution has published a program yet.</p>
          : <ul className="divide-y divide-border border-t border-border">{d.programs.map((p) => {
              const href = p.accepting ? apply(p) : null;
              return (
                <li key={p.id} className="py-6">
                  <p className="eyebrow">{p.institution}</p>
                  <h2 className="mt-1 text-2xl">{p.name}</h2>
                  {p.entryTerms && <p className="text-sm text-muted-foreground">Entry: {p.entryTerms}</p>}
                  <p className="mt-2 max-w-3xl">{p.summary}</p>
                  <div className="mt-3">{!p.accepting ? <p className="text-sm text-muted-foreground">Not accepting applications right now.</p>
                    : href ? <Button asChild size="sm"><a href={href}>Apply in Semester Applicants</a></Button>
                    : <p className="text-sm text-muted-foreground">Applications open soon.</p>}</div>
                </li>
              );
            })}</ul>}
      </div>
    </>
  );
}
