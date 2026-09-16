// PROTOTYPE variant C backdrop — canvas particles drifting into the Ford blue oval, with mouse parallax.
import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  inject,
  viewChild,
} from '@angular/core';

interface Particle {
  x: number;
  y: number;
  tx: number;
  ty: number;
  s: number;
  a: number;
  ph: number;
  ring: boolean;
}

@Component({
  selector: 'app-home-backdrop-particles',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class: 'pointer-events-none absolute inset-0 overflow-hidden',
    'aria-hidden': 'true',
    '(document:pointermove)': 'onMove($event)',
  },
  template: `<canvas #c class="block h-full w-full"></canvas>`,
})
export class HomeBackdropParticles {
  private readonly canvas =
    viewChild.required<ElementRef<HTMLCanvasElement>>('c');
  private readonly destroyRef = inject(DestroyRef);
  private mx = 0;
  private my = 0;

  constructor() {
    afterNextRender(() => this.start());
  }

  protected onMove(e: PointerEvent): void {
    this.mx = (e.clientX / innerWidth - 0.5) * 2;
    this.my = (e.clientY / innerHeight - 0.5) * 2;
  }

  private start(): void {
    const canvas = this.canvas().nativeElement;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
    const N = 1100;
    const ps: Particle[] = [];
    for (let i = 0; i < N; i++) {
      const ring = i < N * 0.72;
      ps.push({
        x: Math.random(),
        y: Math.random(),
        tx: 0,
        ty: 0,
        s: ring ? 0.9 + Math.random() * 1.4 : 0.5 + Math.random() * 1.1,
        a: ring ? 0.35 + Math.random() * 0.55 : 0.08 + Math.random() * 0.25,
        ph: Math.random() * Math.PI * 2,
        ring,
      });
    }
    let raf = 0;
    let w = 0,
      h = 0,
      dpr = 1;
    const layout = () => {
      dpr = Math.min(devicePixelRatio, 2);
      w = canvas.clientWidth;
      h = canvas.clientHeight;
      canvas.width = w * dpr;
      canvas.height = h * dpr;
      const narrow = w < 640;
      const cx = w / 2,
        cy = narrow ? 150 : h * 0.42;
      const rx = narrow ? w * 0.47 : Math.min(w * 0.42, 420),
        ry = rx * 0.4;
      ps.forEach((p, i) => {
        if (p.ring) {
          const t = (i / (N * 0.72)) * Math.PI * 2;
          const band = 1 + (Math.random() - 0.5) * 0.09; // outer + inner ring feel
          p.tx = cx + Math.cos(t) * rx * band;
          p.ty = cy + Math.sin(t) * ry * band;
        } else {
          p.tx = Math.random() * w;
          p.ty = Math.random() * h;
        }
        if (p.x <= 1 && p.y <= 1) {
          p.x = p.x * w;
          p.y = p.y * h;
        }
      });
    };
    layout();
    const ro = new ResizeObserver(layout);
    ro.observe(canvas);
    const t0 = performance.now();
    const frame = () => {
      const t = (performance.now() - t0) / 1000;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, w, h);
      const px = this.mx * 18,
        py = this.my * 12;
      for (const p of ps) {
        const wob = reduced ? 0 : 2.2;
        const gx =
          p.tx + Math.sin(t * 0.8 + p.ph) * wob + (p.ring ? px : px * 0.4);
        const gy =
          p.ty + Math.cos(t * 0.7 + p.ph) * wob + (p.ring ? py : py * 0.4);
        p.x += (gx - p.x) * (reduced ? 1 : 0.045);
        p.y += (gy - p.y) * (reduced ? 1 : 0.045);
        const tw = 0.7 + 0.3 * Math.sin(t * 2 + p.ph);
        ctx.globalAlpha = p.a * tw;
        ctx.fillStyle = p.ring ? '#1a6fe8' : '#5aa2ff';
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.s, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
      // soft glow inside the oval
      const cx = w / 2,
        cy = w < 640 ? 150 : h * 0.42;
      const g = ctx.createRadialGradient(
        cx,
        cy,
        0,
        cx,
        cy,
        Math.min(w * 0.42, 420),
      );
      g.addColorStop(0, 'rgba(6,111,239,0.16)');
      g.addColorStop(1, 'rgba(6,111,239,0)');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, w, h);
      if (!reduced) raf = requestAnimationFrame(frame);
    };
    frame();
    this.destroyRef.onDestroy(() => {
      cancelAnimationFrame(raf);
      ro.disconnect();
    });
  }
}
