import { computed, Directive, inject, input } from '@angular/core';
import { A2uiService } from './a2ui.service';
import { ComponentNode } from './a2ui.models';

/**
 * Shared base for every catalogue component. Each component is handed the
 * `surfaceId` it lives on and its own `nodeId`; from those it resolves its
 * node and any bound props. Signal inputs declared here are inherited by the
 * concrete components (the base is decorated with `@Directive()`).
 */
@Directive()
export abstract class A2uiBase {
  protected readonly a2ui = inject(A2uiService);

  readonly surfaceId = input.required<string>();
  readonly nodeId = input.required<string>();

  protected readonly node = computed<ComponentNode | undefined>(() =>
    this.a2ui.node(this.surfaceId(), this.nodeId()),
  );

  /** Read a (possibly bound) prop, falling back when absent/empty. */
  protected prop<T>(key: string, fallback: T): T {
    const node = this.node();
    if (!node) return fallback;
    const value = this.a2ui.resolve(this.surfaceId(), node[key]);
    return (value ?? fallback) as T;
  }

  /** The JSON Pointer behind a bound prop (for write-back), if any. */
  protected path(key: string): string | undefined {
    return this.a2ui.bindingPath(this.surfaceId(), this.nodeId(), key);
  }
}
