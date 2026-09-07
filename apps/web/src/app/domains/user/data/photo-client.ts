import { DOCUMENT } from '@angular/common';
import { inject, Injectable, resource } from '@angular/core';

/** Longest wait for a photo before the account card falls back to initials. */
const PHOTO_TIMEOUT_MS = 4000;

/** Outcome of a preload; `url` ties it to the photo it was made for. */
export interface PhotoPreload {
  url: string;
  shown: boolean;
}

/**
 * Loads profile photos ahead of rendering them, so the account card can keep
 * its skeleton until the picture is decoded and then appear in one step.
 */
@Injectable({ providedIn: 'root' })
export class PhotoClient {
  private readonly document = inject(DOCUMENT);

  /** Resolves once the photo behind `url` is decoded, or when it cannot be shown in time. */
  preloadResource(url: () => string | null | undefined) {
    return resource({
      params: () => url() ?? undefined,
      loader: async ({ params, abortSignal }) => ({
        url: params,
        shown: await this.preload(params, abortSignal),
      }),
    });
  }

  private preload(url: string, signal: AbortSignal): Promise<boolean> {
    return new Promise<boolean>((resolve) => {
      const image = this.document.createElement('img');
      const timer = setTimeout(() => settle(false), PHOTO_TIMEOUT_MS);
      const abort = () => settle(false);
      const settle = (shown: boolean) => {
        clearTimeout(timer);
        signal.removeEventListener('abort', abort);
        resolve(shown);
      };
      signal.addEventListener('abort', abort, { once: true });
      image.addEventListener('error', () => settle(false), { once: true });
      image.decoding = 'async';
      image.src = url;
      const decoded =
        typeof image.decode === 'function'
          ? image.decode()
          : new Promise<void>((done) =>
              image.addEventListener('load', () => done(), { once: true }),
            );
      decoded.then(
        () => settle(true),
        () => settle(false),
      );
    });
  }
}
