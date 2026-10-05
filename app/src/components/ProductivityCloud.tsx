import { useState } from 'react';
import { cloudConfigured } from '../lib/cloud';
import {
  loadWorkspace,
  saveWorkspace,
  deleteWorkspace,
  productivityAggregate,
  type CloudWorkspace,
} from '../lib/productivity-cloud';
import type { Productivity } from '../lib/productivity';
import { download } from '../lib/deliver';

export function ProductivityCloud({
  who,
  value,
  replace,
}: {
  who: string;
  value: Productivity;
  replace: (next: Productivity) => boolean;
}) {
  const [remote, setRemote] = useState<CloudWorkspace | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [tenant, setTenant] = useState('');
  const [aggregate, setAggregate] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [review, setReview] = useState(false);
  const [metrics, setMetrics] = useState('');
  const run = async (action: () => Promise<void>) => {
    setBusy(true);
    setMessage('');
    try {
      await action();
    } catch (e) {
      setMessage(e instanceof Error ? e.message : 'Cloud operation failed.');
    } finally {
      setBusy(false);
    }
  };
  if (!cloudConfigured || who === 'device')
    return (
      <p>
        Sign in to a configured Semester account to save this private workspace
        across devices.
      </p>
    );
  return (
    <section className="productivity-card" aria-label="Cloud workspace">
      <h3>Private cloud workspace</h3>
      <p>
        Load the current revision before saving. Cloud copies include your
        private reflections and history. Other accounts cannot read them.
      </p>
      <label className="productivity-field">
        Institution ID (optional; active membership required)
        <input
          className="input"
          value={tenant}
          onChange={(e) => setTenant(e.target.value)}
        />
      </label>
      <label>
        <input
          type="checkbox"
          checked={aggregate}
          onChange={(e) => setAggregate(e.target.checked)}
        />{' '}
        Share only counts in institution aggregates (minimum 10 consenting
        active members)
      </label>
      <button
        type="button"
        disabled={busy}
        onClick={() =>
          void run(async () => {
            const copy = await loadWorkspace(who);
            setRemote(copy);
            setLoaded(true);
            setReview(!!copy);
            setTenant(copy?.tenantId || '');
            setAggregate(copy?.shareAggregate || false);
            setMessage(
              copy
                ? 'Cloud copy loaded for review. Your device copy has not changed.'
                : 'No cloud copy yet. You can create one.',
            );
          })
        }
      >
        Load cloud copy for review
      </button>
      <button
        type="button"
        disabled={busy || !loaded || review}
        onClick={() =>
          void run(async () => {
            setRemote(
              await saveWorkspace(
                value,
                remote?.revision || 0,
                tenant.trim() || null,
                aggregate,
              ),
            );
            setMessage('Saved privately in your account.');
          })
        }
      >
        Save device copy to cloud
      </button>
      {remote && review && (
        <div>
          <p>
            Cloud revision {remote.revision}, saved {remote.updatedAt}.{' '}
            {remote.data.decisions.length} decisions,{' '}
            {remote.data.captures.length} captures, {remote.data.drafts.length}{' '}
            drafts.
          </p>
          <button
            type="button"
            disabled={busy}
            onClick={() => {
              download({
                name: 'semester-device-before-cloud.json',
                body: JSON.stringify(value, null, 2),
                mime: 'application/json',
              });
              if (replace(remote.data)) {
                setReview(false);
                setMessage('Device backup exported and cloud copy restored.');
              } else
                setMessage(
                  'Device storage refused the restore. Local data was preserved.',
                );
            }}
          >
            Back up device and restore reviewed cloud copy
          </button>
          <button
            type="button"
            onClick={() => {
              setReview(false);
              setMessage(
                'Device copy retained. Next save replaces the reviewed cloud revision.',
              );
            }}
          >
            Keep device copy; allow replacing this cloud revision
          </button>
          <button
            type="button"
            onClick={() =>
              download({
                name: 'semester-cloud-review.json',
                body: JSON.stringify(remote.data, null, 2),
                mime: 'application/json',
              })
            }
          >
            Export cloud copy to inspect
          </button>
        </div>
      )}
      <button
        type="button"
        disabled={busy || !loaded}
        onClick={() =>
          void run(async () => {
            await deleteWorkspace(who);
            setRemote(null);
            setReview(false);
            setLoaded(false);
            setMessage('Cloud copy deleted. Device copy retained.');
          })
        }
      >
        Delete my cloud copy
      </button>
      <button
        type="button"
        disabled={busy || !tenant.trim()}
        onClick={() =>
          void run(async () => {
            const r = await productivityAggregate(tenant.trim());
            setMetrics(
              r.state === 'ready'
                ? `${r.cohort} consenting members · ${r.decisions} decisions · ${r.decided} recorded decisions`
                : `Aggregate suppressed: at least ${r.minimum || 10} consenting active members required.`,
            );
          })
        }
      >
        Load institution counts (administrators only)
      </button>
      {metrics && <p>{metrics}</p>}
      {message && <p role="status">{message}</p>}
    </section>
  );
}
