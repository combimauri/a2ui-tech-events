import { computed, inject, Injectable, signal } from '@angular/core';
import type { Session } from '@supabase/supabase-js';
import { SupabaseService } from './supabase.service';

/**
 * Reactive auth state exposed as signals. Wraps Supabase magic-link auth.
 *
 * `isAdmin` reflects the caller's role in the database (the `is_admin()` RLS
 * helper, backed by the `user_roles` table) and is a convenience for the UI
 * only; every privileged action is re-authorized server-side (RLS + the Edge
 * Function), so a tampered client cannot create events.
 */
@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly sb = inject(SupabaseService).client;

  readonly session = signal<Session | null>(null);
  readonly user = computed(() => this.session()?.user ?? null);
  readonly email = computed(() => this.user()?.email ?? null);

  private readonly admin = signal(false);
  /** True when the database reports the current user as an admin. */
  readonly isAdmin = this.admin.asReadonly();

  /** Resolves once the initial session + role have been restored. */
  private readonly ready: Promise<void>;

  constructor() {
    this.ready = this.sb.auth.getSession().then(async ({ data }) => {
      this.session.set(data.session);
      await this.refreshAdmin();
    });
    this.sb.auth.onAuthStateChange((_event, session) => {
      this.session.set(session);
      void this.refreshAdmin();
    });
  }

  whenReady(): Promise<void> {
    return this.ready;
  }

  /**
   * Re-checks the caller's admin role against the database via the `is_admin()`
   * RPC and updates the `isAdmin` signal. Returns the resolved value.
   */
  async refreshAdmin(): Promise<boolean> {
    if (!this.session()) {
      this.admin.set(false);
      return false;
    }
    const { data, error } = await this.sb.rpc('is_admin');
    const ok = !error && data === true;
    this.admin.set(ok);
    return ok;
  }

  /** Sends a magic link to `email` and returns once the email is queued. */
  signIn(email: string) {
    return this.sb.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: window.location.origin },
    });
  }

  signOut() {
    return this.sb.auth.signOut();
  }
}
