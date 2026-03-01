-- Run this in Supabase SQL Editor (Database → SQL Editor → New query)

create table if not exists demo_tasks (
  id               uuid        default gen_random_uuid() primary key,
  user_id          uuid        references auth.users(id) on delete cascade not null,
  task_number      integer,
  task_name        text,
  priority         text,
  date_due         date,
  status           text,
  information_needed text,
  results          text,
  -- Stored as [{timestamp: "YYYY-MM-DD", text: "..."}, ...]
  -- Parsed from pipe-delimited Excel cell: "2026-03-01: note | 2026-03-02: note"
  issues_comments  jsonb       default '[]'::jsonb,
  created_at       timestamptz default now()
);

-- Row-level security: each user sees only their own tasks
alter table demo_tasks enable row level security;

create policy "Users manage their own demo tasks"
  on demo_tasks for all
  using  (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Optional: unique constraint so uploads can upsert on task_number per user
create unique index if not exists demo_tasks_user_task_number
  on demo_tasks (user_id, task_number);
