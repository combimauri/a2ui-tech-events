/** Row shapes mirroring the Supabase `events` / `registrations` tables. */
export interface EventRow {
  id: string;
  title: string;
  description: string | null;
  location: string | null;
  starts_at: string | null;
  ends_at: string | null;
  capacity: number | null;
  status: string;
  created_by: string | null;
  created_at: string;
}
