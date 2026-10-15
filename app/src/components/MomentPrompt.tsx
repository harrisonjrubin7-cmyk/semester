import { useEffect, useId, useState } from 'react';
import { ActionButton } from './ui';
import { secondLine } from '../lib/dim';
import { useDeviceLibrary } from '../lib/device-library';
import { dayOf } from '../lib/lifeevents';
import {
  EMPTY,
  FEEDBACK_KEY,
  answer,
  mayAsk,
  recordShown,
  momentById,
  momentFeedbackOn,
  readFeedback,
  setMuted,
  skip,
  type MomentId,
} from '../lib/momentfeedback';
import { useAccountId, useNow } from '../state/store';

/**
 * One optional question, right after the thing it is about.
 *
 * Takes a moment, a storage key and today's date, and nothing else. The answer
 * is one of the moment's fixed choices and is kept on this device; it is not
 * sent anywhere (`lib/momentfeedback.ts` has the rules and the reasons). When
 * the choice cannot be kept — storage refused, or unreadable — it draws
 * nothing rather than ask a question it cannot remember having asked.
 */
export function MomentPrompt({ moment, storageKey, today }: { moment: MomentId; storageKey: string; today: string }) {
  const lib = useDeviceLibrary(storageKey, readFeedback, EMPTY, 60_000);
  const [closed, setClosed] = useState<'answered' | 'closed' | null>(null);
  const [shown, setShown] = useState(false);
  const id = useId();
  const m = momentById(moment);
  const may = !lib.blocked && !lib.error && mayAsk(lib.value, moment, today).ok;

  // Being drawn is being asked: write it down, so leaving without answering still counts against the limits.
  useEffect(() => {
    if (may && !shown && closed === null) {
      setShown(true);
      lib.update((s) => recordShown(s, moment, today));
    }
    // `lib.update` is stable for a given key.
    // oxlint-disable-next-line react-hooks/exhaustive-deps
  }, [may, shown, closed, moment, today]);

  if (lib.blocked || lib.error) return null;
  if (closed === 'answered') {
    return (
      <p role="status" style={{ fontSize: 'var(--type-sm)', ...secondLine() }}>
        Thanks. That is saved on this device only.
      </p>
    );
  }
  if (closed === 'closed' || !(may || shown)) return null;

  const small = { fontSize: 'var(--type-sm)', ...secondLine() } as const;
  const button = { width: 'auto', paddingInline: 'var(--sp-6)' } as const;

  return (
    <div
      role="group"
      aria-labelledby={id}
      style={{ marginTop: 'var(--sp-5)', paddingBlock: 'calc(12px * var(--density, 1))', paddingInline: 'calc(14px * var(--density, 1))', border: '1px solid var(--app-line)', borderRadius: 'var(--r-md)' }}
    >
      <p id={id} style={{ fontSize: 'var(--type-base)', lineHeight: 'var(--leading-normal)', margin: 0 }}>
        {`${m.when} ${m.question}`}
      </p>
      <p style={{ ...small, margin: 'var(--sp-2) 0 var(--sp-4)' }}>Optional. Your answer stays on this device.</p>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--sp-4)' }}>
        {m.choices.map((c) => (
          <ActionButton
            key={c.id}
            style={button}
            onClick={() => {
              if (lib.update((s) => answer(s, moment, c.id, today))) setClosed('answered');
            }}
          >
            {c.label}
          </ActionButton>
        ))}
        <ActionButton
          tone="ghost"
          style={button}
          onClick={() => {
            lib.update((s) => skip(s, moment, today));
            setClosed('closed');
          }}
        >
          Skip
        </ActionButton>
        <ActionButton
          tone="ghost"
          style={button}
          aria-label="Stop asking me these questions"
          onClick={() => {
            lib.update((s) => setMuted(s, true));
            setClosed('closed');
          }}
        >
          Don’t ask me these
        </ActionButton>
      </div>
    </div>
  );
}

/**
 * The slot the screens use. Off, it returns before it touches the store, so a
 * screen that has never heard of this feature renders exactly as it did.
 */
export function MomentPromptSlot({ moment }: { moment: MomentId }) {
  if (!momentFeedbackOn()) return null;
  return <OnThisDevice moment={moment} />;
}

function OnThisDevice({ moment }: { moment: MomentId }) {
  const accountId = useAccountId();
  const now = useNow();
  return <MomentPrompt moment={moment} storageKey={`${FEEDBACK_KEY}:${accountId || 'device'}`} today={dayOf(now)} />;
}
