/**
 * The Configuration Studio: a school's own settings, eleven domains, each a
 * draft that a second person publishes as a numbered version (D-1011), on the
 * table in `20260930230000_configuration_studio.sql`.
 *
 * What it shows is what the database will do. The check on a value is
 * `problems` from `lib/config/studio.ts`, which mirrors `private.config_spec()`;
 * Publish is offered only when `publishBlocker` is empty, and if the two ever
 * disagreed the database's refusal is shown in the same sentences.
 *
 * It says, on its first screen, that nothing in the app reads these settings
 * yet. A setting is recorded, versioned and audited here; it is applied when
 * the feature it describes is connected to `effectiveConfig`, one domain at a
 * time. A screen that let a school believe otherwise would be the overclaim
 * this repository keeps removing.
 */
import { useCallback, useEffect, useState } from 'react';
import { configApi, type ConfigApi } from '../../lib/config/api';
import {
  CHOICE_LABEL, DEFAULTS, DOMAINS, DOMAIN_ABOUT, DOMAIN_LABEL, SETTING_HINT, SETTING_LABEL, SPEC,
  current, diff, draftOf, effectiveConfig, history, problemText, problems, publishBlocker, show,
  type ConfigDomain, type ConfigVersion, type Settings, type SettingSpec, type Value,
} from '../../lib/config/studio';
import { cloud } from '../../lib/cloud';
import { secondLine } from '../../lib/dim';
import { formatDateTime } from '../../lib/locale';
import { ActionButton, EmptyState, Notice, SectionLabel } from '../ui';

export interface ConfigurationStudioProps {
  tenantId: string;
  /** The signed-in account: whoever drafted a configuration does not publish it. */
  viewerId: string | null;
  /** The account's verified capabilities at this school. */
  holds: readonly string[];
  /** Injected in tests; defaults to Supabase under the viewer's RLS. */
  api?: ConfigApi;
}

const quiet = { fontSize: 'var(--type-sm)', ...secondLine(), lineHeight: 'var(--leading-normal)' } as const;
const body = { fontSize: 'var(--type-base)', lineHeight: 'var(--leading-relaxed)' } as const;
const grid = { display: 'grid', gap: 'var(--sp-4)', marginBlock: 'var(--sp-4)' } as const;
const label = { display: 'grid', gap: 'var(--sp-2)', fontSize: 'var(--type-sm)' } as const;
const inline = { display: 'flex', gap: 'var(--sp-2)', alignItems: 'center', fontSize: 'var(--type-sm)' } as const;
const errorText = (e: unknown, fallback: string) => (e instanceof Error ? e.message : fallback);
const when = (iso: string) => formatDateTime(iso, { dateStyle: 'medium', timeStyle: 'short' });

export function ConfigurationStudio({ tenantId, viewerId, holds, api }: ConfigurationStudioProps) {
  const [client, setClient] = useState<ConfigApi | null>(api ?? null);
  const [rows, setRows] = useState<ConfigVersion[]>([]);
  const [state, setState] = useState<'loading' | 'ready' | 'error'>('loading');
  const [message, setMessage] = useState('');
  const [picked, setPicked] = useState<ConfigDomain | null>(null);
  // Held here, not in the editor: a save reloads the rows, which starts the editor's form over.
  const [notice, setNotice] = useState('');

  useEffect(() => {
    if (api) return;
    let live = true;
    void cloud().then((db) => {
      if (live) setClient(configApi(db));
    }, () => {
      if (live) {
        setMessage('The Configuration Studio needs a connection to your school’s Semester project.');
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
      setRows(await client.list(tenantId));
      setState('ready');
    } catch (e) {
      setMessage(errorText(e, 'Could not load the configuration.'));
      setState('error');
    }
  }, [client, tenantId]);

  useEffect(() => {
    if (!client) return;
    let live = true;
    client.list(tenantId).then((r) => {
      if (!live) return;
      setRows(r);
      setState('ready');
    }, (e: unknown) => {
      if (!live) return;
      setMessage(errorText(e, 'Could not load the configuration.'));
      setState('error');
    });
    return () => {
      live = false;
    };
  }, [client, tenantId]);

  if (state === 'loading') return <p role="status" style={body}>Loading configuration…</p>;
  if (state === 'error' || !client) return <Notice alert>{message || 'Could not load the configuration.'}</Notice>;

  if (picked) {
    return (
      <DomainEditor
        // A new version or draft is a new starting point for the form.
        key={`${picked}:${draftOf(rows, picked)?.updated_at ?? 'none'}:${current(rows, picked)?.version ?? 0}`}
        domain={picked}
        rows={rows}
        tenantId={tenantId}
        viewerId={viewerId}
        holds={holds}
        api={client}
        notice={notice}
        onBack={() => {
          setPicked(null);
          setNotice('');
        }}
        onChanged={async (done) => {
          setNotice(done);
          await refresh();
        }}
      />
    );
  }

  const effective = effectiveConfig(rows);
  return (
    <section aria-label="Configuration Studio">
      <SectionLabel>Configuration Studio</SectionLabel>
      <p style={{ ...quiet, marginBottom: 'var(--sp-4)' }}>
        The choices your school makes about its own Semester, in eleven domains. A change is a draft; a colleague who
        holds the publish role publishes it as a numbered version, and every version stays so it can be read or
        rolled back to.
      </p>
      <Notice>
        Nothing in the app reads these settings yet. They are recorded, reviewed, versioned and audited here, and each
        domain takes effect when the feature it describes is connected to it. Until then, Semester runs on its own
        defaults, which are shown beside every setting.
      </Notice>

      <ul style={{ listStyle: 'none', padding: 0, marginTop: 'var(--sp-4)' }}>
        {DOMAINS.map((d) => {
          const now = current(rows, d);
          const draft = draftOf(rows, d);
          const set = Object.keys(now?.settings ?? {}).length;
          return (
            <li key={d} style={{ borderTop: '1px solid var(--app-line)' }}>
              <button
                type="button"
                className="btn btn-ghost btn-block"
                style={{ justifyContent: 'space-between', textAlign: 'left', paddingBlock: 'var(--sp-4)' }}
                onClick={() => setPicked(d)}
              >
                <span>
                  <span style={{ display: 'block', ...body }}>{DOMAIN_LABEL[d]}</span>
                  <span style={quiet}>{DOMAIN_ABOUT[d]}</span>
                </span>
                <span style={{ ...quiet, textAlign: 'right' }}>
                  {now ? `Version ${now.version} · ${set} set` : 'Platform defaults'}
                  {draft ? ' · draft waiting' : ''}
                  <span className="sr-only"> ({Object.keys(effective[d]).length} settings in effect)</span>
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

// ── One domain ──────────────────────────────────────────────────────────────

function DomainEditor({
  domain, rows, tenantId, viewerId, holds, api, notice, onBack, onChanged,
}: {
  domain: ConfigDomain;
  rows: ConfigVersion[];
  tenantId: string;
  viewerId: string | null;
  holds: readonly string[];
  api: ConfigApi;
  notice: string;
  onBack: () => void;
  onChanged: (done: string) => Promise<void>;
}) {
  const now = current(rows, domain);
  const draft = draftOf(rows, domain);
  const canDraft = holds.includes('config:manage');
  const [values, setValues] = useState<Settings>({ ...(draft?.settings ?? now?.settings ?? {}) });
  const [note, setNote] = useState(draft?.note ?? '');
  const [basedOn, setBasedOn] = useState<number | null>(draft?.based_on ?? now?.version ?? null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState(notice);

  const wrong = problems(domain, values);
  const blocker = draft ? publishBlocker(draft, viewerId, holds) : null;
  const dirty = JSON.stringify(values) !== JSON.stringify(draft?.settings ?? now?.settings ?? {}) || note !== (draft?.note ?? '');
  const changes = diff(domain, now?.settings ?? {}, values);

  const act = async (what: () => Promise<void>, done: string) => {
    setBusy(true);
    setMessage('');
    try {
      await what();
      setMessage(done);
      await onChanged(done);
    } catch (e) {
      setMessage(errorText(e, 'That did not work.'));
    } finally {
      setBusy(false);
    }
  };

  const set = (key: string, v: Value | undefined) =>
    setValues((prev) => {
      const next = { ...prev };
      if (v === undefined) delete next[key];
      else next[key] = v;
      return next;
    });

  return (
    <section aria-label={DOMAIN_LABEL[domain]}>
      <ActionButton onClick={onBack} style={{ marginBottom: 'var(--sp-4)' }}>All domains</ActionButton>
      <SectionLabel>{DOMAIN_LABEL[domain]}</SectionLabel>
      <p style={quiet}>{DOMAIN_ABOUT[domain]}</p>
      <p style={{ ...quiet, marginTop: 'var(--sp-2)' }}>
        {now
          ? `In force: version ${now.version}, published ${now.published_at ? when(now.published_at) : ''}.`
          : 'No version published. Semester runs on its defaults.'}
        {draft ? ' A draft is waiting.' : ''}
      </p>

      <form
        aria-label={`${DOMAIN_LABEL[domain]} settings`}
        style={grid}
        onSubmit={(e) => {
          e.preventDefault();
          void act(() => api.saveDraft(tenantId, domain, values, note, basedOn, draft), 'Draft saved.');
        }}
      >
        {Object.entries(SPEC[domain]).map(([key, spec]) => (
          <Field
            key={key}
            name={key}
            spec={spec}
            value={values[key]}
            fallback={DEFAULTS[domain][key]}
            disabled={!canDraft || busy}
            onChange={(v) => set(key, v)}
          />
        ))}

        <label style={label}>
          Note for the reviewer
          <input
            className="input"
            maxLength={500}
            value={note}
            disabled={!canDraft || busy}
            placeholder="What changed and why"
            onChange={(e) => setNote(e.target.value)}
          />
        </label>

        {wrong.length > 0 && (
          <Notice alert>
            {wrong.map(problemText).join(' ')}
          </Notice>
        )}
        {changes.length > 0 && (
          <div>
            <p style={quiet}>{now ? `Changes from version ${now.version}:` : 'Changes from the defaults:'}</p>
            <ul style={{ ...quiet, paddingLeft: 'var(--sp-5)' }}>
              {changes.map((c) => (
                <li key={c.key}>{SETTING_LABEL[c.key]}: {show(c.from ?? DEFAULTS[domain][c.key])} → {show(c.to ?? DEFAULTS[domain][c.key])}{c.to === undefined ? ' (default)' : ''}</li>
              ))}
            </ul>
          </div>
        )}
        {message && <Notice alert={/cannot|not |outside|already/i.test(message)}>{message}</Notice>}

        {canDraft ? (
          <div style={{ display: 'flex', gap: 'var(--sp-4)', flexWrap: 'wrap' }}>
            <button type="submit" className="btn btn-primary" disabled={busy || wrong.length > 0 || !dirty}>
              {draft ? 'Save draft' : 'Start a draft'}
            </button>
            {draft && (
              <ActionButton disabled={busy} onClick={() => void act(async () => {
                await api.discardDraft(draft.id);
                setValues({ ...(now?.settings ?? {}) });
                setNote('');
                setBasedOn(now?.version ?? null);
              }, 'Draft discarded.')}
              >
                Discard draft
              </ActionButton>
            )}
          </div>
        ) : (
          <p style={quiet}>Your account can read this configuration and cannot draft changes.</p>
        )}
      </form>

      {draft && holds.includes('config:publish') && (
        <div style={{ marginBlock: 'var(--sp-5)' }}>
          {dirty && <p style={quiet}>Save the draft first: a draft is published as it was reviewed.</p>}
          {blocker && <p style={quiet}>{blocker}</p>}
          <ActionButton
            tone="primary"
            disabled={busy || dirty || blocker !== null}
            onClick={() => void act(() => api.publish(draft), 'Published.')}
          >
            Publish as version {(now?.version ?? 0) + 1}
          </ActionButton>
        </div>
      )}

      <History domain={domain} rows={rows} canDraft={canDraft && !draft} busy={busy} onRestore={(v) => {
        setValues({ ...v.settings });
        setNote(`Back to version ${v.version}`);
        setBasedOn(v.version);
        setMessage(`Version ${v.version} is loaded below. Start a draft to keep it, and a colleague publishes it as the next version.`);
      }}
      />
    </section>
  );
}

function History({
  domain, rows, canDraft, busy, onRestore,
}: {
  domain: ConfigDomain;
  rows: ConfigVersion[];
  canDraft: boolean;
  busy: boolean;
  onRestore: (v: ConfigVersion) => void;
}) {
  const versions = history(rows, domain);
  if (versions.length === 0) {
    return <EmptyState inline title="No versions yet" body="Published versions appear here, newest first, and stay for as long as the school does." />;
  }
  return (
    <div>
      <SectionLabel>Versions</SectionLabel>
      <ul style={{ listStyle: 'none', padding: 0 }}>
        {versions.map((v) => (
          <li key={v.id} style={{ borderTop: '1px solid var(--app-line)', paddingBlock: 'var(--sp-3)' }}>
            <span style={body}>Version {v.version}</span>{' '}
            <span style={quiet}>{v.published_at ? when(v.published_at) : ''}{v.note ? ` · ${v.note}` : ''}</span>
            <ul style={{ ...quiet, paddingLeft: 'var(--sp-5)' }}>
              {Object.keys(v.settings).length === 0
                ? <li>Nothing set: the platform’s defaults.</li>
                : Object.entries(v.settings).map(([k, val]) => <li key={k}>{SETTING_LABEL[k] ?? k}: {show(val)}</li>)}
            </ul>
            {canDraft && (
              <ActionButton disabled={busy} onClick={() => onRestore(v)}>Start from version {v.version}</ActionButton>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}

// ── One setting ─────────────────────────────────────────────────────────────

function Field({
  name, spec, value, fallback, disabled, onChange,
}: {
  name: string;
  spec: SettingSpec;
  value: Value | undefined;
  fallback: Value | undefined;
  disabled: boolean;
  onChange: (v: Value | undefined) => void;
}) {
  const isSet = value !== undefined;
  const hint = SETTING_HINT[name];
  const control = (() => {
    const v = isSet ? value : fallback;
    switch (spec.kind) {
      case 'bool':
        return (
          <select className="input" id={`cfg-${name}`} disabled={disabled || !isSet} value={v === true ? 'yes' : 'no'} onChange={(e) => onChange(e.target.value === 'yes')}>
            <option value="yes">Yes</option>
            <option value="no">No</option>
          </select>
        );
      case 'int':
        return (
          <input
            className="input" id={`cfg-${name}`} type="number" min={spec.min} max={spec.max} step={1}
            disabled={disabled || !isSet} value={typeof v === 'number' ? v : ''}
            onChange={(e) => onChange(e.target.value === '' ? spec.min : Number(e.target.value))}
          />
        );
      case 'enum':
        return (
          <select className="input" id={`cfg-${name}`} disabled={disabled || !isSet} value={typeof v === 'string' ? v : spec.values[0]} onChange={(e) => onChange(e.target.value)}>
            {spec.values.map((o) => <option key={o} value={o}>{CHOICE_LABEL[o] ?? o}</option>)}
          </select>
        );
      case 'set': {
        const chosen = Array.isArray(v) ? v : [];
        return (
          <fieldset id={`cfg-${name}`} style={{ border: 0, padding: 0, display: 'flex', gap: 'var(--sp-4)', flexWrap: 'wrap' }} disabled={disabled || !isSet}>
            <legend className="sr-only">{SETTING_LABEL[name]}</legend>
            {spec.values.map((o) => (
              <label key={o} style={inline}>
                <input
                  type="checkbox" checked={chosen.includes(o)}
                  onChange={(e) => onChange(spec.values.filter((x) => (x === o ? e.target.checked : chosen.includes(x))))}
                />
                {CHOICE_LABEL[o] ?? o}
              </label>
            ))}
          </fieldset>
        );
      }
      case 'text':
      case 'pattern':
        return (
          <input
            className="input" id={`cfg-${name}`} maxLength={spec.max} disabled={disabled || !isSet}
            value={typeof v === 'string' ? v : ''} onChange={(e) => onChange(e.target.value)}
          />
        );
    }
  })();

  return (
    <div style={label}>
      <label htmlFor={`cfg-${name}`} style={{ fontSize: 'var(--type-base)' }}>{SETTING_LABEL[name]}</label>
      {control}
      <label style={inline}>
        <input
          type="checkbox" checked={isSet} disabled={disabled}
          onChange={(e) => {
            if (!e.target.checked) onChange(undefined);
            // A text setting with no default starts empty, which the spec refuses until it is typed.
            else onChange(fallback ?? '');
          }}
        />
        Set for this school <span style={quiet}>(otherwise: {fallback === undefined ? 'the platform’s own' : show(fallback)})</span>
      </label>
      {hint && <span style={quiet}>{hint}</span>}
    </div>
  );
}
