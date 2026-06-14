import { ChangeDetectionStrategy, Component, computed } from '@angular/core';
import { A2uiBase } from '../a2ui-base.directive';
import { A2uiNodeComponent } from '../a2ui-node.component';

/** Vertical stack. Renders its `children` top to bottom. */
@Component({
  selector: 'a2ui-column',
  imports: [A2uiNodeComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="a2ui-col" [style.gap.px]="prop('gap', 14)">
      @for (id of childIds(); track id) {
        <app-a2ui-node [surfaceId]="surfaceId()" [nodeId]="id" />
      }
    </div>
  `,
})
export class ColumnComponent extends A2uiBase {
  protected readonly childIds = computed(() => this.node()?.children ?? []);
}

/** Horizontal row. Wraps on small screens. */
@Component({
  selector: 'a2ui-row',
  imports: [A2uiNodeComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="a2ui-row" [style.gap.px]="prop('gap', 12)">
      @for (id of childIds(); track id) {
        <app-a2ui-node [surfaceId]="surfaceId()" [nodeId]="id" />
      }
    </div>
  `,
})
export class RowComponent extends A2uiBase {
  protected readonly childIds = computed(() => this.node()?.children ?? []);
}

/** Card surface. Accepts either a single `child` or a list of `children`. */
@Component({
  selector: 'a2ui-card',
  imports: [A2uiNodeComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="a2ui-card">
      @if (childId(); as id) {
        <app-a2ui-node [surfaceId]="surfaceId()" [nodeId]="id" />
      }
      @for (id of childIds(); track id) {
        <app-a2ui-node [surfaceId]="surfaceId()" [nodeId]="id" />
      }
    </section>
  `,
})
export class CardComponent extends A2uiBase {
  protected readonly childId = computed(() => this.node()?.child);
  protected readonly childIds = computed(() => this.node()?.children ?? []);
}
