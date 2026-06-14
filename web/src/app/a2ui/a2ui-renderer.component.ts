import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { A2uiNodeComponent } from './a2ui-node.component';
import { A2uiService } from './a2ui.service';

/**
 * Entry point for rendering a surface: it renders the node with id "root".
 * Drop `<app-a2ui-renderer [surfaceId]="..." />` anywhere a generated UI
 * should appear.
 */
@Component({
  selector: 'app-a2ui-renderer',
  imports: [A2uiNodeComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (hasRoot()) {
      <app-a2ui-node [surfaceId]="surfaceId()" nodeId="root" />
    } @else {
      <p class="a2ui-empty">Nothing to render yet.</p>
    }
  `,
})
export class A2uiRendererComponent {
  private readonly a2ui = inject(A2uiService);
  readonly surfaceId = input.required<string>();
  protected readonly hasRoot = computed(() => !!this.a2ui.node(this.surfaceId(), 'root'));
}
