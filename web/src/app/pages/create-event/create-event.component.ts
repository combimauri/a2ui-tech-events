import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { A2uiService } from '../../a2ui/a2ui.service';
import { A2uiRendererComponent } from '../../a2ui/a2ui-renderer.component';

/**
 * Admin-only. The admin describes an event in plain language; Gemini (via the
 * Edge Function) returns an A2UI form pre-filled from that description, which
 * the renderer draws. Submitting the form runs the `submit_event` action.
 */
@Component({
  selector: 'app-create-event',
  imports: [ReactiveFormsModule, A2uiRendererComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="page narrow">
      <h1>Create an event</h1>
      <p class="hint">
        Describe the event in a sentence or two — AI drafts the form for you to review.
      </p>

      <section class="a2ui-card">
        <label class="a2ui-field">
          <span class="a2ui-label">Describe your event</span>
          <textarea
            class="a2ui-input a2ui-textarea"
            rows="3"
            [formControl]="prompt"
            placeholder="e.g. A free 2-day Angular & AI workshop in Berlin on Oct 14–15, 80 seats"
          ></textarea>
        </label>
        @if (error()) { <p class="a2ui-error" role="alert">{{ error() }}</p> }
        <button class="a2ui-btn" type="button" [disabled]="generating()" (click)="generate()">
          {{ generating() ? 'Generating…' : hasForm() ? 'Regenerate form' : 'Generate form' }}
        </button>
      </section>

      @if (hasForm()) {
        <div class="generated">
          <app-a2ui-renderer [surfaceId]="surfaceId" />
        </div>
      }
    </div>
  `,
})
export class CreateEventComponent {
  private readonly a2ui = inject(A2uiService);

  protected readonly surfaceId = 'create-event';
  protected readonly prompt = new FormControl('', { nonNullable: true });
  protected readonly generating = signal(false);
  protected readonly error = signal('');
  protected readonly hasForm = computed(() => !!this.a2ui.surface(this.surfaceId));

  protected async generate(): Promise<void> {
    this.generating.set(true);
    this.error.set('');
    this.a2ui.clear(this.surfaceId);
    try {
      await this.a2ui.generate({
        mode: 'create_event_form',
        surfaceId: this.surfaceId,
        prompt: this.prompt.value,
      });
    } catch (err) {
      this.error.set(err instanceof Error ? err.message : 'Failed to generate form.');
    } finally {
      this.generating.set(false);
    }
  }
}
