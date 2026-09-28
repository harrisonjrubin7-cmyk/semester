import { Page } from '../components/Page';
import { Group as Panel, NavRow } from '../components/shell/Rows';
import { ActionButton } from '../components/ui';
import { download } from '../lib/deliver';
import { useDeviceLibrary } from '../lib/device-library';
import { formatDateTime } from '../lib/locale';
import { EMPTY_LEDGER, LEDGER_PREFIX, readLedger } from '../lib/offline-mode';
import { SYNC_WORDS } from '../lib/syncstatus';
import { workspaceBackup } from '../lib/workspace-backup';
import { useStore } from '../state/store';

/**
 * Recovery: one place to start when something went missing.
 *
 * The pieces existed — the sync words on Account, the offline ledger behind
 * the banner, the device libraries' backup under Export, the reconnect on
 * Connect, a person on Help — and a student at a deadline with a plan that
 * would not save had to know five screens to find them. This is the five in
 * the order panic asks: is my work safe, is anything waiting, give me a copy,
 * let me reconnect, let me ask someone.
 *
 * It claims nothing it cannot do. There is no version history of a plan, so
 * this screen does not offer one; a course removed comes back by importing
 * the syllabus again, and it says that rather than promising an undo.
 */
export function Recovery() {
  const { account, sync, dispatch } = useStore();
  const id = account?.id ?? null;
  const ledger = useDeviceLibrary(`${LEDGER_PREFIX}:${id || 'device'}`, readLedger, EMPTY_LEDGER);
  const words = SYNC_WORDS[sync.status];
  const waiting = ledger.value.unsyncedSince;

  return (
    <Page blurb="Start here when something went missing or would not save. In order: is your work safe, is anything waiting to sync, a copy of this device’s libraries, how to reconnect, and how to reach a person.">
      <Section title="Is my work safe?">
        <p style={line}>
          <strong>{words.standing}.</strong> {words.sentence}
        </p>
        {ledger.value.lastSyncedAt ? <p style={dim}>Last synced from this device {formatDateTime(ledger.value.lastSyncedAt)}.</p> : null}
        {ledger.error ? <p style={dim}>{ledger.error}</p> : null}
      </Section>

      <Section title="Is anything waiting?">
        <p style={line}>
          {waiting
            ? `Yes. Changes made on this device since ${formatDateTime(waiting)} have not reached your account yet. They are kept here and sent when the connection returns; you do not have to do anything.`
            : account
              ? 'No. Everything you did on this device has reached your account.'
              : 'You are not signed in, so nothing waits on a connection: everything is on this device, and only here.'}
        </p>
      </Section>

      <Section title="A copy I can keep">
        <p style={dim}>
          Every library kept on this device — plans, scenarios, advisor meetings, study readiness, career evidence, your activity — in one file you can open elsewhere or restore from Export.
        </p>
        <ActionButton
          onClick={() =>
            download({
              name: 'Semester — recovery copy.json',
              body: JSON.stringify(workspaceBackup(id ?? 'device'), null, 2),
              mime: 'application/json',
            })
          }
          style={{ marginTop: 'var(--sp-4)', fontSize: 'var(--type-xs)' }}
        >
          Download a recovery copy
        </ActionButton>
      </Section>

      <Section title="Something is gone">
        <p style={dim}>
          A course you removed comes back by importing its syllabus again; the deadlines and the study guide are rebuilt, though answers you recorded are not. A deadline you ticked by mistake is under Done on Today. There is no earlier version of a plan to restore, so save a copy before a big change.
        </p>
      </Section>

      <Panel>
        <NavRow label="Reconnect a calendar or account" sub="What is linked, what last synced, and how to link it again" onClick={() => dispatch({ type: 'go', screen: 'connect' })} />
        <NavRow label="Import a syllabus again" sub="Bring a removed course back" onClick={() => dispatch({ type: 'go', screen: 'import' })} />
        <NavRow label="Export everything" sub="Every record, in files you can open elsewhere, and restore from" onClick={() => dispatch({ type: 'go', screen: 'export' })} />
        <NavRow label="Your account and sync" sub="Sign-in, the sync record, and what a failure means" onClick={() => dispatch({ type: 'go', screen: 'account' })} />
        <NavRow label="Ask a person" sub="Help, and Semester support where it is switched on" onClick={() => dispatch({ type: 'go', screen: 'help' })} />
      </Panel>
    </Page>
  );
}

const line = { fontSize: 'var(--type-base)', margin: 0, lineHeight: 'var(--leading-relaxed)' } as const;
const dim = { fontSize: 'var(--type-sm)', color: 'var(--app-dim)', margin: 'var(--sp-2) 0 0', lineHeight: 'var(--leading-relaxed)' } as const;

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section aria-label={title} style={{ marginBottom: 'var(--sp-7)' }}>
      <h2 style={{ fontSize: 'var(--type-xs)', color: 'var(--app-dim)', letterSpacing: '0.1em', textTransform: 'uppercase', margin: '0 0 var(--sp-3)', fontFamily: 'var(--font-heading)' }}>{title}</h2>
      {children}
    </section>
  );
}
