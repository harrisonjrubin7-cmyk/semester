export interface Clock { now(): Date }
export const systemClock: Clock = { now: () => new Date() };
/** A clock tests can move. */
export function fixedClock(start: string): Clock & { advance(ms: number): void } {
  let current = new Date(start).getTime();
  return { now: () => new Date(current), advance: (ms) => { current += ms; } };
}
export function iso(clock: Clock): string { return clock.now().toISOString(); }
