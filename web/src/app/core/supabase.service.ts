import { Injectable } from '@angular/core';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { environment } from '../../environments/environment';

/**
 * Thin singleton wrapper around a single shared Supabase browser client.
 * Used for magic-link auth, reading events/registrations (under RLS), and
 * invoking the `a2ui` Edge Function.
 */
@Injectable({ providedIn: 'root' })
export class SupabaseService {
  readonly client: SupabaseClient = createClient(
    environment.supabaseUrl,
    environment.supabaseAnonKey,
    {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        // Completes the magic-link flow when the user lands back on the app.
        detectSessionInUrl: true,
      },
    },
  );
}
