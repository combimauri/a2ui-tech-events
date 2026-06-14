import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { NgComponentOutlet } from '@angular/common';
import { A2uiService } from './a2ui.service';
import { A2UI_CATALOGUE } from './catalogue.token';

/**
 * Recursive dispatcher: given a node id, it looks up the node, finds the
 * matching catalogue component, and renders it via NgComponentOutlet — passing
 * the same `surfaceId`/`nodeId` inputs so each component can render itself and
 * (for containers) recurse into children. The catalogue is injected, so this
 * file has no static import of the catalogue components (avoids cycles).
 */
@Component({
  selector: 'app-a2ui-node',
  imports: [NgComponentOutlet],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (component(); as comp) {
      <ng-container *ngComponentOutlet="comp; inputs: inputs()" />
    } @else if (node()) {
      <div class="a2ui-unknown">Unknown component: {{ node()!.component }}</div>
    }
  `,
})
export class A2uiNodeComponent {
  private readonly a2ui = inject(A2uiService);
  private readonly catalogue = inject(A2UI_CATALOGUE);

  readonly surfaceId = input.required<string>();
  readonly nodeId = input.required<string>();

  protected readonly node = computed(() => this.a2ui.node(this.surfaceId(), this.nodeId()));
  protected readonly component = computed(() => {
    const node = this.node();
    return node ? (this.catalogue[node.component] ?? null) : null;
  });
  protected readonly inputs = computed(() => ({
    surfaceId: this.surfaceId(),
    nodeId: this.nodeId(),
  }));
}
