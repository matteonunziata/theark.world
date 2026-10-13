-- Arkadia teacher view: a weekly curriculum (one theme per week, optionally
-- per group) and homework set for a group. School staff only.

create table public.school_curriculum (
  id uuid primary key default gen_random_uuid(),
  group_name text,                 -- null = the whole school
  week_no smallint not null check (week_no between 1 and 60),
  starts_on date not null,         -- the Monday the week begins
  title text not null check (length(trim(title)) > 0),
  summary text,
  daily jsonb not null default '[]'::jsonb,  -- [{ "day": "Mon", "plan": "..." }]
  created_at timestamptz not null default now()
);
create index school_curriculum_starts_idx on public.school_curriculum (starts_on);

create table public.school_homework (
  id uuid primary key default gen_random_uuid(),
  group_name text,                 -- null = every group
  title text not null check (length(trim(title)) > 0),
  details text,
  assigned_on date not null default current_date,
  due_on date,
  created_at timestamptz not null default now()
);
create index school_homework_due_idx on public.school_homework (due_on desc);

alter table public.school_curriculum enable row level security;
alter table public.school_homework enable row level security;

create policy "School staff" on public.school_curriculum
  for all to authenticated
  using (public.is_school_staff()) with check (public.is_school_staff());
create policy "School staff" on public.school_homework
  for all to authenticated
  using (public.is_school_staff()) with check (public.is_school_staff());
