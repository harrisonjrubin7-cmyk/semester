import type { Screen } from './types';

/**
 * The one control surface under Me.
 *
 * What Semester knows about you, who can see it, and how to change either was
 * spread over a dozen screens — Profile, Your data, Privacy, Connect, four
 * settings pages, Export, Account — each reachable, none of them from one
 * place. A student who wanted to know "who can see my plan" had to know that
 * sharing lives on the privacy screen, and one who wanted to stop being
 * emailed had to know that is under Settings → Alerts. The brief's rule is
 * that nobody should hunt through unrelated settings to learn what the app
 * holds or who can see it, so this is one list, in the order the questions
 * come: who I am, what is held, who sees it, what the assistant may do, what
 * I am told, how it looks, and how to leave.
 *
 * Every row opens a screen that already exists. Nothing here is a new home
 * for anything: the screens keep their own, and this keeps the row that opens
 * each — the same rule `screens/Me.tsx` applies to Settings and the directory.
 * `mecontrols.test.ts` holds every target to the registry or the settings list,
 * so a row cannot point at a screen nobody can otherwise reach.
 */
export interface MeControl {
  id: string;
  label: string;
  /** One line, in the second person, saying what is there. */
  sub: string;
  screen: Screen;
}

export const CONTROLS: readonly MeControl[] = [
  { id: 'profile', label: 'My profile', sub: 'Your name, your school and your term', screen: 'profile' },
  { id: 'data', label: 'My data', sub: 'Every record the app holds, and how much room is left', screen: 'data' },
  { id: 'connected', label: 'Connected accounts', sub: 'Calendars and services you linked, and how to unlink them', screen: 'connect' },
  { id: 'sharing', label: 'Sharing', sub: 'Who can see what you shared, until when, and how to take it back', screen: 'privacy' },
  { id: 'ai', label: 'AI controls', sub: 'What the assistant may see and do, and what it costs', screen: 'setAssistant' },
  { id: 'notifications', label: 'Notifications', sub: 'What you are told about, and when', screen: 'setAlerts' },
  { id: 'accessibility', label: 'Accessibility preferences', sub: 'Text size, spacing, typeface, contrast and motion', screen: 'setLook' },
  { id: 'activity', label: 'Activity', sub: 'What you did and what you shared, in order, with the source of each', screen: 'activity' },
  { id: 'whatsnew', label: 'What changed', sub: 'What is new in the app, what changed for you, and known issues', screen: 'whatsnew' },
  { id: 'recovery', label: 'Recovery', sub: 'Unsynced work, this device’s copy, and how to get back what went missing', screen: 'recovery' },
  { id: 'export', label: 'Export data', sub: 'Everything you added, in files you can open elsewhere', screen: 'export' },
  { id: 'deletion', label: 'Request deletion', sub: 'Delete your account and what it holds, or erase this device', screen: 'privacy' },
  { id: 'support-access', label: 'Support access', sub: 'Whether Semester support may see your account, and for how long', screen: 'privacy' },
  { id: 'billing', label: 'Billing', sub: 'Your plan, and what every plan always includes', screen: 'account' },
  { id: 'security', label: 'Security', sub: 'Your sign-in and your sessions', screen: 'account' },
];

/** The rows, minus any whose screen the caller says is not offered. */
export function controlsOffered(offered: (screen: Screen) => boolean, controls: readonly MeControl[] = CONTROLS): MeControl[] {
  return controls.filter((c) => offered(c.screen));
}
