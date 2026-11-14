// Pure rules for the historical replay: stepping, the two ends and what is announced.
// Hours are whole hours since the Unix epoch (see time.ts); `first` and `last` are the replay window.

export const STEP_SIZES = [1, 6, 24] as const;
export type StepSize = (typeof STEP_SIZES)[number];
export const DEFAULT_STEP: StepSize = 1;

/** Play moves forward once per second (ux-spec: one hour per second at the 1 h step size). */
export const PLAY_INTERVAL_MS = 1000;

/** While playing, the replay time is read aloud every sixth step, not every step. */
export const ANNOUNCE_EVERY = 6;

export type Bounds = { first: number; last: number };

export function isStepSize(value: unknown): value is StepSize {
  return STEP_SIZES.some((s) => s === value);
}

export function clamp(hour: number, { first, last }: Bounds): number {
  return Math.min(Math.max(hour, first), last);
}

export const atStart = (hour: number, b: Bounds) => hour <= b.first;
export const atEnd = (hour: number, b: Bounds) => hour >= b.last;

/** One step back or forward by `size` hours; never beyond either end. It never wraps around. */
export function stepped(hour: number, direction: -1 | 1, size: number, b: Bounds): number {
  return clamp(hour + direction * size, b);
}

/** True when a step in `direction` can do something. Used for the "unavailable" state of the buttons. */
export function canStep(hour: number, direction: -1 | 1, b: Bounds): boolean {
  return direction === -1 ? !atStart(hour, b) : !atEnd(hour, b);
}

/** What one tick of Play does: the next hour, and whether playback has reached the end and must stop. */
export function playTick(hour: number, size: number, b: Bounds): { hour: number; ended: boolean } {
  const next = stepped(hour, 1, size, b);
  return { hour: next, ended: atEnd(next, b) };
}

/** Whether the replay time should be announced after this many steps of the current play run. */
export function announceThisStep(stepsPlayed: number): boolean {
  return stepsPlayed > 0 && stepsPlayed % ANNOUNCE_EVERY === 0;
}

export const START_LINE =
  "Replay starts at the first test-period hour where any machine is at or above the default alert cut-off (cut-off set on validation data). Rule fixed before results were seen.";
export const START_LINE_FALLBACK =
  "No test-period hour had a machine at or above the default alert cut-off, so the replay starts at the first test hour. Rule fixed before results were seen.";
