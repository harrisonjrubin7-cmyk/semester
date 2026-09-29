import { useCallback, useEffect, useState } from 'react';
import { CORE_MODULES, type CoreModuleId } from '@semester/contract';
import { MODULES } from '../../site/modules';
import { STATUS_LABEL } from '../../lib/ops/claims';
import {
  SOURCE_TEXT, approveModuleMode, loadRequests, moduleModes, requestModuleMode, resolveModuleMode,
  type ModuleModeRow, type ModuleRequest,
} from '../../lib/modulemode';
import { ActionButton, EmptyState, Notice, SectionLabel } from '../ui';

const NAME = new Map(MODULES.map((m) => [m.id, m]));

/**
 * The Modules tab: every module a school can switch from Connect to Core, the
 * mode it is in now, and the requests waiting. The mode itself is the
 * database's (`lib/modulemode.ts`); this only asks and shows.
 *
 * It says, on the page, that nothing in Core is built. A switch changes a
 * setting; until a module's own screens exist (the takeover map on the site
 * says which), switching one to Core changes nothing a student sees.
 */
export function ModulesPanel({ school, me, canEdit }: { school: string; me: string; canEdit: boolean }) {
  const [rows, setRows] = useState<readonly ModuleModeRow[] | null>(null);
  const [requests, setRequests] = useState<ModuleRequest[]>([]);
  const [asking, setAsking] = useState<CoreModuleId | null>(null);
  const [reason, setReason] = useState('');
  const [said, setSaid] = useState('');

  const refresh = useCallback(async () => {
    setRows(await moduleModes(school, true));
    setRequests(await loadRequests(school, me));
  }, [school, me]);

  useEffect(() => { void refresh(); }, [refresh]);

  const send = async (module: CoreModuleId, to: 'core' | 'connect') => {
    const err = await requestModuleMode(school, me, module, to, reason);
    setSaid(err ?? (to === 'connect' ? 'Back to Connect. Nothing was deleted; the module’s Core data is kept, read-only.' : 'Requested. Two other administrators must approve it.'));
    if (!err) { setAsking(null); setReason(''); }
    await refresh();
  };
  const approve = async (id: string) => {
    const err = await approveModuleMode(school, me, id);
    setSaid(err ?? 'Approved.');
    await refresh();
  };

  if (!school) return <EmptyState title="No school" body="Modules are set per school; sign in with your school account." inline />;

  return (
    <section aria-label="Modules">
      <SectionLabel>Modules</SectionLabel>
      <Notice>
        Each module runs in <strong>Connect</strong> (Semester reads your own system) or <strong>Core</strong> (Semester is the record for it). Every module is in Connect until two other administrators approve a switch, and going back deletes nothing. <strong>No Core module is built yet</strong>: today a switch changes the setting only.
      </Notice>
      {rows === null && <p className="portal-muted">The settings could not be read, so every module shows as Connect.</p>}
      {said && <p role="status">{said}</p>}
      <ul className="portal-list">
        {CORE_MODULES.map((id) => {
          const m = NAME.get(id);
          const r = resolveModuleMode(id, rows);
          const pending = requests.find((q) => q.module === id);
          return (
            <li key={id} className="portal-panel">
              <h3>{m?.name ?? id}</h3>
              <p>
                <strong>{r.mode === 'core' ? 'Core' : 'Connect'}</strong>
                {r.frozen ? ' · frozen: Core data kept, read-only' : ''} · {SOURCE_TEXT[r.source]}
              </p>
              {m && <p className="portal-muted">Would replace {m.replaces}. Status: {STATUS_LABEL[m.status]}.</p>}
              {pending && (
                <p>
                  Waiting: {pending.to_mode === 'core' ? 'Core' : 'Connect'}, “{pending.reason}” — {pending.approvals} of 2 approvals.{' '}
                  {canEdit && pending.requested_by !== me && !pending.approvedByMe && (
                    <ActionButton onClick={() => void approve(pending.id)}>Approve</ActionButton>
                  )}
                </p>
              )}
              {canEdit && !pending && r.mode === 'connect' && asking !== id && (
                <ActionButton onClick={() => { setAsking(id); setSaid(''); }}>Ask for Core</ActionButton>
              )}
              {canEdit && !pending && r.mode === 'core' && (
                <ActionButton onClick={() => { setAsking(id); setSaid(''); }}>Go back to Connect</ActionButton>
              )}
              {canEdit && asking === id && (
                <div>
                  <label>
                    Reason
                    <textarea rows={2} value={reason} onChange={(e) => setReason(e.target.value)} />
                  </label>
                  <ActionButton tone="primary" disabled={!reason.trim()} onClick={() => void send(id, r.mode === 'core' ? 'connect' : 'core')}>
                    {r.mode === 'core' ? 'Go back to Connect' : 'Send for approval'}
                  </ActionButton>{' '}
                  <ActionButton tone="ghost" onClick={() => setAsking(null)}>Cancel</ActionButton>
                </div>
              )}
            </li>
          );
        })}
      </ul>
      {!canEdit && <p className="portal-muted">Only an administrator with the configure capability can change a module.</p>}
    </section>
  );
}
