import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { AuthService } from '../../core/auth.service';
import { SupabaseService } from '../../core/supabase.service';
import { EventRow } from '../../core/models';

@Component({
  selector: 'app-home',
  imports: [RouterLink, DatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="page">
      <header class="page-head">
        <div>
          <h1>Tech events</h1>
          <p class="hint" style="margin:0">Browse upcoming events and reserve your spot.</p>
        </div>
        @if (auth.isAdmin()) {
          <a class="a2ui-btn" routerLink="/create">+ Create event</a>
        }
      </header>

      @if (loading()) {
        <div class="event-grid" aria-hidden="true">
          @for (i of [1, 2, 3]; track i) { <div class="event-card skeleton"></div> }
        </div>
        <p class="a2ui-text muted" role="status">Loading events…</p>
      } @else if (error()) {
        <p class="a2ui-error" role="alert">{{ error() }}</p>
      } @else if (events().length === 0) {
        <section class="empty-state">
          <span class="empty-state__icon" aria-hidden="true">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                 stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
              <rect x="3" y="4" width="18" height="18" rx="2" />
              <path d="M16 2v4M8 2v4M3 10h18" />
            </svg>
          </span>
          <h2 class="a2ui-heading">No events yet</h2>
          @if (auth.isAdmin()) {
            <p class="muted">Describe an event and let AI draft it for you.</p>
            <a class="a2ui-btn" routerLink="/create">+ Create the first event</a>
          } @else {
            <p class="muted">Check back soon — new events are on the way.</p>
          }
        </section>
      } @else {
        <div class="event-grid">
          @for (event of events(); track event.id) {
            <a class="event-card" [routerLink]="['/events', event.id]">
              <div class="event-card__top">
                @if (event.starts_at) {
                  <span class="cal" aria-hidden="true">
                    <span class="cal__m">{{ event.starts_at | date: 'MMM' }}</span>
                    <span class="cal__d">{{ event.starts_at | date: 'd' }}</span>
                  </span>
                }
                <h2>{{ event.title }}</h2>
              </div>
              @if (event.starts_at) {
                <span class="event-card__meta">
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                       stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                    <circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" />
                  </svg>
                  {{ event.starts_at | date: 'EEE, MMM d · h:mm a' }}
                </span>
              }
              @if (event.location) {
                <span class="event-card__meta">
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                       stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                    <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z" /><circle cx="12" cy="10" r="3" />
                  </svg>
                  {{ event.location }}
                </span>
              }
            </a>
          }
        </div>
      }
    </div>
  `,
  styles: `
    .empty-state {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 0.65rem;
      text-align: center;
      padding: 3.5rem 1.5rem;
      border: 1px dashed var(--border-strong);
      border-radius: var(--radius);
      background: var(--surface);
    }
    .empty-state__icon {
      display: grid;
      place-items: center;
      width: 56px;
      height: 56px;
      border-radius: 14px;
      background: var(--accent-soft);
      color: var(--accent-text);
      margin-bottom: 0.25rem;
    }
    .empty-state p { margin: 0 0 0.5rem; }
    .skeleton {
      height: 140px;
      background: linear-gradient(100deg, var(--surface) 30%, var(--surface-3) 50%, var(--surface) 70%);
      background-size: 200% 100%;
      animation: shimmer 1.3s infinite;
      cursor: default;
    }
    @keyframes shimmer { to { background-position: -200% 0; } }
  `,
})
export class HomeComponent {
  private readonly supabase = inject(SupabaseService).client;
  protected readonly auth = inject(AuthService);

  protected readonly events = signal<EventRow[]>([]);
  protected readonly loading = signal(true);
  protected readonly error = signal('');

  constructor() {
    this.load();
  }

  private async load(): Promise<void> {
    const { data, error } = await this.supabase
      .from('events')
      .select('*')
      .order('starts_at', { ascending: true });
    if (error) this.error.set(error.message);
    else this.events.set((data ?? []) as EventRow[]);
    this.loading.set(false);
  }
}
