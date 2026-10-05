import { useMemo, useState, useSyncExternalStore } from 'react';
import { Page } from '../components/Page';
import { Group as Panel, NavRow } from '../components/shell/Rows';
import { ActionButton } from '../components/ui';
import { download } from '../lib/deliver';
import { useDeviceLibrary } from '../lib/device-library';
import { DRAFTS_KEY, KEPT_LINE, readDrafts } from '../lib/draft';
import { formatDateTime } from '../lib/locale';
import { screenName } from '../lib/nav';
import { agoLine } from '../lib/profile';
import { draftLine, draftRows, type DraftRow } from '../lib/recoverydrafts';
import { KEEP_DAYS as COPY_DAYS } from '../lib/snapshots';
import { EMPTY_LEDGER, LEDGER_PREFIX, readLedger } from '../lib/offline-mode';
import { SYNC_WORDS } from '../lib/syncstatus';
import { workspaceBackup } from '../lib/workspace-backup';
import { useNow, useStore } from '../state/store';
import {
  RECOVERY_PLANS,
  nextRecoveryStage,
  recoveryPlan,
  type DisruptionKind,
  type RecoveryStage,
} from '../lib/academic-recovery';
import { CONFIDENCE_TEXT } from '../lib/assistant-confidence';

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
 * It claims nothing it cannot do. There is no per-plan version history, so
 * this screen does not offer one. What does exist it says: the copies of the
 * whole workspace the app takes by itself (`lib/snapshots.ts`, restored from
 * Export), and a removed course coming back by importing its syllabus again.
 * It used to say there was nothing to restore, which was true of a plan and
 * false of the workspace — so somebody in a panic was told the one thing that
 * could help did not exist. `recovery.test.ts` holds the two to each other.
 *
 * It also lists the drafts this device is holding (`lib/recoverydrafts.ts`),
 * because the only way to find one was to open the right screen of five, and
 * links the week-that-went-wrong screen, which was reachable from Today and
 * from nowhere a student in trouble would think to look.
 */
export function Recovery() {
  const { account, sync, dispatch } = useStore();
  const id = account?.id ?? null;
  const ledger = useDeviceLibrary(`${LEDGER_PREFIX}:${id || 'device'}`, readLedger, EMPTY_LEDGER);
  const words = SYNC_WORDS[sync.status];
  // The live sync state answers first: `queued`, `conflict`, `review` and
  // `error` all mean something on this device has not reached the account,
  // whatever the offline ledger says — the ledger is only kept while the
  // offline module is on, so on its own it would answer "no" to a signed-in
  // student whose sync strip says the opposite (Codex, #922).
  const pending = account !== null && ['queued', 'conflict', 'review', 'error'].includes(sync.status);
  const waiting = ledger.value.unsyncedSince;
  const drafts = useDraftRows();

  return (
    <Page blurb="Start here when an academic plan changes or something went missing. Review the impact without blame, keep the original plan in place, then choose a safe next step or recover device data.">
      <AcademicRecoveryGuide />
      <Section title="Is my work safe?">
        <p style={line}>
          <strong>{words.standing}.</strong> {words.sentence}
        </p>
        {ledger.value.lastSyncedAt ? <p style={dim}>Last synced from this device {formatDateTime(ledger.value.lastSyncedAt)}.</p> : null}
        {ledger.error ? <p style={dim}>{ledger.error}</p> : null}
      </Section>

      <Section title="Is anything waiting?">
        <p style={line}>
          {pending || waiting
            ? `Yes. ${waiting ? `Changes made on this device since ${formatDateTime(waiting)} have not reached your account yet.` : words.sentence} They are kept here; ${sync.status === 'review' || sync.status === 'conflict' ? 'Account is where you choose between the two versions.' : 'they are sent when the connection returns, and you do not have to do anything.'}`
            : account
              ? 'No. Everything you did on this device has reached your account.'
              : 'You are not signed in, so nothing waits on a connection: everything is on this device, and only here.'}
        </p>
      </Section>

      <Section title="Unfinished writing on this device">
        {drafts.length === 0 ? (
          <p style={line}>Nothing unfinished is being kept on this device.</p>
        ) : (
          <>
            <p style={dim}>{KEPT_LINE} Open the screen to put it back, or read and copy the text from here. To let one go, clear its field on its own screen.</p>
            <ul style={{ listStyle: 'none', margin: 'var(--sp-4) 0 0', padding: 0, display: 'grid', gridTemplateColumns: 'minmax(0, 1fr)', gap: 'var(--sp-5)' }}>
              {drafts.map((d) => (
                <DraftItem key={d.key} row={d} />
              ))}
            </ul>
          </>
        )}
      </Section>

      <Section title="A copy I can keep">
        <p style={dim}>
          The libraries kept on this device — saved schedules, scenarios, advisor meetings, study readiness, career evidence and your activity trail — in one file that Export can restore. Your courses, deadlines, notes and calendar are the app’s own record and are not in it: Export makes that copy, under Backup.
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
          A course you removed comes back by importing its syllabus again; the deadlines and the study guide are rebuilt, though answers you recorded are not. A deadline you ticked by mistake is under Done on Today. There is no earlier version of a single plan, but the app also takes copies of your whole workspace by itself, on this device, up to {COPY_DAYS} days back. Under Export you see what going back to one would change before anything happens.
        </p>
      </Section>

      <Panel>
        <NavRow label="Sort out a bad week" sub="Everything outstanding, against the hours you have" onClick={() => dispatch({ type: 'go', screen: 'behind' })} />
        <NavRow label="Reconnect a calendar or account" sub="What is linked, what last synced, and how to link it again" onClick={() => dispatch({ type: 'go', screen: 'connect' })} />
        <NavRow label="Import a syllabus again" sub="Bring a removed course back" onClick={() => dispatch({ type: 'go', screen: 'import' })} />
        <NavRow label="Export, or go back to an earlier copy" sub="Every record in files you can open elsewhere, and the copies the app took by itself, with what going back would change" onClick={() => dispatch({ type: 'go', screen: 'export' })} />
        <NavRow label="Your account and sync" sub="Sign-in, the sync record, and what a failure means" onClick={() => dispatch({ type: 'go', screen: 'account' })} />
        <NavRow label="Ask a person" sub="Help, and Semester support where it is switched on" onClick={() => dispatch({ type: 'go', screen: 'help' })} />
      </Panel>
    </Page>
  );
}

function AcademicRecoveryGuide() {
  const { state, dispatch } = useStore();
  const [kind, setKind] = useState<DisruptionKind | null>(null);
  const [stage, setStage] = useState<RecoveryStage>('identify');
  const selected = kind ? recoveryPlan(kind, state.role) : null;

  const choose = (next: DisruptionKind) => {
    setKind(next);
    setStage(nextRecoveryStage('identify', 'choose_change') ?? 'identify');
  };
  const reset = () => {
    setKind(null);
    setStage('identify');
  };

  return (
    <section className="academic-recovery" aria-labelledby="academic-recovery-title">
      <div className="kicker">Recovery mode</div>
      <h2 id="academic-recovery-title">Your plan can change. Let’s make the next step workable.</h2>
      <p className="academic-recovery-confidence">
        Semester will not notify faculty, advisors, or staff because you use Recovery Mode. Your plan stays private unless you choose what to share.
      </p>
      {stage === 'identify' || !selected ? (
        <>
          <p>Choose what would help most. Semester will show the impact and no more than three options; nothing changes merely because you review them.</p>
          <div className="academic-recovery-choices" role="group" aria-label="What changed">
            {RECOVERY_PLANS.map((plan) => (
              <button key={plan.kind} type="button" className="balance-button" onClick={() => choose(plan.kind)}>
                {plan.title}
              </button>
            ))}
          </div>
        </>
      ) : (
        <>
          <p className="academic-recovery-confidence">{CONFIDENCE_TEXT[selected.confidence]}</p>
          <p className="kicker">{selected.category}</p>
          <h3>{selected.title}</h3>
          <div className="academic-recovery-grid">
            <div>
              <h4>What this may affect</h4>
              <ul>{selected.affects.map((item) => <li key={item}>{item}</li>)}</ul>
            </div>
            <div>
              <h4>What remains unchanged</h4>
              <ul>{selected.preserved.map((item) => <li key={item}>{item}</li>)}</ul>
            </div>
          </div>
          {stage === 'assess' ? (
            <ActionButton onClick={() => setStage(nextRecoveryStage('assess', 'review_impact') ?? 'assess')}>
              Review options
            </ActionButton>
          ) : null}
          {stage === 'offer' ? (
            <div className="academic-recovery-options">
              {selected.options.map((option) => (
                <button
                  key={option.label}
                  type="button"
                  className="balance-button"
                  onClick={() => {
                    setStage(nextRecoveryStage('offer', 'choose_option') ?? 'offer');
                    dispatch({ type: 'go', screen: option.screen, recoveryIntent: option.intent });
                  }}
                >
                  <strong>{option.label}</strong>
                  <span>{option.reason}</span>
                </button>
              ))}
            </div>
          ) : null}
          <button type="button" className="workspace-text-button" onClick={reset}>Not now</button>
        </>
      )}
    </section>
  );
}

const line = { fontSize: 'var(--type-base)', margin: 0, lineHeight: 'var(--leading-relaxed)' } as const;
const dim = { fontSize: 'var(--type-sm)', color: 'var(--app-dim)', margin: 'var(--sp-2) 0 0', lineHeight: 'var(--leading-relaxed)' } as const;

function readRaw(): string | null {
  try {
    return localStorage.getItem(DRAFTS_KEY);
  } catch {
    return null;
  }
}

const never = () => () => {};

/**
 * What this device is holding.
 *
 * Read as a store snapshot rather than once in an initialiser: the screen a
 * student just left writes its pending text when it unmounts, which is after
 * this one has first rendered, and React checks the snapshot again once the
 * commit is done. A read held in state would show the copy from before that
 * write, or "nothing unfinished", until the screen was reopened.
 *
 * Storage that is off or full is a device with no drafts, not an error: this is
 * a list somebody opens in a hurry, and it must never be the thing that fails.
 */
function useDraftRows(): DraftRow[] {
  const raw = useSyncExternalStore(never, readRaw, () => null);
  // Drafts are stamped with the real clock, not the store's.
  const [at] = useState(() => Date.now());
  return useMemo(() => draftRows(readDrafts(raw), at), [raw, at]);
}

function DraftItem({ row }: { row: DraftRow }) {
  const { courseCode, dispatch } = useStore();
  const now = useNow();
  const [copied, setCopied] = useState<'' | 'yes' | 'no'>('');
  // Study keeps one draft per course; the rest of the key is the term and the
  // course, and the course is the part a student recognises.
  const course = row.key.startsWith('study-studio:') ? courseCode(row.about.split(':').pop() ?? '') : '';
  const name = row.home ? screenName(row.home) : '';
  async function copy() {
    try {
      await navigator.clipboard.writeText(row.text);
      setCopied('yes');
    } catch {
      // Clipboard access can be refused; the text is still there to select.
      setCopied('no');
    }
  }
  return (
    <li>
      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-4)' }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 'var(--type-base)' }}>
            {row.what}
            {course ? ` · ${course}` : ''}
          </div>
          <div style={{ fontSize: 'var(--type-sm)', color: 'var(--app-dim)', marginTop: 'var(--sp-1)' }}>
            {name ? `${name} · ` : ''}
            {draftLine(row, agoLine(row.at, now.getTime()))}
          </div>
        </div>
        {row.home && row.opens ? (
          <ActionButton onClick={() => dispatch({ type: 'go', screen: row.home! })} style={{ width: 'auto', fontSize: 'var(--type-xs)', flex: 'none' }}>
            Open
          </ActionButton>
        ) : null}
      </div>
      <details style={{ marginTop: 'var(--sp-3)' }}>
        <summary style={{ fontSize: 'var(--type-sm)', cursor: 'pointer', minHeight: 'var(--target-min)' }}>Read the text</summary>
        <pre
          tabIndex={0}
          aria-label={`Kept text: ${row.what}`}
          style={{
            whiteSpace: 'pre-wrap',
            overflowWrap: 'anywhere',
            maxHeight: '14rem',
            overflow: 'auto',
            margin: 'var(--sp-3) 0',
            padding: 'var(--sp-4)',
            border: '1px solid var(--app-line)',
            borderRadius: 'var(--r-sm)',
            background: 'var(--app-panel)',
            fontFamily: 'inherit',
            fontSize: 'var(--type-sm)',
            lineHeight: 'var(--leading-relaxed)',
          }}
        >
          {row.text}
        </pre>
        <ActionButton onClick={() => void copy()} style={{ width: 'auto', fontSize: 'var(--type-xs)' }}>
          Copy this text
        </ActionButton>
        <span role="status" style={{ marginLeft: 'var(--sp-3)', fontSize: 'var(--type-sm)', color: 'var(--app-dim)' }}>
          {copied === 'yes' ? 'Copied.' : copied === 'no' ? 'Could not copy from here; select the text above instead.' : ''}
        </span>
      </details>
    </li>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section aria-label={title} style={{ marginBottom: 'var(--sp-7)' }}>
      <h2 style={{ fontSize: 'var(--type-xs)', color: 'var(--app-dim)', letterSpacing: '0.1em', textTransform: 'uppercase', margin: '0 0 var(--sp-3)', fontFamily: 'var(--font-heading)' }}>{title}</h2>
      {children}
    </section>
  );
}
