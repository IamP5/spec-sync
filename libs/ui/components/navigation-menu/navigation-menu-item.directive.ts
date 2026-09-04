import { computed, Directive, input } from '@angular/core';

import type { ClassValue } from 'clsx';

import { navigationMenuItemVariants } from '@/ui/components/navigation-menu/navigation-menu.variants';
import { mergeClasses } from '@/ui/utils/merge-classes';

@Directive({
  selector: '[z-navigation-menu-item]',
  host: {
    '[class]': 'classes()',
    'data-slot': 'navigation-menu-item',
  },
  exportAs: 'zNavigationMenuItem',
})
export class ZardNavigationMenuItemDirective {
  readonly class = input<ClassValue>('');

  protected readonly classes = computed(() => mergeClasses(navigationMenuItemVariants(), this.class()));
}
