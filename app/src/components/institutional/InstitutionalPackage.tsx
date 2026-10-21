import { useRef, useState, type FormEvent } from 'react';
import { INSTITUTIONAL_PACKAGE, ROLLOUT_PHASES } from '../../lib/institutional-package';
import {
  INSTITUTION_LAUNCH_WINDOWS,
  INSTITUTION_SYSTEMS,
  submitInstitutionalIntake,
  type InstitutionalIntakeInput,
  type InstitutionalIntakeReceipt,
} from '../../lib/institutional-intake';
import { Notice, SectionLabel } from '../ui';

interface InstitutionalPackageProps {
  requester?: { name: string; email: string };
  institution?: { name: string; domain: string };
  submitIntake?: (input: InstitutionalIntakeInput) => Promise<InstitutionalIntakeReceipt>;
}

const emailLike = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
const domainLike = (value: string): boolean => {
  const raw = value.trim().toLowerCase().replace(/\.$/, '');
  if (!raw || raw.length > 253 || /[\s%\\/:?#@]/.test(raw)) return false;
  try {
    const domain = new URL(`https://${raw}`).hostname;
    return domain.length <= 253 && domain.includes('.') && !/^\d+(?:\.\d+){3}$/.test(domain);
  } catch {
    return false;
  }
};

function SetupRequest({ requester, institution, submitIntake = submitInstitutionalIntake }: InstitutionalPackageProps) {
  const [name, setName] = useState(requester?.name ?? '');
  const [email, setEmail] = useState(requester?.email ?? '');
  const [organization, setOrganization] = useState(institution?.name ?? '');
  const [domain, setDomain] = useState(institution?.domain ?? '');
  const [system, setSystem] = useState<InstitutionalIntakeInput['system']>('identity');
  const [provider, setProvider] = useState('');
  const [dataMode, setDataMode] = useState<InstitutionalIntakeInput['dataMode']>('manual');
  const [launchWindow, setLaunchWindow] = useState<InstitutionalIntakeInput['launchWindow']>('exploring');
  const [busy, setBusy] = useState(false);
  const busyRef = useRef(false);
  const [error, setError] = useState('');
  const [receipt, setReceipt] = useState<InstitutionalIntakeReceipt | null>(null);

  const send = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (busyRef.current || receipt) return;
    const missing = !name.trim() || !emailLike.test(email.trim()) || !organization.trim()
      || !domainLike(domain) || !provider.trim();
    if (missing) {
      setError('Add your name, a valid work email, institution, domain, and provider before sending.');
      return;
    }
    busyRef.current = true;
    setBusy(true);
    setError('');
    try {
      const accepted = await submitIntake({
        name, email, institution: organization, domain, system, provider, dataMode, launchWindow,
      });
      setReceipt(accepted);
    } catch (problem) {
      setError(problem instanceof Error ? problem.message : 'Semester could not accept the request. Nothing has been marked as received.');
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  };

  if (receipt) {
    return (
      <div className="portal-panel" role="status" aria-live="polite">
        <h3>Request received · pending human review</h3>
        <p><strong>Receipt {receipt.reference}</strong></p>
        <p>
          Automated intake accepted these discovery details. This does not confirm ownership, tenant access,
          provider support, an integration, or a launch.
        </p>
        <p className="portal-muted">
          Keep this receipt. The intake cannot securely retrieve it after a reload or on another device; it is not
          a password or a way to access the request.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={(event) => void send(event)} aria-describedby="institution-request-boundary institution-request-error" noValidate>
      <div className="portal-panel">
        <h3>Request institutional setup review</h3>
        <p id="institution-request-boundary" className="portal-muted">
          Send discovery details for human review. This does not activate a tenant or connect a provider. No
          passwords, API keys, secrets, or student records.
        </p>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 16rem), 1fr))', gap: 'var(--sp-4)' }}>
          <label>
            Your name
            <input name="name" autoComplete="name" maxLength={200} value={name} onChange={(event) => setName(event.target.value)} required />
          </label>
          <label>
            Work email
            <input name="email" type="email" autoComplete="email" maxLength={320} value={email} onChange={(event) => setEmail(event.target.value)} required />
          </label>
          <label>
            Institution
            <input name="institution" autoComplete="organization" maxLength={200} value={organization} onChange={(event) => setOrganization(event.target.value)} required />
          </label>
          <label>
            Institution domain
            <input name="domain" inputMode="url" autoCapitalize="none" spellCheck={false} placeholder="example.edu" maxLength={253} value={domain} onChange={(event) => setDomain(event.target.value)} required />
          </label>
          <label>
            System category
            <select name="system" value={system} onChange={(event) => setSystem(event.target.value as InstitutionalIntakeInput['system'])}>
              {INSTITUTION_SYSTEMS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </select>
          </label>
          <label>
            Provider or product requested
            <input name="provider" maxLength={120} value={provider} onChange={(event) => setProvider(event.target.value)} required />
          </label>
          <label>
            Read-only discovery goal
            <select name="dataMode" value={dataMode} onChange={(event) => setDataMode(event.target.value as InstitutionalIntakeInput['dataMode'])}>
              <option value="manual">Evaluate a manual, read-only pilot</option>
              <option value="connected">Explore a read-only connection request</option>
            </select>
          </label>
          <label>
            Desired launch window
            <select name="launchWindow" value={launchWindow} onChange={(event) => setLaunchWindow(event.target.value as InstitutionalIntakeInput['launchWindow'])}>
              {INSTITUTION_LAUNCH_WINDOWS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </select>
          </label>
        </div>
        <p id="institution-request-error" role="alert" hidden={!error}>{error}</p>
        <button type="submit" className="btn btn-primary btn-block" disabled={busy} style={{ marginTop: 'var(--sp-4)' }}>
          {busy ? 'Sending request…' : 'Send for human review'}
        </button>
      </div>
    </form>
  );
}

/** The offer and adoption path. It describes the package; it grants no access. */
export function InstitutionalPackage(props: InstitutionalPackageProps = {}) {
  return (
    <section aria-label="Semester Institutional package">
      <SectionLabel>{INSTITUTIONAL_PACKAGE.name}</SectionLabel>
      <h2 style={{ marginBlock: 'var(--sp-3)' }}>Add a governed student operating layer without replacing systems of record</h2>
      <p>{INSTITUTIONAL_PACKAGE.promise}</p>
      <Notice>
        The package simplifies buying, not governance. Data access, write authority and the change of system of record
        remain tenant-approved, least-privilege, reversible and evidence-gated.
      </Notice>
      <SetupRequest {...props} />
      <h3>Included</h3>
      <ul className="portal-list">
        {INSTITUTIONAL_PACKAGE.includes.map((item) => <li key={item}>{item}</li>)}
      </ul>
      <h3>Phased adoption</h3>
      <ol className="portal-list">
        {ROLLOUT_PHASES.map((phase) => (
          <li key={phase.id} className="portal-panel">
            <strong>{phase.name}</strong>
            <p>{phase.outcome}</p>
            <p className="portal-muted">Exit evidence: {phase.requiredEvidence.map((item) => item.replaceAll('_', ' ')).join(' · ')}</p>
          </li>
        ))}
      </ol>
    </section>
  );
}
