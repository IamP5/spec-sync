// PROTOTYPE variant D backdrop — a projected grid road rolling toward the viewer under a blue horizon (canvas 2D).
import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  inject,
  viewChild,
} from '@angular/core';

@Component({
  selector: 'app-home-backdrop-road',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class: 'pointer-events-none absolute inset-0 overflow-hidden',
    'aria-hidden': 'true',
  },
  template: `<canvas #c class="block h-full w-full"></canvas>
    <div
      class="absolute inset-x-0 bottom-0 h-1/3 bg-gradient-to-t from-background to-transparent"
    ></div>`,
})
export class HomeBackdropRoad {
  private readonly canvas =
    viewChild.required<ElementRef<HTMLCanvasElement>>('c');
  private readonly destroyRef = inject(DestroyRef);

  constructor() {
    afterNextRender(() => this.start());
  }

  private start(): void {
    const canvas = this.canvas().nativeElement;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
    let raf = 0;
    const t0 = performance.now();
    const frame = () => {
      const dpr = Math.min(devicePixelRatio, 2);
      const w = canvas.clientWidth,
        h = canvas.clientHeight;
      if (canvas.width !== w * dpr || canvas.height !== h * dpr) {
        canvas.width = w * dpr;
        canvas.height = h * dpr;
      }
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, w, h);
      const t = reduced ? 0 : ((performance.now() - t0) / 1000) % 1;
      const hy = h * 0.5; // horizon
      const vx = w / 2;
      // horizon glow
      const glow = ctx.createRadialGradient(vx, hy, 0, vx, hy, w * 0.5);
      glow.addColorStop(0, 'rgba(6,111,239,0.35)');
      glow.addColorStop(0.5, 'rgba(6,111,239,0.08)');
      glow.addColorStop(1, 'rgba(6,111,239,0)');
      ctx.fillStyle = glow;
      ctx.fillRect(0, 0, w, h);
      ctx.strokeStyle = 'rgba(6,111,239,1)';
      ctx.lineWidth = 1;
      // horizontal lines: depth z in (0..1], projected y = hy + (h - hy) / z * k
      for (let i = 0; i < 18; i++) {
        const z = (i + 1 - t) / 18; // rolls toward viewer
        if (z <= 0) continue;
        const y = hy + ((h - hy) * 0.06) / z;
        if (y > h) continue;
        ctx.globalAlpha = Math.min(1, (y - hy) / (h - hy)) * 0.7;
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(w, y);
        ctx.stroke();
      }
      // vertical lines converging at the vanishing point
      for (let i = -14; i <= 14; i++) {
        const xb = vx + i * w * 0.11;
        const g = ctx.createLinearGradient(0, hy, 0, h);
        g.addColorStop(0, 'rgba(6,111,239,0)');
        g.addColorStop(1, 'rgba(6,111,239,0.7)');
        ctx.strokeStyle = g;
        ctx.globalAlpha = 1;
        ctx.beginPath();
        ctx.moveTo(vx, hy);
        ctx.lineTo(xb, h);
        ctx.stroke();
      }
      ctx.globalAlpha = 1;
      // horizon line
      const hl = ctx.createLinearGradient(0, 0, w, 0);
      hl.addColorStop(0, 'rgba(6,111,239,0)');
      hl.addColorStop(0.5, 'rgba(120,180,255,0.9)');
      hl.addColorStop(1, 'rgba(6,111,239,0)');
      ctx.strokeStyle = hl;
      ctx.beginPath();
      ctx.moveTo(0, hy);
      ctx.lineTo(w, hy);
      ctx.stroke();
      if (!reduced) raf = requestAnimationFrame(frame);
    };
    frame();
    this.destroyRef.onDestroy(() => cancelAnimationFrame(raf));
  }
}
