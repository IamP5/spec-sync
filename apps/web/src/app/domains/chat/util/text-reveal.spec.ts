import { Injector, runInInjectionContext, Signal, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';

import { revealText, TEXT_REVEAL_ENABLED } from './text-reveal';

const FRAME_MS = 16;

describe('revealText', () => {
  let frames: FrameRequestCallback[];
  let clock: number;

  beforeEach(() => {
    frames = [];
    clock = 0;
    vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
      frames.push(callback);
      return frames.length;
    });
    vi.stubGlobal('cancelAnimationFrame', () => undefined);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  /** Runs the pending frame callbacks as if `elapsed` milliseconds had passed. */
  function nextFrame(elapsed = FRAME_MS): void {
    clock += elapsed;
    const pending = frames.splice(0);
    for (const callback of pending) {
      callback(clock);
    }
  }

  function reveal(source: Signal<string>): Signal<string> {
    return runInInjectionContext(TestBed.inject(Injector), () =>
      revealText(source),
    );
  }

  it('reveals the source a few characters per frame', () => {
    const source = signal('');
    const shown = reveal(source);

    source.set('hello world');
    TestBed.tick();
    nextFrame();
    expect(shown().length).toBeGreaterThan(0);
    expect(shown().length).toBeLessThan('hello world'.length);
    expect('hello world'.startsWith(shown())).toBe(true);

    for (let i = 0; i < 20 && shown() !== 'hello world'; i++) {
      nextFrame();
    }
    expect(shown()).toBe('hello world');
  });

  it('catches up after a long gap between frames', () => {
    const source = signal('x'.repeat(600));
    const shown = reveal(source);
    TestBed.tick();
    nextFrame();
    const afterOneFrame = shown().length;

    nextFrame(2000);
    expect(shown().length).toBeGreaterThan(afterOneFrame + 100);
  });

  it('starts over when the source no longer continues the shown text', () => {
    const source = signal('abcdefgh');
    const shown = reveal(source);
    TestBed.tick();
    nextFrame();
    expect(shown().length).toBeGreaterThan(0);

    source.set('xyz');
    TestBed.tick();
    nextFrame();
    expect('xyz'.startsWith(shown())).toBe(true);
    expect(shown()).not.toBe('');
  });

  it('returns the source itself when disabled', () => {
    TestBed.configureTestingModule({
      providers: [{ provide: TEXT_REVEAL_ENABLED, useValue: false }],
    });
    const source = signal('all at once');
    const shown = reveal(source);
    expect(shown()).toBe('all at once');
  });
});
