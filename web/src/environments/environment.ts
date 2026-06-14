/**
 * Client configuration. These values are PUBLIC by design:
 *  - the Supabase URL and publishable key are meant to ship in the browser
 *    (row-level security, not key secrecy, protects the data).
 *
 * There is no admin identity here: who is an admin is stored in the database
 * (the `user_roles` table) and resolved via the `is_admin()` RLS helper, which
 * both the client UI and the Edge Function consult. No personal data ships.
 *
 * The Gemini API key is NEVER here: it lives only in the Supabase Edge Function.
 */
export const environment = {
  production: false,
  supabaseUrl: 'https://ggvlwqosmweggpnfdmte.supabase.co',
  // Supabase publishable key (safe for the browser).
  supabaseAnonKey: 'sb_publishable_esv25leQzefdVePPwztLQg_Cd82nyqN',
  // Name of the Edge Function that bridges Gemini + the database.
  a2uiFunction: 'a2ui',
};
