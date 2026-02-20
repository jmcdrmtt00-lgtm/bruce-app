-- Bruce IT: initial schema

create table if not exists bruce_user_profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null unique,
  email text not null,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table bruce_user_profiles enable row level security;

create policy "Users can read own profile"
  on bruce_user_profiles for select
  using (auth.uid() = user_id);

create policy "Service role full access"
  on bruce_user_profiles for all
  using (auth.role() = 'service_role');
