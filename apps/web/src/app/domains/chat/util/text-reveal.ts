import {
  DestroyRef,
  effect,
  inject,
  InjectionToken,
  Signal,
  signal,
  untracked,
} from '@angular/core';

/**
 * Whether streamed text is revealed progressively. On by default; tests turn
 * it off so the DOM shows the full text as soon as the store has it.
 */
export const TEXT_REVEAL_ENABLED = new InjectionToken<boolean>(
  'TEXT_REVEAL_ENABLED',
  { factory: () => true },
);

/**
 * Reveal speed in characters per millisecond: from a readable pace when the
 * reveal is close to the stream up to a sprint when it falls behind, so a
 * long reply or a throttled tab never leaves it far behind.
 */
const MIN_CHARS_PER_MS = 0.12;
const MAX_CHARS_PER_MS = 0.6;
/** Backlog at which the reveal runs at full speed. */
const FULL_SPEED_BACKLOG = 1200;
/** Elapsed time assumed for the first frame after a pause. */
const DEFAULT_FRAME_MS = 16;

/**
 * Reveals `source` progressively instead of all at once. A fast model
 * delivers a reply in a handful of large chunks, which looks like the whole
 * message appearing in one go; the reveal turns those jumps into a steady
 * flow. The amount revealed per animation frame follows the time elapsed
 * since the previous frame, so a tab whose frames are throttled catches up
 * instead of crawling.
 *
 * The returned signal only ever shows a prefix of the current source. When
 * the source is replaced by a text that does not continue the shown one (a
 * new turn, a regenerated reply, a reset), the reveal starts over from it.
 *
 * Call it in an injection context; the pending frame is cancelled when that
 * injector is destroyed.
 */
export function revealText(source: Signal<string>): Signal<string> {
  if (
    !inject(TEXT_REVEAL_ENABLED) ||
    globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches
  ) {
    return source;
  }

  const shown = signal('');
  let frame: number | undefined;
  let lastFrameAt: number | undefined;

  const step = (now: number): void => {
    frame = undefined;
    const elapsed =
      lastFrameAt === undefined
        ? DEFAULT_FRAME_MS
        : Math.max(0, now - lastFrameAt);
    lastFrameAt = now;

    const target = untracked(source);
    const current = untracked(shown);
    const kept = target.startsWith(current) ? current : '';
    if (kept.length === target.length) {
      if (kept !== current) {
        shown.set(kept);
      }
      lastFrameAt = undefined;
      return;
    }
    const backlog = target.length - kept.length;
    const speed = Math.min(
      MAX_CHARS_PER_MS,
      Math.max(
        MIN_CHARS_PER_MS,
        (MAX_CHARS_PER_MS * backlog) / FULL_SPEED_BACKLOG,
      ),
    );
    const take = Math.max(1, Math.round(speed * elapsed));
    shown.set(target.slice(0, kept.length + take));
    schedule();
  };

  const schedule = (): void => {
    if (frame === undefined) {
      frame = requestAnimationFrame(step);
    }
  };

  effect(() => {
    source();
    schedule();
  });

  inject(DestroyRef).onDestroy(() => {
    if (frame !== undefined) {
      cancelAnimationFrame(frame);
    }
  });

  return shown.asReadonly();
}
