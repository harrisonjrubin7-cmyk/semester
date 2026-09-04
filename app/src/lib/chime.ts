/**
 * The sound a timer or an alarm makes.
 *
 * Made rather than fetched: shipping an audio file means a request the offline
 * app would have to cache and the network might not answer at the one moment
 * it matters. Two notes a fifth apart, twice, out of WebAudio.
 *
 * Quiet on purpose. The overlay is the alarm; this is the nudge.
 *
 * A browser refuses to make any sound until the page has been interacted
 * with. That is not a bug to work around — it is the rule that stops pages
 * shouting at people — so failure is swallowed and nothing depends on it
 * having worked.
 */
export function chime(): void {
  try {
    const Ctor =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return;
    const ctx = new Ctor();
    const at = ctx.currentTime;
    for (const [i, hz] of [660, 990, 660, 990].entries()) {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.value = hz;
      const start = at + i * 0.22;
      // Ramped rather than switched: an oscillator cut off at full amplitude
      // makes a click, which is the sound of a bug rather than a bell.
      gain.gain.setValueAtTime(0.0001, start);
      gain.gain.exponentialRampToValueAtTime(0.14, start + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.2);
      osc.connect(gain).connect(ctx.destination);
      osc.start(start);
      osc.stop(start + 0.22);
    }
    setTimeout(() => void ctx.close(), 1400);
  } catch {
    // No audio, or no gesture yet. The overlay is the alarm.
  }
}
