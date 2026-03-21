-- Approved submitters: nurses/staff who can submit tickets via the Submit Ticket page.
-- IT (Bruce) manages this table directly in Supabase.
create table if not exists nurse_profiles (
  id               uuid primary key default gen_random_uuid(),
  email            text unique not null,
  full_name        text not null,
  site             text not null,         -- e.g. 'Holden', 'Oakdale', 'Business Office'
  default_priority text not null default '', -- '', 'high', or 'low'
  created_at       timestamptz default now()
);

-- Any authenticated user can look up a profile by email (needed for the Submit Ticket page).
alter table nurse_profiles enable row level security;

create policy "authenticated users can read nurse_profiles"
  on nurse_profiles for select
  to authenticated
  using (true);
