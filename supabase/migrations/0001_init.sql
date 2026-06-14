-- Tech-events schema: events + registrations with magic-link-friendly admin RLS.
-- This is a reference copy of what was applied to the Supabase project
-- `combi-tech-events` (ref ggvlwqosmweggpnfdmte) via MCP.

-- Roles ----------------------------------------------------------------------
-- Who is an admin lives in the database, not in client config or an env var.
-- Grant the role with a one-off insert (Studio SQL editor / service role):
--   insert into public.user_roles (user_id, role)
--   values ('<auth-user-uuid>', 'admin');
create table public.user_roles (
  user_id    uuid primary key references auth.users (id) on delete cascade,
  role       text not null default 'member' check (role in ('member', 'admin')),
  created_at timestamptz not null default now()
);

alter table public.user_roles enable row level security;

-- A user may read their own role (this is what is_admin() relies on below).
-- There is intentionally NO insert/update/delete policy: roles are assigned
-- out-of-band via the service role / Studio, so they can't be self-granted.
create policy "user_roles_select_own"
  on public.user_roles for select to authenticated
  using (user_id = auth.uid());

-- Helper: is the current request from an admin?
-- SECURITY INVOKER: it runs as the caller and reads only the caller's own
-- user_roles row (permitted by user_roles_select_own), so it needs no elevated
-- privileges, avoids the security-definer linter warnings, and — because the
-- user_roles policies never call is_admin() — introduces no RLS recursion.
create or replace function public.is_admin()
returns boolean
language sql
stable
security invoker
set search_path = public
as $$
  select exists (
    select 1 from public.user_roles
    where user_id = auth.uid() and role = 'admin'
  );
$$;

-- Events ---------------------------------------------------------------------
create table public.events (
  id          uuid primary key default gen_random_uuid(),
  title       text not null,
  description text,
  location    text,
  starts_at   timestamptz,
  ends_at     timestamptz,
  capacity    integer,
  status      text not null default 'published',
  created_by  uuid references auth.users (id) on delete set null,
  created_at  timestamptz not null default now()
);

alter table public.events enable row level security;

create policy "events_select_authenticated"
  on public.events for select to authenticated using (true);

create policy "events_insert_admin"
  on public.events for insert to authenticated with check (public.is_admin());

create policy "events_update_admin"
  on public.events for update to authenticated
  using (public.is_admin()) with check (public.is_admin());

create policy "events_delete_admin"
  on public.events for delete to authenticated using (public.is_admin());

-- Registrations --------------------------------------------------------------
create table public.registrations (
  id         uuid primary key default gen_random_uuid(),
  event_id   uuid not null references public.events (id) on delete cascade,
  user_id    uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (event_id, user_id)
);

alter table public.registrations enable row level security;

create policy "registrations_select_own_or_admin"
  on public.registrations for select to authenticated
  using (user_id = auth.uid() or public.is_admin());

create policy "registrations_insert_self"
  on public.registrations for insert to authenticated
  with check (user_id = auth.uid());

create policy "registrations_delete_own_or_admin"
  on public.registrations for delete to authenticated
  using (user_id = auth.uid() or public.is_admin());

create index registrations_event_id_idx on public.registrations (event_id);
create index events_starts_at_idx on public.events (starts_at);
