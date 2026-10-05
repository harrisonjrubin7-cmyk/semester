import type { Look } from './look';

/**
 * Ways to make the app easier to use, chosen by the person using it.
 *
 * Most of what "reduced distraction" and "personalized reading" mean is
 * already a look key — `calm` stops the motion, `badges` takes the numbers
 * away, `lineHeight` and `readingWidth` shape a page for reading — so the
 * presets below are just combinations of those, applied in one tap and
 * undone key by key on the Appearance page. Nothing new to maintain there.
 *
 * What was missing gets one look key, `access`, holding a comma list of the
 * modes below. It is a look key rather than a device setting for the reason
 * every look key is: it follows the person to their next device, which is the
 * point of setting it once.
 *
 * ## Never inferred
 *
 * Nothing here is switched on because of how somebody uses the app, and
 * nothing reads these to guess anything about the person. A mode is on because
 * they turned it on. There is no code path from behaviour to this key, and the
 * test holds that `readAccessModes` is the only way a mode is read.
 */

export const ACCESS_MODES = [
  { id: 'plain', label: 'Plain language', blurb: 'Plain definitions first, jargon second, on the screens that explain campus words.' },
  { id: 'chunk', label: 'One step at a time', blurb: 'Checklists show the next step alone, with the rest folded away.' },
  { id: 'predictable', label: 'Predictable layout', blurb: 'Lists keep a fixed order instead of rearranging by what is most urgent.' },
  { id: 'sensory', label: 'Sensory-friendly first', blurb: 'Quiet, low-stimulation spaces and events are listed first.' },
  { id: 'contrast', label: 'Increase contrast', blurb: 'Stronger text and borders across the app.' },
] as const;

export type AccessMode = (typeof ACCESS_MODES)[number]['id'];

const IDS = new Set<string>(ACCESS_MODES.map((m) => m.id));

/** The stored comma list, as the modes this build knows. Unknown ones are dropped. */
export function readAccessModes(stored: string | undefined): AccessMode[] {
  if (typeof stored !== 'string') return [];
  return [...new Set(stored.split(',').map((s) => s.trim()).filter((s) => IDS.has(s)))] as AccessMode[];
}

export function hasMode(stored: string | undefined, mode: AccessMode): boolean {
  return readAccessModes(stored).includes(mode);
}

/** The stored string with one mode flipped. Order is the registry's, so it diffs cleanly. */
export function toggleMode(stored: string | undefined, mode: AccessMode): string {
  const on = new Set(readAccessModes(stored));
  if (on.has(mode)) on.delete(mode);
  else on.add(mode);
  return ACCESS_MODES.map((m) => m.id)
    .filter((id) => on.has(id))
    .join(',');
}

/**
 * Presets over look keys that already exist.
 *
 * Each is a partial `Look` handed to `setLook`, so it is undone the same way
 * any single setting is — there is no preset state to get stuck in.
 */
export const PRESETS: readonly { id: string; label: string; blurb: string; look: Look }[] = [
  {
    id: 'focus',
    label: 'Focus',
    blurb: 'No motion, no counts on icons, and checklists one step at a time.',
    look: { calm: 'calm', badges: 'none' },
  },
  {
    id: 'reading',
    label: 'Easier reading',
    blurb: 'Larger text, more space between lines, letters and words, and a shorter line length.',
    look: { textSize: 'large', lineHeight: 'airy', textSpacing: 'open', readingWidth: 'narrow' },
  },
  {
    id: 'low-load',
    label: 'Lower load',
    blurb: 'Focus, plus plain language and a layout that stays put.',
    look: { calm: 'calm', badges: 'due' },
  },
];

/** Modes a preset turns on, beside the look keys it sets. */
export const PRESET_MODES: Record<string, readonly AccessMode[]> = {
  focus: ['chunk'],
  reading: [],
  'low-load': ['plain', 'predictable', 'chunk'],
};

/** The `access` string after a preset, keeping whatever else was already on. */
export function withPreset(stored: string | undefined, presetId: string): string {
  const on = new Set<string>([...readAccessModes(stored), ...(PRESET_MODES[presetId] ?? [])]);
  return ACCESS_MODES.map((m) => m.id)
    .filter((id) => on.has(id))
    .join(',');
}
