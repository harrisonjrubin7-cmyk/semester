import { FormEvent, useState } from 'react';
import { submitRequest, SubmitRequestInputType } from 'zitejs/api';
import { Button } from '@project/components/ui/button';
import { Input } from '@project/components/ui/input';
import { Textarea } from '@project/components/ui/textarea';
import { Label } from '@project/components/ui/label';
import { Checkbox } from '@project/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@project/components/ui/select';

type Kind = SubmitRequestInputType['kind'];
const KINDS: Kind[] = ['Demo request', 'Pilot request', 'Pricing request', 'Security document request', 'Accessibility feedback', 'Contact'];

/** Shared request form for the pilot, pricing, trust and contact pages. Errors are tied to their fields. */
export default function RequestForm({ kind: fixedKind, messageLabel = 'How can we help?', messagePlaceholder }: { kind?: Kind; messageLabel?: string; messagePlaceholder?: string }) {
  const [kind, setKind] = useState<Kind>(fixedKind ?? 'Contact');
  const [f, setF] = useState({ name: '', email: '', institution: '', role: '', message: '', website: '' });
  const [consent, setConsent] = useState(false);
  const [state, setState] = useState<'idle' | 'sending' | 'sent'>('idle');
  // One key per filled-in form: a retry after a timeout returns the same saved request instead of a second one.
  const [key] = useState(() => (globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`));
  const [receipt, setReceipt] = useState<{ reference: string; routing: 'routed' | 'pending' } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const set = (k: keyof typeof f) => (e: { target: { value: string } }) => setF({ ...f, [k]: e.target.value });
  const needsInstitution = kind === 'Pilot request';

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null); setState('sending');
    try {
      // Campaign tags from the link the visitor arrived with (utm_source / utm_medium / utm_campaign); the server sanitises them.
      const q = typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : null;
      const source = q ? { source: q.get('utm_source') ?? undefined, medium: q.get('utm_medium') ?? undefined, campaign: q.get('utm_campaign') ?? undefined } : undefined;
      const r = await submitRequest({ kind, ...f, consent, requestKey: key, source });
      setReceipt({ reference: r.reference, routing: r.routing });
      setState('sent');
    } catch (err) {
      setError(`${err instanceof Error ? err.message : 'That didn’t go through.'} Nothing was sent; your answers are still here, so you can try again.`);
      setState('idle');
    }
  };

  if (state === 'sent') {
    return (
      <div role="status" className="rounded-[3px] border border-border bg-card p-6">
        <p className="font-display text-xl">Thanks, {f.name.split(' ')[0] || 'we have it'}.</p>
        <p className="mt-2 text-muted-foreground">We saved your {kind.toLowerCase()} and will reply to {f.email}. We use your details only to answer this request.</p>
        {receipt && <p className="mt-2 text-sm">Reference <span className="font-medium">{receipt.reference}</span>{receipt.routing === 'pending' ? ' · Saved, and still being passed to our team. You don’t need to send it again.' : ' · Passed to our team.'}</p>}
      </div>
    );
  }
  return (
    <form onSubmit={submit} noValidate className="grid gap-4 rounded-[3px] border border-border bg-card p-6 sm:grid-cols-2" aria-describedby={error ? 'form-error' : undefined}>
      {!fixedKind && (
        <div className="sm:col-span-2">
          <Label htmlFor="rf-kind">What is this about?</Label>
          <Select value={kind} onValueChange={(v) => setKind(v as Kind)}>
            <SelectTrigger id="rf-kind" className="mt-1"><SelectValue /></SelectTrigger>
            <SelectContent>{KINDS.map((k) => <SelectItem key={k} value={k}>{k}</SelectItem>)}</SelectContent>
          </Select>
        </div>
      )}
      <div><Label htmlFor="rf-name">Your name</Label><Input id="rf-name" className="mt-1" autoComplete="name" required value={f.name} onChange={set('name')} /></div>
      <div><Label htmlFor="rf-email">Work email</Label><Input id="rf-email" className="mt-1" type="email" autoComplete="email" required value={f.email} onChange={set('email')} /></div>
      <div><Label htmlFor="rf-inst">Institution{needsInstitution ? '' : ' (optional)'}</Label><Input id="rf-inst" className="mt-1" autoComplete="organization" required={needsInstitution} value={f.institution} onChange={set('institution')} /></div>
      <div><Label htmlFor="rf-role">Role (optional)</Label><Input id="rf-role" className="mt-1" autoComplete="organization-title" placeholder="e.g. Registrar, VP Student Success" value={f.role} onChange={set('role')} /></div>
      <div className="sm:col-span-2"><Label htmlFor="rf-msg">{messageLabel}</Label><Textarea id="rf-msg" className="mt-1" rows={5} required value={f.message} onChange={set('message')} placeholder={messagePlaceholder} aria-describedby="rf-msg-note" /><p id="rf-msg-note" className="mt-1 text-xs text-muted-foreground">Please don’t include student records, health information, passwords or payment details.</p></div>
      {/* Honeypot: hidden from people and assistive technology. */}
      <div aria-hidden="true" className="absolute -left-[9999px] h-0 w-0 overflow-hidden"><label>Website<input tabIndex={-1} autoComplete="off" value={f.website} onChange={set('website')} /></label></div>
      <div className="flex items-start gap-2 sm:col-span-2">
        <Checkbox id="rf-consent" checked={consent} onCheckedChange={(v) => setConsent(v === true)} className="mt-0.5" />
        <Label htmlFor="rf-consent" className="text-sm font-normal leading-snug">You may reply to me about this request. (We don’t add you to a mailing list.)</Label>
      </div>
      {error && <p id="form-error" role="alert" className="text-sm text-destructive sm:col-span-2">! {error}</p>}
      <div className="sm:col-span-2"><Button type="submit" size="lg" disabled={state === 'sending'}>{state === 'sending' ? 'Sending…' : 'Send request'}</Button></div>
    </form>
  );
}
