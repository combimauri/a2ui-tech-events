import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormControl, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '../../core/auth.service';

@Component({
  selector: 'app-login',
  imports: [ReactiveFormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="page narrow auth">
      <section class="a2ui-card auth-card">
        <span class="auth-icon" aria-hidden="true">
          @if (sent()) {
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                 stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
              <path d="M4 6h16v12H4z" /><path d="m4 7 8 6 8-6" />
            </svg>
          } @else {
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                 stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
              <rect x="5" y="11" width="14" height="10" rx="2" /><path d="M8 11V7a4 4 0 0 1 8 0v4" />
            </svg>
          }
        </span>

        @if (sent()) {
          <h1 class="a2ui-heading">Check your inbox</h1>
          <p class="a2ui-text muted">
            We sent a magic link to <strong style="color:var(--text)">{{ email.value }}</strong>.
            Open it on this device to finish signing in.
          </p>
          <button class="a2ui-btn secondary" type="button" (click)="reset()">Use a different email</button>
        } @else {
          <h1 class="a2ui-heading">Sign in</h1>
          <p class="a2ui-text muted">One-time magic link — no password needed.</p>
          <form (submit)="submit($event)">
            <label class="a2ui-field">
              <span class="a2ui-label">Email address</span>
              <input
                class="a2ui-input"
                type="email"
                autocomplete="email"
                inputmode="email"
                [formControl]="email"
                placeholder="you@example.com"
                aria-describedby="email-help"
              />
            </label>
            @if (error()) {
              <p class="a2ui-error" role="alert">{{ error() }}</p>
            } @else {
              <p id="email-help" class="a2ui-label" style="margin:0">We'll never share your email.</p>
            }
            <button class="a2ui-btn" type="submit" [disabled]="pending() || email.invalid">
              {{ pending() ? 'Sending…' : 'Send magic link' }}
            </button>
          </form>
        }
      </section>
    </div>
  `,
  styles: `
    .auth { display: flex; justify-content: center; padding-top: 4rem; }
    .auth-card { width: 100%; max-width: 420px; }
    .auth-icon {
      display: grid;
      place-items: center;
      width: 48px;
      height: 48px;
      border-radius: 12px;
      background: var(--accent-soft);
      color: var(--accent-text);
    }
    .auth-card form { display: flex; flex-direction: column; gap: 1rem; }
  `,
})
export class LoginComponent {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  protected readonly email = new FormControl('', {
    nonNullable: true,
    validators: [Validators.required, Validators.email],
  });
  protected readonly sent = signal(false);
  protected readonly pending = signal(false);
  protected readonly error = signal('');

  constructor() {
    this.auth.whenReady().then(() => {
      if (this.auth.session()) this.router.navigateByUrl('/');
    });
  }

  protected async submit(event: Event): Promise<void> {
    event.preventDefault();
    if (this.email.invalid) return;
    this.pending.set(true);
    this.error.set('');
    const { error } = await this.auth.signIn(this.email.value);
    this.pending.set(false);
    if (error) this.error.set(error.message);
    else this.sent.set(true);
  }

  protected reset(): void {
    this.sent.set(false);
    this.error.set('');
    this.email.reset('');
  }
}
