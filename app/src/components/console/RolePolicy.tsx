import { useEffect, useMemo, useState } from 'react';
import { EmptyState, Notice, SectionLabel } from '../ui';
import { ErrorState, LoadingState } from '../unity/States';
import { Table, type Column } from '../unity/Table';
import {
  loadRolePolicy,
  type RolePolicySnapshot,
  type ServerCapability,
  type ServerRole,
} from '../../lib/console/role-policy';
import {
  COPY5_ROLE_PROPOSALS,
  ROLE_PROPOSAL_AUTHORITY,
  proposalMatchLabel,
  type Copy5RoleProposal,
} from '../../lib/copy5-role-governance';
import { matches } from './Fields';

interface RolePolicyProps {
  filter: string;
  authorityKey: string;
  read?: () => Promise<RolePolicySnapshot>;
}

interface RoleRow extends ServerRole {
  capabilities: string[];
}

interface CapabilityRow extends ServerCapability {
  roles: string[];
}

export function RolePolicy({ filter, authorityKey, read = loadRolePolicy }: RolePolicyProps) {
  const [reload, setReload] = useState(0);
  const requestKey = `${authorityKey}\u0000${reload}`;
  const [result, setResult] = useState<
    { key: string; status: 'ready'; snapshot: RolePolicySnapshot }
    | { key: string; status: 'error' }
    | null
  >(null);

  useEffect(() => {
    let live = true;
    read().then(
      (next) => {
        if (!live) return;
        setResult({ key: requestKey, status: 'ready', snapshot: next });
      },
      () => {
        if (!live) return;
        setResult({ key: requestKey, status: 'error' });
      },
    );
    return () => { live = false; };
  }, [read, requestKey]);

  const current = result?.key === requestKey ? result : null;
  const snapshot = current?.status === 'ready' ? current.snapshot : null;

  const roleRows = useMemo<RoleRow[]>(() => (snapshot?.roles ?? []).map((role) => ({
    ...role,
    capabilities: snapshot?.assignments
      .filter((assignment) => assignment.role === role.role)
      .map((assignment) => assignment.capability) ?? [],
  })).filter((role) => matches(filter, role.role, role.global ? 'global' : 'scoped', ...role.capabilities)), [filter, snapshot]);

  const capabilityRows = useMemo<CapabilityRow[]>(() => (snapshot?.capabilities ?? []).map((capability) => ({
    ...capability,
    roles: snapshot?.assignments
      .filter((assignment) => assignment.capability === capability.capability)
      .map((assignment) => assignment.role) ?? [],
  })).filter((capability) => matches(filter, capability.capability, capability.about, ...capability.roles)), [filter, snapshot]);

  const proposals = useMemo(() => COPY5_ROLE_PROPOSALS.filter((proposal) => matches(
    filter,
    proposal.id,
    proposal.title,
    proposal.family,
    ...proposal.candidateRoles,
    proposalMatchLabel(proposal),
    proposal.requiredDecision,
  )), [filter]);

  if (current?.status === 'error') {
    return (
      <ErrorState
        title="Role policy could not be loaded"
        body="No partial or cached role policy is shown. Try the authenticated server read again."
        recover={{ label: 'Try again', run: () => setReload((value) => value + 1) }}
      />
    );
  }
  if (!snapshot) return <LoadingState what="roles and capabilities" />;

  const emptyServer = snapshot.roles.length === 0 && snapshot.capabilities.length === 0 && snapshot.assignments.length === 0;
  const roleColumns: Column<RoleRow>[] = [
    { id: 'role', header: 'Server role', rowHeader: true, cell: (role) => <code>{role.role}</code> },
    { id: 'scope', header: 'Vocabulary scope', cell: (role) => role.global ? 'Global' : 'Scoped' },
    { id: 'capabilities', header: 'Assigned capabilities', cell: (role) => role.capabilities.length ? role.capabilities.join(', ') : 'None assigned' },
  ];
  const capabilityColumns: Column<CapabilityRow>[] = [
    { id: 'capability', header: 'Server capability', rowHeader: true, cell: (capability) => <code>{capability.capability}</code> },
    { id: 'about', header: 'Server description', cell: (capability) => capability.about },
    { id: 'roles', header: 'Assigned roles', cell: (capability) => capability.roles.length ? capability.roles.join(', ') : 'None assigned' },
  ];
  const proposalColumns: Column<Copy5RoleProposal>[] = [
    { id: 'proposal', header: 'Copy 7 proposal', rowHeader: true, cell: (proposal) => <><strong>{proposal.title}</strong><br /><code>{proposal.id}</code></> },
    { id: 'family', header: 'Family', cell: (proposal) => proposal.family },
    { id: 'candidate', header: 'Repository candidate', cell: (proposal) => proposal.candidateRoles.length ? proposal.candidateRoles.join(', ') : 'No canonical role proposed' },
    { id: 'status', header: 'Reconciliation status', cell: (proposal) => proposalMatchLabel(proposal) },
    { id: 'decision', header: 'Required decision', cell: (proposal) => proposal.requiredDecision },
  ];

  return (
    <div style={{ display: 'grid', gap: 'var(--sp-5)' }}>
      <Notice>
        Read-only server truth. Table membership is vocabulary and policy, not a user’s active grants. Nothing here changes a role, capability, grant, or permission.
      </Notice>

      <section aria-label="Server role policy" style={{ display: 'grid', gap: 'var(--sp-4)' }}>
        <SectionLabel aside={`${snapshot.roles.length} roles · ${snapshot.capabilities.length} capabilities`}>Server role policy</SectionLabel>
        {emptyServer ? (
          <EmptyState
            inline
            title="No server role policy rows"
            body="No authoritative role or capability rows were returned. This is an empty server result, not evidence that any role is active or inactive."
          />
        ) : (
          <>
            <Table
              caption="Server roles and their assigned capabilities"
              captionHidden
              columns={roleColumns}
              rows={roleRows}
              rowKey={(role) => role.role}
              compact="stack"
              empty={<p role="status">No server roles match this filter.</p>}
            />
            <Table
              caption="Server capabilities and their assigned roles"
              captionHidden
              columns={capabilityColumns}
              rows={capabilityRows}
              rowKey={(capability) => capability.capability}
              compact="stack"
              empty={<p role="status">No server capabilities match this filter.</p>}
            />
          </>
        )}
      </section>

      <section aria-label="Copy 7 role proposals" style={{ display: 'grid', gap: 'var(--sp-4)' }}>
        <SectionLabel aside={`${proposals.length} shown`}>Copy 7 role proposals</SectionLabel>
        <p style={{ marginBlock: 0 }}>
          51 design and governance proposals. {ROLE_PROPOSAL_AUTHORITY.current} proposals are non-authoritative: candidates and exact identifier matches do not create roles, grants, permissions, or activation. The current source is identical to the Copy 5 role dataset.
        </p>
        <Table
          caption="Copy 7 role proposals and reconciliation decisions"
          captionHidden
          columns={proposalColumns}
          rows={[...proposals]}
          rowKey={(proposal) => proposal.id}
          compact="stack"
          empty={<p role="status">No Copy 7 proposals match this filter.</p>}
        />
      </section>
    </div>
  );
}
