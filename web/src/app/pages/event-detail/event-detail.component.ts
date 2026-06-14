import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { A2uiService } from '../../a2ui/a2ui.service';
import { A2uiRendererComponent } from '../../a2ui/a2ui-renderer.component';

/**
 * Renders a single event as a Gemini-generated A2UI surface, including a
 * register / cancel button. The surface refreshes itself when the user acts.
 */
@Component({
  selector: 'app-event-detail',
  imports: [A2uiRendererComponent, RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="page narrow">
      <a class="back-link" routerLink="/">← All events</a>
      @if (loading()) {
        <p class="a2ui-text muted">Loading event…</p>
      } @else if (error()) {
        <p class="a2ui-error" role="alert">{{ error() }}</p>
      } @else {
        <app-a2ui-renderer [surfaceId]="surfaceId" />
      }
    </div>
  `,
})
export class EventDetailComponent {
  private readonly route = inject(ActivatedRoute);
  private readonly a2ui = inject(A2uiService);

  private readonly eventId = this.route.snapshot.paramMap.get('id') ?? '';
  protected readonly surfaceId = `event-${this.eventId}`;
  protected readonly loading = signal(true);
  protected readonly error = signal('');

  constructor() {
    this.load();
  }

  private async load(): Promise<void> {
    try {
      await this.a2ui.generate({
        mode: 'event_detail',
        surfaceId: this.surfaceId,
        eventId: this.eventId,
      });
    } catch (err) {
      this.error.set(err instanceof Error ? err.message : 'Failed to load event.');
    } finally {
      this.loading.set(false);
    }
  }
}
