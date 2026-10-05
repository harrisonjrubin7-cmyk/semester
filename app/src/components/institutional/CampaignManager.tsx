/**
 * The campaign manager: a school's enrollment and adoption campaigns, from
 * draft to active, on the tables in `20260928090000_gtm_foundation.sql`.
 *
 * What it shows is what the database will do. The release gate is the
 * server's own list (`gtm_activation_failures`), read fresh after every
 * change and written out as sentences, so Activate is offered exactly when
 * activating will work. Every write runs as the signed-in staff member under
 * RLS; an account without campaign rights sees an empty list and is told why.
 *
 * Audience criteria can only name the fields `TARGETABLE_FIELDS` allows —
 * public, or declared by the person — so there is no control that could
 * select a grade, an aid status or a protected trait. The database refuses
 * them too; this makes the refusal impossible to reach from here.
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { cloud } from '../../lib/cloud';
import { secondLine } from '../../lib/dim';
import {
  FUNNEL_STAGES, TARGETABLE_FIELDS, describeAudience, type AudienceCriterion, type FunnelStage, type ReviewKind,
} from '../../lib/gtm/campaign';
import {
  CHANNELS, MOVE_LABEL, NEXT, STATUS_LABEL, campaignApi, failureText, stageLabel,
  type CampaignApi, type CampaignChannel, type CampaignRow, type DraftPatch, type ReportRow, type ReviewRow,
} from '../../lib/gtm/manager';
import { campaignUrl, slugPart } from '../../lib/gtm/utm';
import { ActionButton, EmptyState, Notice, SectionLabel } from '../ui';

export interface CampaignManagerProps {
  tenantId: string;
  /** The signed-in account, to know whether they are a campaign's named approver. */
  viewerId: string | null;
  /** Injected in tests; defaults to Supabase under the viewer's RLS. */
  api?: CampaignApi;
}

const STAGES = Object.keys(FUNNEL_STAGES).map(Number) as FunnelStage[];
const FIELDS = Object.keys(TARGETABLE_FIELDS);
const quiet = { fontSize: 'var(--type-sm)', ...secondLine(), lineHeight: 'var(--leading-normal)' } as const;
const body = { fontSize: 'var(--type-base)', lineHeight: 'var(--leading-relaxed)' } as const;
const grid = { display: 'grid', gap: 'var(--sp-4)', marginBlock: 'var(--sp-4)' } as const;
const label = { display: 'grid', gap: 'var(--sp-2)', fontSize: 'var(--type-sm)' } as const;
const errorText = (e: unknown, fallback: string) => (e instanceof Error ? e.message : fallback);

export function CampaignManager({ tenantId, viewerId, api }: CampaignManagerProps) {
  const [client, setClient] = useState<CampaignApi | null>(api ?? null);
  const [rows, setRows] = useState<CampaignRow[]>([]);
  const [state, setState] = useState<'loading' | 'ready' | 'error'>('loading');
  const [message, setMessage] = useState('');
  const [picked, setPicked] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    if (api) return;
    let live = true;
    void cloud().then((db) => {
      if (live) setClient(campaignApi(db));
    }, () => {
      if (live) {
        setMessage('Campaigns need a connection to your school’s Semester project.');
        setState('error');
      }
    });
    return () => {
      live = false;
    };
  }, [api]);

  const refresh = useCallback(async () => {
    if (!client) return;
    try {
      setRows(await client.list());
      setState('ready');
    } catch (e) {
      setMessage(errorText(e, 'Could not load campaigns.'));
      setState('error');
    }
  }, [client]);

  useEffect(() => {
    if (!client) return;
    let live = true;
    client.list().then((r) => {
      if (!live) return;
      setRows(r);
      setState('ready');
    }, (e: unknown) => {
      if (!live) return;
      setMessage(errorText(e, 'Could not load campaigns.'));
      setState('error');
    });
    return () => {
      live = false;
    };
  }, [client]);

  if (state === 'loading') return <p role="status" style={body}>Loading campaigns…</p>;
  if (state === 'error' || !client) return <Notice alert>{message || 'Could not load campaigns.'}</Notice>;

  const row = rows.find((r) => r.id === picked) ?? null;
  if (row) {
    return (
      <CampaignDetail
        key={row.id}
        row={row}
        api={client}
        viewerId={viewerId}
        onBack={() => setPicked(null)}
        onChanged={refresh}
      />
    );
  }

  return (
    <section aria-label="Campaigns">
      <SectionLabel>Campaigns</SectionLabel>
      <p style={{ ...quiet, marginBottom: 'var(--sp-4)' }}>
        Your school’s enrollment and adoption campaigns. A campaign goes live only once three people other than
        its owner have reviewed it, its approver has signed off, and every item on its release checklist is done.
      </p>

      {creating ? (
        <NewCampaignForm
          tenantId={tenantId}
          api={client}
          onCancel={() => setCreating(false)}
          onCreated={async (id) => {
            setCreating(false);
            await refresh();
            setPicked(id);
          }}
        />
      ) : (
        <ActionButton tone="primary" onClick={() => setCreating(true)} style={{ marginBottom: 'var(--sp-5)' }}>
          New campaign
        </ActionButton>
      )}

      {rows.length === 0 ? (
        <EmptyState
          inline
          title="No campaigns yet"
          body="Nothing here is visible to your account yet. Campaigns appear here for staff with campaign rights at your school."
        />
      ) : (
        <ul style={{ listStyle: 'none', padding: 0 }}>
          {rows.map((r) => (
            <li key={r.id} style={{ borderTop: '1px solid var(--app-line)' }}>
              <button
                type="button"
                className="btn btn-ghost btn-block"
                style={{ justifyContent: 'space-between', textAlign: 'left', paddingBlock: 'var(--sp-4)' }}
                onClick={() => setPicked(r.id)}
              >
                <span>
                  <span style={{ display: 'block', ...body }}>{r.name}</span>
                  <span style={quiet}>
                    {stageLabel(r.funnel_stage)} · {r.start_date} to {r.end_date}
                  </span>
                </span>
                <span style={quiet}>{STATUS_LABEL[r.status]}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function NewCampaignForm({
  tenantId, api, onCancel, onCreated,
}: {
  tenantId: string;
  api: CampaignApi;
  onCancel: () => void;
  onCreated: (id: string) => void | Promise<void>;
}) {
  const [name, setName] = useState('');
  const [objective, setObjective] = useState('');
  const [cycle, setCycle] = useState('');
  const [audience, setAudience] = useState('');
  const [stage, setStage] = useState<FunnelStage>(3);
  const [channels, setChannels] = useState<CampaignChannel[]>(['email']);
  const [start, setStart] = useState('');
  const [end, setEnd] = useState('');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);

  return (
    <form
      aria-label="New campaign"
      style={{ ...grid, marginBottom: 'var(--sp-6)' }}
      onSubmit={(e) => {
        e.preventDefault();
        setBusy(true);
        setNote('');
        api
          .create({
            tenantId, name: name.trim(), objective: slugPart(objective), cycle: slugPart(cycle),
            audience: slugPart(audience), funnelStage: stage, channels, startDate: start, endDate: end,
          })
          .then(onCreated, (err: unknown) => setNote(errorText(err, 'Could not create the campaign.')))
          .finally(() => setBusy(false));
      }}
    >
      <label style={label}>
        Name
        <input className="input" required value={name} onChange={(e) => setName(e.target.value)} />
      </label>
      <label style={label}>
        Objective (one word or phrase, used in links)
        <input className="input" required value={objective} placeholder="deposit" onChange={(e) => setObjective(e.target.value)} />
      </label>
      <label style={label}>
        Cycle
        <input className="input" required value={cycle} placeholder="fall2027" onChange={(e) => setCycle(e.target.value)} />
      </label>
      <label style={label}>
        Audience name
        <input className="input" required value={audience} placeholder="admitted" onChange={(e) => setAudience(e.target.value)} />
      </label>
      <label style={label}>
        Funnel stage
        <select className="input" value={stage} onChange={(e) => setStage(Number(e.target.value) as FunnelStage)}>
          {STAGES.map((s) => (
            <option key={s} value={s}>
              {stageLabel(s)}
            </option>
          ))}
        </select>
      </label>
      <fieldset style={{ border: 0, padding: 0 }}>
        <legend style={{ fontSize: 'var(--type-sm)' }}>Channels</legend>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--sp-4)' }}>
          {CHANNELS.map((c) => (
            <label key={c} style={{ display: 'flex', gap: 'var(--sp-2)', alignItems: 'center', fontSize: 'var(--type-sm)' }}>
              <input
                type="checkbox"
                checked={channels.includes(c)}
                onChange={(e) => setChannels(e.target.checked ? [...channels, c] : channels.filter((x) => x !== c))}
              />
              {c}
            </label>
          ))}
        </div>
      </fieldset>
      <label style={label}>
        Starts
        <input className="input" type="date" required value={start} onChange={(e) => setStart(e.target.value)} />
      </label>
      <label style={label}>
        Ends
        <input className="input" type="date" required value={end} onChange={(e) => setEnd(e.target.value)} />
      </label>
      {note && <Notice alert>{note}</Notice>}
      <div style={{ display: 'flex', gap: 'var(--sp-4)' }}>
        <button type="submit" className="btn btn-primary btn-block" disabled={busy || channels.length === 0}>
          {busy ? 'Creating…' : 'Create draft'}
        </button>
        <ActionButton onClick={onCancel}>Cancel</ActionButton>
      </div>
    </form>
  );
}

function CampaignDetail({
  row, api, viewerId, onBack, onChanged,
}: {
  row: CampaignRow;
  api: CampaignApi;
  viewerId: string | null;
  onBack: () => void;
  onChanged: () => Promise<void>;
}) {
  const [draft, setDraft] = useState<CampaignRow>(row);
  const [failures, setFailures] = useState<string[] | null>(null);
  const [count, setCount] = useState<number | null | undefined>(undefined);
  const [reviews, setReviews] = useState<ReviewRow[]>([]);
  const [report, setReport] = useState<ReportRow[] | null>(null);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const editable = row.status === 'draft';

  const fetchAll = useCallback(
    () =>
      Promise.all([
        api.failures(row.id).catch(() => null),
        api.audienceCount(row.id),
        api.reviews(row.id).catch(() => [] as ReviewRow[]),
        row.status === 'active' || row.status === 'paused' || row.status === 'completed'
          ? api.report(row.id).catch(() => null)
          : Promise.resolve(null),
      ]),
    [api, row.id, row.status],
  );
  const apply = ([f, c, r, rep]: Awaited<ReturnType<typeof fetchAll>>) => {
    setFailures(f);
    setCount(c);
    setReviews(r);
    setReport(rep);
  };
  const load = async () => apply(await fetchAll());

  useEffect(() => {
    let live = true;
    fetchAll().then((all) => {
      if (live) apply(all);
    });
    return () => {
      live = false;
    };
  }, [fetchAll]);

  const set = <K extends keyof CampaignRow>(k: K, v: CampaignRow[K]) => setDraft((d) => ({ ...d, [k]: v }));

  const act = async (fn: () => Promise<void>, fallback: string) => {
    setBusy(true);
    setNote('');
    try {
      await fn();
      await onChanged();
    } catch (e) {
      setNote(errorText(e, fallback));
    } finally {
      setBusy(false);
    }
  };

  const save = () => {
    const patch: DraftPatch = {
      name: draft.name, audience_criteria: draft.audience_criteria, channels: draft.channels,
      start_date: draft.start_date, end_date: draft.end_date, review_date: draft.review_date || null,
      primary_cta: draft.primary_cta, approver_id: draft.approver_id || null, privacy_basis: draft.privacy_basis,
      consent_requirements: draft.consent_requirements, frequency_max: draft.frequency_max,
      frequency_window_days: draft.frequency_window_days, landing_page: draft.landing_page || null,
      success_metric: draft.success_metric, baseline: draft.baseline || null, escalation_path: draft.escalation_path,
      claims_substantiated: draft.claims_substantiated, opt_out_tested: draft.opt_out_tested,
      conversion_instrumentation_tested: draft.conversion_instrumentation_tested,
    };
    return act(() => api.save(row.id, patch), 'Could not save.');
  };

  const moves = NEXT[row.status].filter((to) => to !== 'approved' || (viewerId !== null && viewerId === row.approver_id));
  const text = (k: keyof CampaignRow, title: string, hint?: string) => (
    <label style={label}>
      {title}
      {hint && <span style={quiet}>{hint}</span>}
      <input
        className="input"
        disabled={!editable}
        value={(draft[k] as string | null) ?? ''}
        onChange={(e) => set(k, e.target.value as never)}
      />
    </label>
  );
  const tick = (k: 'claims_substantiated' | 'opt_out_tested' | 'conversion_instrumentation_tested', title: string) => (
    <label style={{ display: 'flex', gap: 'var(--sp-3)', alignItems: 'center', fontSize: 'var(--type-sm)' }}>
      <input type="checkbox" disabled={!editable} checked={draft[k]} onChange={(e) => set(k, e.target.checked)} />
      {title}
    </label>
  );

  return (
    <section aria-label={`Campaign: ${row.name}`}>
      <ActionButton tone="ghost" onClick={onBack} style={{ marginBottom: 'var(--sp-4)' }}>
        ← All campaigns
      </ActionButton>
      <SectionLabel aside={STATUS_LABEL[row.status]}>{row.name}</SectionLabel>
      <p style={quiet}>
        {stageLabel(row.funnel_stage)} — {FUNNEL_STAGES[row.funnel_stage].conversion} · {row.start_date} to {row.end_date}
      </p>
      {!editable && (
        <p style={{ ...quiet, marginTop: 'var(--sp-3)' }}>
          Only a draft can be changed. Returning it to draft means every review has to be done again.
        </p>
      )}

      <SectionLabel style={{ marginTop: 'var(--sp-6)' }}>Release checklist</SectionLabel>
      {failures === null ? (
        <p style={quiet}>The release checklist could not be read.</p>
      ) : failures.length === 0 ? (
        <Notice>Every item is done. This campaign can be activated.</Notice>
      ) : (
        <ul aria-label="Still to do before activation" style={{ paddingLeft: 'var(--sp-5)', ...body }}>
          {failures.map((f) => (
            <li key={f}>{failureText(f)}</li>
          ))}
        </ul>
      )}

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--sp-3)', marginBlock: 'var(--sp-4)' }}>
        {moves.map((to) => (
          <ActionButton
            key={to}
            tone={to === 'active' || to === 'approved' ? 'primary' : 'secondary'}
            disabled={busy || (to === 'active' && (failures === null || failures.length > 0))}
            onClick={() => void act(() => api.move(row.id, to), 'Could not move the campaign.')}
            style={{ flex: '1 1 auto', width: 'auto' }}
          >
            {MOVE_LABEL[to]}
          </ActionButton>
        ))}
      </div>
      {note && <Notice alert>{note}</Notice>}

      <SectionLabel style={{ marginTop: 'var(--sp-6)' }}>Audience</SectionLabel>
      <p style={body}>{describeAudience(draft.audience_criteria)}.</p>
      <p style={quiet}>
        {count === undefined ? 'Counting…' : count === null ? 'The count is not available to your account.' : `${count} contacts match today.`}
      </p>
      <AudienceEditor
        criteria={draft.audience_criteria}
        editable={editable}
        onChange={(c) => set('audience_criteria', c)}
      />

      <SectionLabel style={{ marginTop: 'var(--sp-6)' }}>Details</SectionLabel>
      <div style={grid}>
        {text('name', 'Name')}
        {text('primary_cta', 'The one action it asks for')}
        {text('privacy_basis', 'Privacy basis', 'Why contacting this audience is lawful and expected.')}
        <label style={label}>
          Consent versions a recipient must have given
          <span style={quiet}>Separated by commas, for example email-v2, sms-v3.</span>
          <input
            className="input"
            disabled={!editable}
            value={draft.consent_requirements.join(', ')}
            onChange={(e) => set('consent_requirements', e.target.value.split(',').map((s) => s.trim()).filter(Boolean))}
          />
        </label>
        <div style={{ display: 'flex', gap: 'var(--sp-4)' }}>
          <label style={{ ...label, flex: 1 }}>
            At most this many messages
            <input
              className="input" type="number" min={1} max={50} disabled={!editable}
              value={draft.frequency_max ?? ''}
              onChange={(e) => set('frequency_max', e.target.value ? Number(e.target.value) : null)}
            />
          </label>
          <label style={{ ...label, flex: 1 }}>
            Over this many days
            <input
              className="input" type="number" min={1} max={90} disabled={!editable}
              value={draft.frequency_window_days ?? ''}
              onChange={(e) => set('frequency_window_days', e.target.value ? Number(e.target.value) : null)}
            />
          </label>
        </div>
        {text('success_metric', 'Success metric')}
        {text('baseline', 'Baseline', 'Where that metric stands today, for comparison.')}
        {text('escalation_path', 'Who to contact if something goes wrong')}
        <label style={label}>
          Review date
          <span style={quiet}>On or after the end date, when the results are read.</span>
          <input
            className="input" type="date" disabled={!editable} value={draft.review_date ?? ''}
            onChange={(e) => set('review_date', e.target.value || null)}
          />
        </label>
        {text('approver_id', 'Approver’s account ID', 'Someone at your school with campaign review rights, who is not you.')}
        {tick('claims_substantiated', 'Every claim in this campaign can be substantiated')}
        {tick('opt_out_tested', 'The opt-out has been tested')}
        {tick('conversion_instrumentation_tested', 'The conversion tracking has been tested')}
      </div>

      <LinkBuilder row={draft} tenantId={row.tenant_id} editable={editable} onUse={(url) => set('landing_page', url)} />

      {editable && (
        <ActionButton tone="primary" disabled={busy} onClick={() => void save()} style={{ marginTop: 'var(--sp-4)' }}>
          {busy ? 'Saving…' : 'Save draft'}
        </ActionButton>
      )}

      <Reviews row={row} api={api} reviews={reviews} onRecorded={async () => {
        await load();
        await onChanged();
      }} />

      {report && (
        <>
          <SectionLabel style={{ marginTop: 'var(--sp-6)' }}>Results</SectionLabel>
          <p style={quiet}>Counts under ten are not shown, so no one can be picked out.</p>
          <table style={{ width: '100%', ...body }}>
            <caption style={{ ...quiet, textAlign: 'left' }}>Results for {row.name}</caption>
            <thead>
              <tr>
                <th scope="col" style={{ textAlign: 'left' }}>Measure</th>
                <th scope="col" style={{ textAlign: 'right' }}>Count</th>
              </tr>
            </thead>
            <tbody>
              {report.map((r) => (
                <tr key={r.metric}>
                  <td>{r.metric.replace(/_/g, ' ')}</td>
                  <td style={{ textAlign: 'right' }}>{r.value === null ? 'fewer than 10' : r.value}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}
    </section>
  );
}

function AudienceEditor({
  criteria, editable, onChange,
}: {
  criteria: AudienceCriterion[];
  editable: boolean;
  onChange: (c: AudienceCriterion[]) => void;
}) {
  const [field, setField] = useState(FIELDS[0]);
  const [value, setValue] = useState('');

  return (
    <div style={{ marginBlock: 'var(--sp-4)' }}>
      <p style={quiet}>
        Only public fields, or ones a person gave you themselves, can be used. Grades, financial aid, health,
        disability, conduct and protected traits are not offered, and the database refuses them.
      </p>
      {criteria.length > 0 && (
        <ul style={{ listStyle: 'none', padding: 0, marginBlock: 'var(--sp-3)' }}>
          {criteria.map((c, i) => (
            <li key={`${c.field}-${i}`} style={{ display: 'flex', justifyContent: 'space-between', gap: 'var(--sp-3)', ...body }}>
              <span>{describeAudience([c])}</span>
              {editable && (
                <button type="button" className="btn btn-ghost" onClick={() => onChange(criteria.filter((_, j) => j !== i))}>
                  Remove
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
      {editable && (
        <div style={{ display: 'grid', gap: 'var(--sp-3)' }}>
          <label style={label}>
            Field
            <select className="input" value={field} onChange={(e) => setField(e.target.value)}>
              {FIELDS.map((f) => (
                <option key={f} value={f}>
                  {f.replace(/_/g, ' ')}
                </option>
              ))}
            </select>
          </label>
          <label style={label}>
            Is
            <span style={quiet}>One value, or several separated by commas.</span>
            <input className="input" value={value} onChange={(e) => setValue(e.target.value)} />
          </label>
          <button
            type="button"
            className="btn btn-secondary"
            disabled={!value.trim()}
            onClick={() => {
              const values = value.split(',').map((s) => s.trim()).filter(Boolean);
              onChange([...criteria, values.length > 1 ? { field, op: 'in', value: values } : { field, op: 'eq', value: values[0] }]);
              setValue('');
            }}
          >
            Add condition
          </button>
        </div>
      )}
    </div>
  );
}

function LinkBuilder({
  row, tenantId, editable, onUse,
}: {
  row: CampaignRow;
  tenantId: string;
  editable: boolean;
  onUse: (url: string) => void;
}) {
  const [base, setBase] = useState('');
  const [source, setSource] = useState('email');
  const [medium, setMedium] = useState('email');
  const [content, setContent] = useState('');

  const built = useMemo(() => {
    if (!base.trim()) return { url: '', error: '' };
    try {
      return {
        url: campaignUrl(base.trim(), {
          source, medium, tenant: tenantId, cycle: row.cycle, audience: row.audience, objective: row.objective,
          content: content || undefined,
        }),
        error: '',
      };
    } catch (e) {
      return { url: '', error: errorText(e, 'That address cannot carry a campaign link.') };
    }
  }, [base, source, medium, content, tenantId, row.cycle, row.audience, row.objective]);

  return (
    <div style={{ marginTop: 'var(--sp-6)' }}>
      <SectionLabel>Landing page</SectionLabel>
      <p style={body}>{row.landing_page ?? 'None yet.'}</p>
      {editable && (
        <div style={grid}>
          <p style={quiet}>
            Every campaign link carries the same attribution, so results can be read back by campaign. Paste the
            page address and this adds it.
          </p>
          <label style={label}>
            Page address
            <input className="input" type="url" value={base} placeholder="https://" onChange={(e) => setBase(e.target.value)} />
          </label>
          <div style={{ display: 'flex', gap: 'var(--sp-4)' }}>
            <label style={{ ...label, flex: 1 }}>
              Source
              <input className="input" value={source} onChange={(e) => setSource(e.target.value)} />
            </label>
            <label style={{ ...label, flex: 1 }}>
              Medium
              <input className="input" value={medium} onChange={(e) => setMedium(e.target.value)} />
            </label>
          </div>
          <label style={label}>
            Variant (optional)
            <input className="input" value={content} onChange={(e) => setContent(e.target.value)} />
          </label>
          {built.error && <p role="status" style={quiet}>{built.error}</p>}
          {built.url && (
            <>
              <code style={{ ...quiet, wordBreak: 'break-all' }}>{built.url}</code>
              <button type="button" className="btn btn-secondary" onClick={() => onUse(built.url)}>
                Use as the landing page
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}

const KINDS: ReviewKind[] = ['privacy', 'accessibility', 'brand'];

function Reviews({
  row, api, reviews, onRecorded,
}: {
  row: CampaignRow;
  api: CampaignApi;
  reviews: ReviewRow[];
  onRecorded: () => Promise<void>;
}) {
  const [kind, setKind] = useState<ReviewKind>('privacy');
  const [decision, setDecision] = useState<ReviewRow['decision']>('approved');
  const [text, setText] = useState('');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);

  return (
    <div style={{ marginTop: 'var(--sp-6)' }}>
      <SectionLabel>Reviews</SectionLabel>
      {reviews.length === 0 ? (
        <p style={quiet}>No reviews recorded.</p>
      ) : (
        <ul style={{ listStyle: 'none', padding: 0 }}>
          {reviews.map((r) => (
            <li key={r.id} style={{ ...body, paddingBlock: 'var(--sp-2)' }}>
              {r.kind}: {r.decision === 'approved' ? 'approved' : 'changes requested'}
              <span style={quiet}> · {r.recorded_at.slice(0, 10)}{r.note ? ` · ${r.note}` : ''}</span>
            </li>
          ))}
        </ul>
      )}
      {row.status === 'in_review' && (
        <form
          aria-label="Record a review"
          style={grid}
          onSubmit={(e) => {
            e.preventDefault();
            setBusy(true);
            setNote('');
            api
              .review(row, kind, decision, text.trim())
              .then(async () => {
                setText('');
                await onRecorded();
              }, (err: unknown) => setNote(errorText(err, 'Could not record the review.')))
              .finally(() => setBusy(false));
          }}
        >
          <label style={label}>
            Review
            <select className="input" value={kind} onChange={(e) => setKind(e.target.value as ReviewKind)}>
              {KINDS.map((k) => (
                <option key={k} value={k}>
                  {k}
                </option>
              ))}
            </select>
          </label>
          <label style={label}>
            Decision
            <select className="input" value={decision} onChange={(e) => setDecision(e.target.value as ReviewRow['decision'])}>
              <option value="approved">Approved</option>
              <option value="changes_requested">Changes requested</option>
            </select>
          </label>
          <label style={label}>
            Note
            <input className="input" value={text} onChange={(e) => setText(e.target.value)} />
          </label>
          {note && <Notice alert>{note}</Notice>}
          <button type="submit" className="btn btn-secondary btn-block" disabled={busy}>
            {busy ? 'Recording…' : 'Record review'}
          </button>
        </form>
      )}
    </div>
  );
}
