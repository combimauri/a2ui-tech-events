import { ChangeDetectionStrategy, Component, computed, signal } from '@angular/core';
import { A2uiBase } from '../a2ui-base.directive';
import { ComponentAction } from '../a2ui.models';

/**
 * Interactive button. On click it fires its declared `action`:
 *  - `event`        -> round-trips through the Edge Function (Gemini / DB);
 *  - `functionCall` -> a client-side effect (navigate / openUrl).
 * Shows a pending state while the round-trip is in flight and surfaces errors.
 */
@Component({
  selector: 'a2ui-button',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="a2ui-button-wrap">
      <button
        type="button"
        class="a2ui-btn"
        [class.secondary]="variant() === 'secondary'"
        [class.ghost]="variant() === 'ghost'"
        [disabled]="pending() || !!prop('disabled', false)"
        (click)="onClick()"
      >
        {{ pending() ? 'Working…' : prop('text', 'Submit') }}
      </button>
      @if (error()) { <p class="a2ui-error" role="alert">{{ error() }}</p> }
    </div>
  `,
})
export class ButtonComponent extends A2uiBase {
  protected readonly pending = signal(false);
  protected readonly error = signal('');
  protected readonly variant = computed(() => this.prop<string>('variant', 'primary'));

  protected async onClick(): Promise<void> {
    const action = this.node()?.action as ComponentAction | undefined;
    if (!action) return;
    this.error.set('');

    if (action.functionCall) {
      this.a2ui.handleFunctionCall(this.surfaceId(), action.functionCall);
      return;
    }
    if (action.event) {
      this.pending.set(true);
      try {
        await this.a2ui.dispatch(this.surfaceId(), action.event, this.nodeId());
      } catch (err) {
        this.error.set(err instanceof Error ? err.message : 'Something went wrong.');
      } finally {
        this.pending.set(false);
      }
    }
  }
}
