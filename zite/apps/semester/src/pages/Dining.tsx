import { useState } from 'react';
import { toast } from 'sonner';
import { dining } from 'zitejs/api';
import { Button } from '@project/components/ui/button';
import { Input } from '@project/components/ui/input';
import { PageHeader, Panel, Empty, Loadable, useLoad, Status, errMsg, fmt } from '../components/kit';
import { unacknowledged } from '../lib/diningRules';

/* eslint-disable @typescript-eslint/no-explicit-any */
const money = (c: number) => `$${(c / 100).toFixed(2)}`;
const words = (s: string) => s.replace(/_/g, ' ');
const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const STATE: Record<string, string> = { placed: 'Placed', preparing: 'Being prepared', ready: 'Ready for pickup', picked_up: 'Picked up', cancelled: 'Cancelled', rejected: 'Not made — refunded' };
const sel = 'rounded-md border border-border bg-background p-2 text-sm';

function Allergies({ d, reload }: { d: any; reload: () => void }) {
  const [mine, setMine] = useState<string[]>(d.myAllergens);
  const save = async () => { try { await dining({ action: 'declare', allergens: mine as never }); toast('Saved. We will ask you to confirm before ordering anything that contains these.'); reload(); } catch (e) { toast(`! ${errMsg(e)}`); } };
  return (
    <Panel title="My allergens">
      <div className="flex flex-wrap gap-2 text-xs">{d.allergensList.map((a: string) => (
        <label key={a} className="flex items-center gap-1 rounded border border-border px-2 py-1"><input type="checkbox" checked={mine.includes(a)} onChange={(e) => setMine(e.target.checked ? [...mine, a] : mine.filter((x) => x !== a))} />{words(a)}</label>))}</div>
      <Button size="sm" className="mt-2" onClick={save}>Save allergens</Button>
      <p className="mt-1 text-xs text-muted-foreground">Kept for your orders only. Menus list declared allergens; always tell staff about severe allergies.</p>
    </Panel>
  );
}

function Order({ d, loc, reload }: { d: any; loc: any; reload: () => void }) {
  const [cart, setCart] = useState<Record<number, number>>({});
  const [term, setTerm] = useState(d.plans[0]?.term ?? '');
  const [tender, setTender] = useState<'swipe' | 'dollars'>('swipe');
  const [ack, setAck] = useState(false);
  const [key, setKey] = useState(() => crypto.randomUUID());
  const chosen = loc.items.filter((i: any) => cart[i.id]);
  const total = chosen.reduce((t: number, i: any) => t + i.priceCents * cart[i.id], 0);
  const warn = unacknowledged(chosen.map((i: any) => i.allergens), d.myAllergens, false);
  const place = async () => {
    try { await dining({ action: 'order', requestKey: key, locationId: loc.id, term, tender, items: chosen.map((i: any) => ({ item: i.id, qty: cart[i.id] })), acknowledgeAllergens: ack });
      toast('Order placed.'); setCart({}); setAck(false); setKey(crypto.randomUUID()); reload(); } catch (e) { toast(`! ${errMsg(e)}`); reload(); }
  };
  return (
    <div className="mt-2 space-y-2">
      <ul className="divide-y divide-border text-sm">{loc.items.map((i: any) => (
        <li key={i.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
          <span><span className="font-medium">{i.name}</span> · {money(i.priceCents)}{i.stock !== null ? ` · ${i.stock} left` : ''}
            <span className="block text-xs text-muted-foreground">{i.allergens.length ? `Contains: ${i.allergens.map(words).join(', ')}` : 'No listed allergens'}{i.dietary.length ? ` · ${i.dietary.join(', ')}` : ''}</span>
            {i.allergens.some((a: string) => d.myAllergens.includes(a)) && <span className="block text-xs font-medium">⚠ Contains your allergen</span>}</span>
          <Input aria-label={`Quantity of ${i.name}`} className="w-20" type="number" min={0} max={Math.min(10, i.stock ?? 10)} value={cart[i.id] ?? 0} disabled={!loc.open || i.stock === 0}
            onChange={(e) => setCart({ ...cart, [i.id]: Math.max(0, Math.min(10, Number(e.target.value))) })} />
        </li>))}</ul>
      {chosen.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <select aria-label="Meal plan term" className={sel} value={term} onChange={(e) => setTerm(e.target.value)}>{d.plans.map((p: any) => <option key={p.term} value={p.term}>{p.term} · {p.plan}</option>)}</select>
          <select aria-label="Pay with" className={sel} value={tender} onChange={(e) => setTender(e.target.value as never)}><option value="swipe">1 swipe</option><option value="dollars">{money(total)} dining dollars</option></select>
          {warn.length > 0 && <label className="flex items-center gap-1 text-xs"><input type="checkbox" checked={ack} onChange={(e) => setAck(e.target.checked)} />Contains {warn.map(words).join(', ')}, which I listed. Order anyway.</label>}
          <Button size="sm" disabled={!term || (warn.length > 0 && !ack)} onClick={place}>Place order</Button>
        </div>
      )}
    </div>
  );
}

function StaffOrders({ d, reload }: { d: any; reload: () => void }) {
  const [note, setNote] = useState<Record<number, string>>({});
  const go = async (o: any, step: 'prepare' | 'ready' | 'pick_up' | 'reject') => { try { await dining({ action: 'step', id: o.id, step, expectedVersion: o.version, note: note[o.id] ?? '' }); reload(); } catch (e) { toast(`! ${errMsg(e)}`); reload(); } };
  const open = d.queue.filter((o: any) => ['placed', 'preparing', 'ready'].includes(o.state));
  return (
    <Panel title={`Orders to fulfil · ${open.length}`}>
      {open.length ? <ul className="space-y-2">{open.map((o: any) => (
        <li key={o.id} className="rounded-md border border-border p-2 text-sm">
          <div className="flex flex-wrap items-center justify-between gap-2"><span className="font-medium">#{o.id} · {o.student} · {o.location}</span><Status value={STATE[o.state]} /></div>
          <p className="text-xs">{o.lines.map((l: any) => `${l.qty}× ${l.name}`).join(', ')}{o.allergenAck ? ' · ⚠ student confirmed an allergen' : ''}</p>
          <div className="mt-1 flex flex-wrap gap-2">
            {o.state === 'placed' && <Button size="sm" onClick={() => go(o, 'prepare')}>Start</Button>}
            {o.state === 'preparing' && <Button size="sm" onClick={() => go(o, 'ready')}>Ready</Button>}
            {o.state === 'ready' && <Button size="sm" onClick={() => go(o, 'pick_up')}>Picked up</Button>}
            {['placed', 'preparing'].includes(o.state) && <><Input aria-label="Reason" className="max-w-xs" placeholder="Reason (to reject)" value={note[o.id] ?? ''} onChange={(e) => setNote({ ...note, [o.id]: e.target.value })} />
              <Button size="sm" variant="outline" disabled={(note[o.id] ?? '').trim().length < 5} onClick={() => go(o, 'reject')}>Reject and refund</Button></>}
          </div>
        </li>))}</ul> : <Empty>No open orders.</Empty>}
    </Panel>
  );
}

function Manage({ d, reload }: { d: any; reload: () => void }) {
  const blankHours = Object.fromEntries(DAYS.map((_, i) => [String(i), i === 0 || i === 6 ? null : ['07:00', '20:00']]));
  const [loc, setLoc] = useState({ name: '', hours: blankHours as Record<string, [string, string] | null> });
  const [it, setIt] = useState({ locationId: d.locations[0]?.id ?? 0, name: '', price: 5, allergens: [] as string[], dietary: '', ingredients: '', stock: '' });
  const [plan, setPlan] = useState({ email: '', term: '', planName: '', swipes: 100, dollars: 200 });
  const [close, setClose] = useState({ locationId: d.locations[0]?.id ?? 0, date: d.today, swipes: 0, dollars: 0, note: '' });
  const run = async (body: any, done: string) => { try { await dining(body); toast(done); reload(); } catch (e) { toast(`! ${errMsg(e)}`); } };
  return (
    <>
      <Panel title="Locations and hours">
        <div className="grid gap-2 sm:grid-cols-2">
          <Input aria-label="Location name" placeholder="Location name" value={loc.name} onChange={(e) => setLoc({ ...loc, name: e.target.value })} />
          <div className="grid grid-cols-7 gap-1 text-[10px]">{DAYS.map((dn, i) => (
            <label key={dn} className="flex flex-col items-center"><span>{dn}</span><input type="checkbox" aria-label={`Open on ${dn}`} checked={!!loc.hours[String(i)]} onChange={(e) => setLoc({ ...loc, hours: { ...loc.hours, [String(i)]: e.target.checked ? ['07:00', '20:00'] : null } })} /></label>))}</div>
        </div>
        <p className="mt-1 text-xs text-muted-foreground">New locations open 07:00–20:00 on the ticked days ({d.timeZone}); edit a location to change times.</p>
        <Button size="sm" className="mt-2" disabled={loc.name.trim().length < 2} onClick={() => run({ action: 'location', id: null, name: loc.name, hours: loc.hours, active: true }, 'Location saved.')}>Add location</Button>
        <ul className="mt-2 space-y-1 text-xs">{d.locations.map((l: any) => <li key={l.id} className="flex flex-wrap items-center gap-2">{l.name} · {l.active ? (l.open ? 'open now' : 'closed now') : 'inactive'}
          <Button size="sm" variant="ghost" onClick={() => run({ action: 'location', id: l.id, name: l.name, hours: l.hours, active: !l.active }, 'Saved.')}>{l.active ? 'Deactivate' : 'Activate'}</Button></li>)}</ul>
      </Panel>
      <Panel title="Add a menu item">
        <div className="grid gap-2 sm:grid-cols-3">
          <select aria-label="Location" className={sel} value={it.locationId} onChange={(e) => setIt({ ...it, locationId: Number(e.target.value) })}>{d.locations.map((l: any) => <option key={l.id} value={l.id}>{l.name}</option>)}</select>
          <Input aria-label="Item name" placeholder="Item name" value={it.name} onChange={(e) => setIt({ ...it, name: e.target.value })} />
          <Input aria-label="Price in dollars" type="number" min={0} step={0.25} value={it.price} onChange={(e) => setIt({ ...it, price: Number(e.target.value) })} />
          <Input aria-label="Ingredients" className="sm:col-span-2" placeholder="Ingredients" value={it.ingredients} onChange={(e) => setIt({ ...it, ingredients: e.target.value })} />
          <Input aria-label="Stock" placeholder="Stock (blank = not tracked)" value={it.stock} onChange={(e) => setIt({ ...it, stock: e.target.value })} />
          <Input aria-label="Dietary tags" className="sm:col-span-3" placeholder="Dietary tags, comma separated (vegan, halal…)" value={it.dietary} onChange={(e) => setIt({ ...it, dietary: e.target.value })} />
        </div>
        <fieldset className="mt-2 flex flex-wrap gap-2 text-xs"><legend className="mb-1 font-medium">Allergens it contains</legend>{d.allergensList.map((a: string) => (
          <label key={a} className="flex items-center gap-1 rounded border border-border px-2 py-1"><input type="checkbox" checked={it.allergens.includes(a)} onChange={(e) => setIt({ ...it, allergens: e.target.checked ? [...it.allergens, a] : it.allergens.filter((x) => x !== a) })} />{words(a)}</label>))}</fieldset>
        <Button size="sm" className="mt-2" disabled={!it.locationId || it.name.trim().length < 2} onClick={() => run({ action: 'item', id: null, locationId: it.locationId, name: it.name, priceCents: Math.round(it.price * 100), allergens: it.allergens,
          dietary: it.dietary.split(',').map((x) => x.trim()).filter((x) => x.length >= 2), ingredients: it.ingredients, stock: it.stock.trim() === '' ? null : Math.max(0, Number(it.stock)), available: true }, 'Item added.')}>Add item</Button>
      </Panel>
      <Panel title="Set a meal plan">
        <div className="grid gap-2 sm:grid-cols-5">
          <Input aria-label="Student email" placeholder="Student email" value={plan.email} onChange={(e) => setPlan({ ...plan, email: e.target.value })} />
          <Input aria-label="Term" placeholder="Term" value={plan.term} onChange={(e) => setPlan({ ...plan, term: e.target.value })} />
          <Input aria-label="Plan name" placeholder="Plan name" value={plan.planName} onChange={(e) => setPlan({ ...plan, planName: e.target.value })} />
          <Input aria-label="Swipes" type="number" min={0} value={plan.swipes} onChange={(e) => setPlan({ ...plan, swipes: Number(e.target.value) })} />
          <Input aria-label="Dining dollars" type="number" min={0} value={plan.dollars} onChange={(e) => setPlan({ ...plan, dollars: Number(e.target.value) })} />
        </div>
        <Button size="sm" className="mt-2" disabled={!plan.email.includes('@') || plan.term.trim().length < 2 || plan.planName.trim().length < 2}
          onClick={() => run({ action: 'entitle', email: plan.email, term: plan.term, planName: plan.planName, swipes: plan.swipes, dollarsCents: Math.round(plan.dollars * 100) }, 'Meal plan set.')}>Set plan</Button>
        <p className="mt-1 text-xs text-muted-foreground">Sets the balance only. Charging for the plan is done by Student Accounts.</p>
      </Panel>
      <Panel title="Close a day">
        <div className="grid gap-2 sm:grid-cols-4">
          <select aria-label="Location" className={sel} value={close.locationId} onChange={(e) => setClose({ ...close, locationId: Number(e.target.value) })}>{d.locations.map((l: any) => <option key={l.id} value={l.id}>{l.name}</option>)}</select>
          <Input aria-label="Date" type="date" value={close.date} onChange={(e) => setClose({ ...close, date: e.target.value })} />
          <Input aria-label="Counted swipes" type="number" min={0} value={close.swipes} onChange={(e) => setClose({ ...close, swipes: Number(e.target.value) })} />
          <Input aria-label="Counted dining dollars" type="number" min={0} step={0.01} value={close.dollars} onChange={(e) => setClose({ ...close, dollars: Number(e.target.value) })} />
          <Input aria-label="Note" className="sm:col-span-4" placeholder="Note (required if your count differs)" value={close.note} onChange={(e) => setClose({ ...close, note: e.target.value })} />
        </div>
        <Button size="sm" className="mt-2" onClick={() => run({ action: 'close', locationId: close.locationId, date: close.date, swipes: close.swipes, dollarsCents: Math.round(close.dollars * 100), note: close.note }, 'Day closed.')}>Close day</Button>
        {d.closes.length > 0 && <ul className="mt-2 space-y-1 text-xs">{d.closes.map((c: any, i: number) => <li key={i}>{c.date} · {c.location} · system {c.expectedSwipes} swipes / {money(c.expectedCents)} · counted {c.countedSwipes} / {money(c.countedCents)}{c.note ? ` — ${c.note}` : ''}</li>)}</ul>}
      </Panel>
    </>
  );
}

function Access({ d, reload }: { d: any; reload: () => void }) {
  const [email, setEmail] = useState('');
  const set = async (on: boolean) => { try { await dining({ action: 'setStaff', email, on }); toast('Saved.'); setEmail(''); reload(); } catch (e) { toast(`! ${errMsg(e)}`); } };
  return (
    <Panel title="Dining staff">
      {d.staff.length ? <ul className="mb-2 space-y-1 text-sm">{d.staff.map((s: any, i: number) => <li key={i}>{s.name}</li>)}</ul> : <Empty>No dining staff yet.</Empty>}
      <div className="flex gap-2"><Input aria-label="Email" placeholder="Member’s email" value={email} onChange={(e) => setEmail(e.target.value)} />
        <Button size="sm" disabled={!email.includes('@')} onClick={() => set(true)}>Add</Button><Button size="sm" variant="outline" disabled={!email.includes('@')} onClick={() => set(false)}>Remove</Button></div>
    </Panel>
  );
}

export default function Dining() {
  const s = useLoad(() => dining({ action: 'get' }));
  const cancel = async (o: any) => { try { await dining({ action: 'step', id: o.id, step: 'cancel', expectedVersion: o.version }); toast('Cancelled and refunded.'); s.reload(); } catch (e) { toast(`! ${errMsg(e)}`); s.reload(); } };
  return (
    <>
      <PageHeader eyebrow="Campus" title="Dining" sub="Menus with allergens, ordering with your meal plan, and pickup." />
      <Loadable state={s}>{(d: any) => (
        <div className="space-y-4">
          <Panel title="My meal plan">{d.plans.length ? <ul className="space-y-1 text-sm">{d.plans.map((p: any) => <li key={p.term}>{p.term} · {p.plan} · {p.swipes} swipes · {money(p.dollarsCents)} dining dollars</li>)}</ul> : <Empty>You have no meal plan. Ask dining services to set one up.</Empty>}</Panel>
          {d.myOrders.length > 0 && <Panel title="My orders"><ul className="space-y-1 text-sm">{d.myOrders.map((o: any) => (
            <li key={o.id} className="flex flex-wrap items-center justify-between gap-2"><span>#{o.id} · {o.location} · {o.lines.map((l: any) => `${l.qty}× ${l.name}`).join(', ')} · {o.tender === 'swipe' ? '1 swipe' : money(o.totalCents)} · {fmt(o.createdAt)}{o.note ? ` — ${o.note}` : ''}</span>
              <span className="flex items-center gap-2"><Status value={STATE[o.state]} />{o.state === 'placed' && <Button size="sm" variant="outline" onClick={() => cancel(o)}>Cancel</Button>}</span></li>))}</ul></Panel>}
          {d.locations.length ? d.locations.filter((l: any) => l.active).map((l: any) => (
            <Panel key={l.id} title={`${l.name} · ${l.open ? 'Open now' : 'Closed now'}`}>
              <p className="text-xs text-muted-foreground">{DAYS.map((dn, i) => (l.hours[String(i)] ? `${dn} ${l.hours[String(i)][0]}–${l.hours[String(i)][1]}` : `${dn} closed`)).join(' · ')}</p>
              {l.items.length ? <Order d={d} loc={l} reload={s.reload} /> : <Empty>No menu yet.</Empty>}
            </Panel>)) : <Empty>No dining locations yet.</Empty>}
          <Allergies d={d} reload={s.reload} />
          {d.isStaff && <StaffOrders d={d} reload={s.reload} />}
          {d.isStaff && <Manage d={d} reload={s.reload} />}
          {d.isAdmin && <Access d={d} reload={s.reload} />}
        </div>
      )}</Loadable>
    </>
  );
}
