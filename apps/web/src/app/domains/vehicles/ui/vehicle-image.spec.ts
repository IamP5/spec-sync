import { TestBed } from '@angular/core/testing';

import type { VehicleImageMetadata } from '../data/vehicle-contracts';
import { VehicleImage } from './vehicle-image';

const photo: VehicleImageMetadata = {
  url: `https://storage.googleapis.com/specsync-dev-vehicle-images/vehicles/primary/${'a'.repeat(64)}/ranger.jpg`,
  sha256: 'a'.repeat(64),
  width: 1280,
  height: 509,
  altText: 'Ford Ranger Black',
  matchScope: 'ILLUSTRATIVE',
  sourcePageUrl: 'https://www.ford.com.br/picapes/ranger/',
};

describe('VehicleImage', () => {
  it('renders the public photo with accessible text and illustrative labeling', async () => {
    const fixture = TestBed.createComponent(VehicleImage);
    fixture.componentRef.setInput('image', photo);
    await fixture.whenStable();
    const host: HTMLElement = fixture.nativeElement;
    const image = host.querySelector('img');
    expect(image?.getAttribute('src')).toBe(photo.url);
    expect(image?.alt).toBe(photo.altText);
    expect(image?.getAttribute('loading')).toBe('lazy');
    expect(host.textContent).toContain('Illustrative image');
  });

  it('shows a fallback when absent or failed and retries a different image', async () => {
    const fixture = TestBed.createComponent(VehicleImage);
    await fixture.whenStable();
    const host: HTMLElement = fixture.nativeElement;
    expect(
      host.querySelector('[aria-label="Vehicle image not available"]'),
    ).not.toBeNull();
    fixture.componentRef.setInput('image', photo);
    await fixture.whenStable();
    host.querySelector('img')?.dispatchEvent(new Event('error'));
    await fixture.whenStable();
    expect(host.querySelector('img')).toBeNull();
    expect(
      host.querySelector('[aria-label="Vehicle image not available"]'),
    ).not.toBeNull();
    fixture.componentRef.setInput('image', {
      ...photo,
      url: photo.url.replace('ranger.jpg', 'other.jpg'),
    });
    await fixture.whenStable();
    expect(host.querySelector('img')?.src).toContain('/other.jpg');
  });
});
