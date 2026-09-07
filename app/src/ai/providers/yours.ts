import { inventory, bytesOf } from '../../lib/inventory';
import { pickPersisted } from '../../state/shape';
import { SHORTCUTS } from '../../lib/keys';
import { DESTINATIONS } from '../../lib/nav';
import type { Provide } from '../shape';

/**
 * The Yours group — your account, your data, how the app looks.
 *
 * Two rules bind harder here than anywhere else. **People and letters get no
 * provider at all**: `lib/context.ts` refuses to send anything from them
 * under any circumstance, and a screen provider handing them over would be a
 * second door past the one rule in this app that protects somebody who is not
 * the student. And nothing here carries a key, a token or an address.
 */

/**
 * The Everything directory — what the app can do, and what has gone unused.
 *
 * The registry is already in the system prompt (see `PICK.always` in
 * `lib/context.ts`), so repeating fifty-four labels here would spend two
 * thousand tokens saying what the model has been told twice. What it does not
 * have is which of them this student has actually opened, which is the one
 * question this screen answers and the only thing worth sending.
 */
export const everything: Provide = (look) => {
  const { state } = look;
  // The whole registry rather than the school-filtered list: `Look` carries
  // no capabilities, and a screen this student cannot reach is not a screen
  // they have failed to open. Filtering it here would need a fourth argument
  // through every provider to change one line.
  const rows = DESTINATIONS;
  const never = rows.filter((d) => !state.visited[d.screen]).map((d) => d.screen);
  return {
    summary: `The directory of every screen. ${rows.length - never.length} of ${rows.length} have been opened at least once.`,
    visible: never.length > 0 ? [{ neverOpened: never.join(', ') }] : [],
    actions: ['open_screen'],
    suggestions: [
      'Which of these would help me most this week?',
      'What have I never opened that I should?',
    ],
  };
};

/** Timers and alarms — what is running and what will go off. */
export const clocks: Provide = (look) => {
  const { state, now } = look;
  const running = state.timers.filter((t) => t.endsAt !== null);
  return {
    summary: `Timers and alarms — ${state.timers.length} ${state.timers.length === 1 ? 'timer' : 'timers'} (${running.length} running), ${state.alarms.filter((a) => a.on).length} alarms on.`,
    visible: [
      ...state.timers.map((t) => ({
        timer: t.label || `${Math.round(t.seconds / 60)} minutes`,
        set: `${Math.round(t.seconds / 60)} min`,
        state: t.rangAt ? 'ringing' : t.endsAt ? `${Math.max(0, Math.round((t.endsAt - now.getTime()) / 60_000))} min left` : 'paused',
      })),
      ...state.alarms.map((a) => ({
        alarm: a.label || 'unnamed',
        at: new Date(a.at).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' }),
        on: a.on,
        repeats: a.days.length > 0,
      })),
    ],
    actions: ['start_timer', 'open_screen'],
    suggestions: ['Start a timer for the next thing I am doing.', 'How long should I work before a break?'],
  };
};

/** Applications — internships, jobs and research posts. */
export const applying: Provide = (look) => {
  const { state, now } = look;
  if (state.applications.length === 0) return null;
  const rows = state.applications.map((a) => ({
    org: a.org,
    role: a.role,
    stage: a.stage,
    ...(a.rolling ? { rolling: true } : a.due ? { due: a.due } : {}),
    ...(a.next ? { nextStep: a.next } : {}),
    ...(a.nextBy ? { nextBy: a.nextBy } : {}),
    daysSinceMoved: Math.round((now.getTime() - (a.moves.at(-1)?.at ?? a.created)) / 86_400_000),
  }));
  const stale = rows.filter((r) => r.daysSinceMoved > 21).length;
  return {
    summary: `Applications — ${rows.length} tracked${stale > 0 ? `, ${stale} with no movement in three weeks` : ''}.`,
    visible: rows,
    actions: ['add_application', 'add_task', 'open_screen'],
    suggestions: [
      'Which of these should I chase?',
      'What is due soonest?',
      'What should the next step be on the oldest one?',
    ],
  };
};

/** Your data — every record, what it weighs, how much room is left. */
export const data: Provide = (look) => {
  // The same inventory the screen prints, sorted the same way — biggest first.
  const it = inventory(pickPersisted(look.state));
  const real = it.rows.filter((r) => r.count > 0);
  return {
    summary: `Your data — ${real.length} kinds of record with something in them, about ${Math.round(it.bytes / 1024)} KB in all. Everything is on this device.`,
    visible: real.slice(0, 40).map((r) => ({ what: r.label, records: r.count, kb: Math.round(r.bytes / 102.4) / 10 })),
    actions: ['open_screen'],
    suggestions: [
      'What is taking up the most room?',
      'What happens if I run out of space?',
      'What does the app actually keep about me?',
    ],
  };
};

/**
 * How this works — the generated guide.
 *
 * The registry and the shortcut list are already sent with every question,
 * so this hands over almost nothing new; what it adds is that the student is
 * *on* the guide, which is the difference between "how do I export" and "how
 * do I export" asked while reading the export section.
 */
export const help: Provide = () => ({
  summary: `The guide to this app — generated from the code, so it cannot describe a screen that is not there. ${SHORTCUTS.length} keyboard shortcuts.`,
  visible: SHORTCUTS.map((s) => ({ key: s.key, does: s.does })),
  actions: ['open_screen'],
  suggestions: ['What can this app not do?', 'What is the fastest way to do this?'],
});

/** Settings — navigation, alerts, which courses are loaded. */
export const settings: Provide = (look) => {
  const { state } = look;
  return {
    summary: `Settings — ${state.nav} navigation, ${state.tabs.length} tabs, text ${state.textSize}, ${state.ground} background, ${state.density} spacing.`,
    focus: {
      navigation: state.nav,
      accent: state.accent,
      ground: state.ground,
      textSize: state.textSize,
      density: state.density,
      shell: state.shell,
    },
    visible: [],
    actions: ['set_look', 'open_screen'],
    suggestions: [
      'Make the text bigger.',
      'What does this setting change?',
      'Which of these affects battery or data?',
    ],
  };
};

/** Alerts — what the app would have poked you about. */
export const notifs: Provide = (look) => {
  const { state } = look;
  const on = Object.entries(state.notifs).filter(([, v]) => v);
  return {
    summary: `Alerts — ${on.length} of ${Object.keys(state.notifs).length} kinds switched on, ${state.myRules.filter((r) => r.on).length} rules of your own.`,
    visible: Object.entries(state.notifs).map(([kind, v]) => ({ kind, on: v })),
    actions: ['open_screen'],
    suggestions: ['Why did I not get told about this?', 'Which of these are worth having on?'],
  };
};

/** Connect accounts — course site, Outlook, Google, Zoom. */
export const connect: Provide = (look) => {
  const { state } = look;
  return {
    summary: `Connected accounts — ${state.feeds.length} ${state.feeds.length === 1 ? 'calendar feed' : 'calendar feeds'}. No password or token is ever shown here or sent anywhere.`,
    visible: state.feeds.map((f) => ({
      name: f.name,
      kind: f.kind,
      events: f.count,
      lastSynced: f.synced ? new Date(f.synced).toDateString() : 'never',
      status: f.status || 'ok',
    })),
    actions: ['open_screen'],
    suggestions: ['Why has this stopped syncing?', 'What does connecting this actually give me?'],
  };
};

/** Files & mail — pulling a reading out of Drive or OneDrive. */
export const cloud: Provide = () => ({
  summary:
    'Pulling a reading out of a connected drive, or turning an announcement into a change set. Files are read in this browser; their contents are never part of a question.',
  visible: [],
  actions: ['open_screen'],
  suggestions: ['How do I get a reading in from Drive?', 'What happens to a file after I import it?'],
});

/** Take it with you — the export. */
export const exportScreen: Provide = (look) => ({
  summary: `Taking your data with you — ${Math.round(bytesOf(pickPersisted(look.state)) / 1024)} KB, as one file. Nothing is uploaded to make it.`,
  visible: [],
  actions: ['open_screen'],
  suggestions: ['What is in the export?', 'Can I get this back in later?'],
});

/**
 * Account — signing in, so the same semester is on both devices.
 *
 * Says whether an account is signed in and nothing about who it is. An email
 * address is the one identifier the app holds about the student themselves,
 * and it has no business in a question about anything.
 */
export const account: Provide = (look) => ({
  summary: `The account screen. Signing in is never a gate — every screen works signed out. ${look.state.lastSync?.at ? `Last synced ${new Date(look.state.lastSync.at).toDateString()}.` : 'Not synced.'}`,
  visible: [],
  actions: ['open_screen'],
  suggestions: ['What does signing in change?', 'What happens to what is already on this device?'],
});

/** Privacy and your rights — what leaves, what it is used for. */
export const privacy: Provide = () => ({
  summary:
    'Privacy — what leaves this device and what it is used for. The assistant sends only what the allowlist in lib/context.ts names, and never a key, a token, a note body, or anything about another person.',
  visible: [],
  actions: ['open_screen'],
  suggestions: [
    'What exactly gets sent when I ask you something?',
    'How do I delete everything?',
    'Who else can see this?',
  ],
});
