import { useEffect, useMemo, useState } from 'react';
import { useStore } from '../../state/store';
import { ActionButton, Notice, Toggle } from '../ui';
import { CustomRow, Group, ValueRow } from '../shell/Rows';
import { AMOUNT, META, NOTE, ROW, WHAT } from '../rowparts';
import { useConfirm } from '../ConfirmDialog';
import { formatTime } from '../../lib/locale';
import type { OrderStatus } from '../../lib/dining/orders';
import {
  advanceOrder,
  cancelOrder,
  loadPlaces,
  loadPoolSummary,
  loadQueue,
  setOrdering,
  type Places,
  type PoolSummary,
  type QueuedOrder,
} from '../../lib/dining/client';

/**
 * The counter: the school's open mobile orders, oldest first, for an account
 * the database says holds `dining:operate` there.
 *
 * It reads `dining_order_queue()`, never the orders table, because the table
 * says which orders a shared swipe paid for and the queue does not: a shared
 * swipe arrives here as "a swipe", exactly like any other. The pool is three
 * totals and nothing per person. Pausing a location stops new mobile orders
 * there without touching the school's flag; cancelling refunds the order, so
 * it is confirmed first.
 */

const NEXT: Partial<Record<OrderStatus, { to: 'accepted' | 'ready' | 'picked_up'; label: string }>> = {
  placed: { to: 'accepted', label: 'Accept order' },
  accepted: { to: 'ready', label: 'Mark ready' },
  ready: { to: 'picked_up', label: 'Mark picked up' },
};

const PAID: Record<QueuedOrder['paidWith'], string> = {
  swipe: 'Paid with a swipe',
  dining_cents: 'Paid with dining dollars',
  campus_cents: 'Paid with campus cash',
};

const STATUS: Record<OrderStatus, string> = {
  placed: 'New',
  accepted: 'Being made',
  ready: 'Ready',
  picked_up: 'Picked up',
  cancelled: 'Cancelled',
};

interface Data {
  queue: QueuedOrder[];
  places: Places;
  pool: PoolSummary;
}

export function Counter() {
  const { say } = useStore();
  const [data, setData] = useState<Data | null>(null);
  const [error, setError] = useState('');
  const [status, setStatus] = useState('');
  const [version, setVersion] = useState(0);
  const { confirmFirst, dialog } = useConfirm();

  useEffect(() => {
    let live = true;
    Promise.all([loadQueue(), loadPlaces(), loadPoolSummary()]).then(
      ([queue, places, pool]) => { if (live) { setData({ queue, places, pool }); setError(''); } },
      (e: unknown) => { if (live) setError(e instanceof Error ? e.message : 'Could not read the counter.'); },
    );
    return () => { live = false; };
  }, [version]);

  const names = useMemo(() => new Map((data?.places.menu ?? []).map((m) => [m.id, m.name])), [data]);
  const places = useMemo(() => new Map((data?.places.locations ?? []).map((l) => [l.id, l.name])), [data]);

  const run = async (doing: string, done: string, act: () => Promise<unknown>) => {
    setStatus(doing);
    try {
      await act();
      setStatus('');
      say(done);
      setVersion((n) => n + 1);
    } catch (e) {
      setStatus(e instanceof Error ? e.message : 'Nothing was changed.');
    }
  };

  if (error && !data) {
    return (
      <>
        <Notice alert>{error} No order was moved.</Notice>
        <ActionButton onClick={() => setVersion((n) => n + 1)}>Try again</ActionButton>
      </>
    );
  }
  if (!data) return <p role="status" style={NOTE}>Reading the queue…</p>;

  return (
    <>
      <ActionButton tone="primary" onClick={() => setVersion((n) => n + 1)}>
        Refresh the queue
      </ActionButton>
      <Group header={`Open orders · ${data.queue.length}`} framed={false}>
        {data.queue.length === 0 ? (
          <CustomRow line={false}>
            <span style={NOTE}>No open orders. New ones arrive here oldest first.</span>
          </CustomRow>
        ) : (
          data.queue.map((o) => {
            const next = NEXT[o.status];
            const where = places.get(o.locationId) ?? 'a location';
            return (
              <CustomRow key={o.id}>
                <div style={ROW}>
                  <span style={WHAT}>
                    {STATUS[o.status]} · {o.items.map((i) => names.get(i) ?? 'an item').join(', ')}
                    <span style={META}>
                      {where} · {PAID[o.paidWith]} · placed {formatTime(o.placedAt, { hour: 'numeric', minute: '2-digit' })}
                    </span>
                  </span>
                  <span style={AMOUNT}>
                    {next ? (
                      <button
                        type="button"
                        className="btn"
                        onClick={() => void run('Moving the order…', `Order ${STATUS[next.to].toLowerCase()}.`, () => advanceOrder(o.id, next.to))}
                      >
                        {next.label}
                      </button>
                    ) : null}{' '}
                    <button
                      type="button"
                      className="btn"
                      onClick={() =>
                        confirmFirst({
                          title: 'Cancel this order',
                          confirmLabel: 'Cancel and refund',
                          preview: <p>The order at {where} is cancelled, and what it took is refunded to where it came from. The student sees it cancelled.</p>,
                          run: () => run('Cancelling…', 'Order cancelled and refunded.', () => cancelOrder(o.id, 'Cancelled at the counter.')),
                        })
                      }
                    >
                      Cancel order
                    </button>
                  </span>
                </div>
              </CustomRow>
            );
          })
        )}
      </Group>

      <Group header="Mobile orders by location" framed={false}>
        {data.places.locations.length === 0 ? (
          <CustomRow line={false}>
            <span style={NOTE}>The card office has listed no locations.</span>
          </CustomRow>
        ) : (
          data.places.locations.map((l) => (
            <Toggle
              key={l.id}
              on={l.orderingEnabled}
              label={`${l.name} takes mobile orders`}
              onChange={() =>
                void run(
                  l.orderingEnabled ? 'Pausing…' : 'Resuming…',
                  l.orderingEnabled ? `${l.name} paused mobile orders.` : `${l.name} takes mobile orders again.`,
                  () => setOrdering(l.id, !l.orderingEnabled),
                )
              }
            />
          ))
        )}
      </Group>

      <Group header="The basic-needs pool" footer="Totals only. Nobody here can see who gave a swipe or who used one." framed={false}>
        <ValueRow label="Swipes given" value={data.pool.donated} />
        <ValueRow label="Swipes used" value={data.pool.drawn} />
        <ValueRow label="Swipes available" value={data.pool.available} />
      </Group>

      {status ? <p role="status">{status}</p> : null}
      {dialog}
    </>
  );
}
