import { ChangeDetectionStrategy, Component, computed } from '@angular/core';
import { A2uiBase } from '../a2ui-base.directive';

/** Body text. `variant: "muted"` dims it. */
@Component({
  selector: 'a2ui-text',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<p class="a2ui-text" [class.muted]="muted()">{{ prop('text', '') }}</p>`,
})
export class TextComponent extends A2uiBase {
  protected readonly muted = computed(() => this.prop<string>('variant', '') === 'muted');
}

/** Section heading. */
@Component({
  selector: 'a2ui-heading',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<h2 class="a2ui-heading">{{ prop('text', '') }}</h2>`,
})
export class HeadingComponent extends A2uiBase {}

/** Small pill, e.g. a tag or status. */
@Component({
  selector: 'a2ui-badge',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<span class="a2ui-badge">{{ prop('text', '') }}</span>`,
})
export class BadgeComponent extends A2uiBase {}

/** Horizontal rule. */
@Component({
  selector: 'a2ui-divider',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<hr class="a2ui-divider" />`,
})
export class DividerComponent extends A2uiBase {}

/** Remote image. `src` and `alt` are supported. */
@Component({
  selector: 'a2ui-image',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (prop('src', '')) {
      <img class="a2ui-image" [src]="prop('src', '')" [alt]="prop('alt', '')" />
    }
  `,
})
export class ImageComponent extends A2uiBase {}
