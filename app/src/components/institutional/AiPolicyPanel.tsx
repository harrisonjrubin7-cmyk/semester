import { useEffect, useState } from 'react';
import type { IntelligenceMode } from '@semester/institution';
import {
  AI_POLICY_MODES,
  AI_POLICY_ROLES,
  loadAiCapabilityPolicies,
  saveAiCapabilityPolicy,
  type AiCapabilityPolicyRow,
} from '../../lib/ai-capability-policy';
import { ActionButton, Notice, SectionLabel } from '../ui';

const COPY: Record<AiCapabilityPolicyRow['feature'], { name: string; about: string }> = {
  assistant: { name: 'General assistant', about: 'Questions and explanations outside a specialized role.' },
  tutoring: { name: 'Tutoring and course guidance', about: 'Tutor and course-guide help, still bounded by each course policy.' },
  writing: { name: 'Writing support', about: 'Draft mode. Keep this separate from explanation and practice.' },
  advising: { name: 'Advising support', about: 'AI assistance in the advisor role; official records and actions remain authoritative elsewhere.' },
};

const roleName = (role: string) => role.replace(/_/g, ' ').replace(/^./, (letter) => letter.toUpperCase());
const toggle = <T extends string>(items: readonly T[], item: T): T[] =>
  items.includes(item) ? items.filter((value) => value !== item) : [...items, item];

export function AiPolicyPanel({ school }: { school: string }) {
  const [rows, setRows] = useState<AiCapabilityPolicyRow[] | null>(null);
  const [message, setMessage] = useState('');

  useEffect(() => {
    let live = true;
    void (async () => {
      try {
        const loaded = await loadAiCapabilityPolicies(school);
        if (live) setRows(loaded);
      } catch (error) {
        if (live) {
          setRows(null);
          setMessage(error instanceof Error ? error.message : 'The AI capability policy could not be read.');
        }
      }
    })();
    return () => { live = false; };
  }, [school]);

  const change = (feature: AiCapabilityPolicyRow['feature'], patch: Partial<AiCapabilityPolicyRow>) => {
    setRows((current) => current?.map((row) => row.feature === feature ? { ...row, ...patch } : row) ?? null);
  };
  const save = async (row: AiCapabilityPolicyRow) => {
    setMessage('Saving…');
    try {
      await saveAiCapabilityPolicy(school, row);
      setMessage(`${COPY[row.feature].name} policy saved and recorded in the audit log.`);
      setRows(await loadAiCapabilityPolicies(school));
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'The policy could not be saved.');
    }
  };

  return (
    <section aria-label="AI capability policy">
      <SectionLabel>AI capability policy</SectionLabel>
      <Notice>
        Every AI capability starts off and must be enabled independently for named roles and support modes. These controls do not disable Today, Courses, Calendar, assignments, notes, search, or other core academic workflows. Server policy is authoritative; this page cannot override provider, budget, course, consent, or emergency kill-switch limits.
      </Notice>
      {message && <p role="status">{message}</p>}
      {rows === null && !message && <p role="status">Reading the institution policy…</p>}
      {rows?.map((row) => (
        <fieldset className="portal-panel" key={row.feature}>
          <legend><strong>{COPY[row.feature].name}</strong></legend>
          <p className="portal-muted">{COPY[row.feature].about}</p>
          <label>
            <input type="checkbox" checked={row.enabled} onChange={(event) => change(row.feature, { enabled: event.target.checked })} />{' '}
            Enabled for the selected roles and modes
          </label>
          <div role="group" aria-label={`${COPY[row.feature].name} roles`}>
            <strong>Roles</strong>
            {AI_POLICY_ROLES.map((role) => (
              <label key={role} style={{ display: 'block' }}>
                <input type="checkbox" checked={row.permittedRoles.includes(role)} onChange={() => change(row.feature, { permittedRoles: toggle(row.permittedRoles, role) })} />{' '}
                {roleName(role)}
              </label>
            ))}
          </div>
          <div role="group" aria-label={`${COPY[row.feature].name} modes`}>
            <strong>Support modes</strong>
            {AI_POLICY_MODES.map((mode: IntelligenceMode) => (
              <label key={mode} style={{ display: 'block' }}>
                <input type="checkbox" checked={row.allowedModes.includes(mode)} onChange={() => change(row.feature, { allowedModes: toggle(row.allowedModes, mode) })} />{' '}
                {roleName(mode)}
              </label>
            ))}
          </div>
          <label>
            Reason for this policy
            <textarea rows={2} maxLength={1000} value={row.reason} onChange={(event) => change(row.feature, { reason: event.target.value })} />
          </label>
          <ActionButton tone="primary" onClick={() => void save(row)}>Save {COPY[row.feature].name.toLowerCase()}</ActionButton>
        </fieldset>
      ))}
    </section>
  );
}
