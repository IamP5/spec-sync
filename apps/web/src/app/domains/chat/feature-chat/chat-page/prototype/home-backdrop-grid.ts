// PROTOTYPE variant A backdrop — Vercel-style dot grid with a slow spotlight beam. CSS only.
import { ChangeDetectionStrategy, Component, input } from '@angular/core';

@Component({
  selector: 'app-home-backdrop-grid',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class: 'pointer-events-none absolute inset-0 overflow-hidden',
    'aria-hidden': 'true',
    '[class.refined]': 'refined()',
  },
  template: `
    <div class="grid-dots absolute inset-0"></div>
    <div
      class="beam absolute left-1/2 top-[-40%] h-[90%] w-[60%] -translate-x-1/2"
    ></div>
    @if (refined()) {
      <div class="light-wash absolute inset-0"></div>
      <div class="cursor-light absolute inset-0"></div>
    }
    <div
      class="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-primary/60 to-transparent"
    ></div>
  `,
  styles: `
    .grid-dots {
      background-image: radial-gradient(
        circle at 1px 1px,
        color-mix(in oklab, var(--foreground) 22%, transparent) 1px,
        transparent 0
      );
      background-size: 22px 22px;
      mask-image: radial-gradient(
        ellipse 70% 60% at 50% 35%,
        #000 20%,
        transparent 75%
      );
    }
    .beam {
      background: conic-gradient(
        from 180deg at 50% 0%,
        transparent 0deg,
        color-mix(in oklab, var(--primary) 55%, transparent) 25deg,
        transparent 50deg
      );
      filter: blur(28px);
      opacity: 0.55;
      animation: sway 9s ease-in-out infinite alternate;
    }
    :host(.refined) .grid-dots {
      background-size: 24px 24px;
      opacity: 0.65;
      mask-image: radial-gradient(
        ellipse 85% 75% at 50% 30%,
        #000,
        transparent 85%
      );
    }
    :host(.refined) .beam {
      top: -55%;
      left: 50%;
      width: 110%;
      height: 120%;
      transform-origin: top center;
      background: conic-gradient(
        from 155deg at 50% 0%,
        transparent,
        color-mix(in oklab, var(--foreground) 12%, transparent) 20deg,
        transparent 38deg,
        color-mix(in oklab, var(--primary) 24%, transparent) 55deg,
        transparent 70deg
      );
      filter: blur(40px);
      opacity: 0.7;
      animation-duration: 18s;
    }
    .light-wash {
      background: radial-gradient(
        ellipse 65% 45% at 50% 0%,
        color-mix(in oklab, var(--primary) 9%, transparent),
        transparent 80%
      );
    }
    .cursor-light {
      background: radial-gradient(
        320px circle at var(--pointer-x, 50%) var(--pointer-y, 30%),
        color-mix(in oklab, var(--foreground) 5%, transparent),
        transparent 85%
      );
    }
    @keyframes sway {
      from {
        transform: translateX(-50%) rotate(-10deg);
      }
      to {
        transform: translateX(-50%) rotate(10deg);
      }
    }
    @media (prefers-reduced-motion: reduce) {
      .beam {
        animation: none;
      }
      .cursor-light {
        display: none;
      }
    }
  `,
})
export class HomeBackdropGrid {
  readonly refined = input(false);
}
