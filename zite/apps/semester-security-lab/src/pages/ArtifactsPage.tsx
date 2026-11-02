import { Card } from '@project/components/ui/card';
import { Skeleton } from '@project/components/ui/skeleton';
import { useLabData } from '../lib/useLabData';
import { PageHeader, StatusBadge } from '../components/Badges';

export default function ArtifactsPage() {
  const { data } = useLabData();
  return (
    <div>
      <PageHeader title="Artifact parity" sub="Lists everything in the Claude artifact. The link couldn't be read, so its rows stay source_unavailable until you upload its exported code or screenshots. Nothing is made up." />
      {!data ? <Skeleton className="h-40" /> : (
        <div className="space-y-3">
          {data.artifacts.map((a) => (
            <Card key={a.id} className="p-5">
              <div className="flex items-start justify-between gap-3"><div className="font-medium">{a.item}</div><StatusBadge value={a.implementationStatus} /></div>
              <div className="mt-1 break-all font-mono text-xs text-muted-foreground">{a.sourceReference}</div>
              <p className="mt-3 text-sm">{a.intendedBehavior}</p>
              <p className="mt-2 text-xs text-muted-foreground">Acceptance: {a.acceptanceTest}</p>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
