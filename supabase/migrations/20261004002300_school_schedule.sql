-- Arkadia timetable: a weekly rhythm per group (or the whole school), plus
-- one-off entries on a date (a field trip, a day off). Families see their
-- child's day and week on the family page.

create table public.school_schedule (
  id uuid primary key default gen_random_uuid(),
  group_name text,                 -- null = the whole school
  weekday smallint check (weekday between 0 and 6),   -- 0 = Sunday
  on_date date,
  start_time time not null,
  end_time time not null,
  title text not null check (length(trim(title)) > 0),
  location text,
  teacher_id uuid references public.team_members (id) on delete set null,
  notes text,
  created_at timestamptz not null default now(),
  check ((weekday is null) <> (on_date is null)),
  check (end_time > start_time)
);
create index school_schedule_group_idx on public.school_schedule (group_name);

alter table public.school_schedule enable row level security;
create policy "School staff" on public.school_schedule
  for all to authenticated
  using (public.is_school_staff()) with check (public.is_school_staff());

create or replace function public.student_page(p_token text)
returns json
language sql
stable
security definer
set search_path = ''
as $$
  select json_build_object(
    'name', s.name,
    'preferred_name', s.preferred_name,
    'group_name', s.group_name,
    'photo_path', s.photo_path,
    'about', s.about,
    'birthdate', s.birthdate,
    'today', public.org_today(),
    'updates', coalesce((
      select json_agg(json_build_object(
        'id', u.id,
        'body', u.body,
        'photo_path', u.photo_path,
        'created_at', u.created_at,
        'author', t.name
      ) order by u.created_at desc)
      from public.student_updates u
      left join public.team_members t on t.id = u.author_id
      where u.student_id = s.id and u.shared
    ), '[]'::json),
    'schedule', coalesce((
      select json_agg(json_build_object(
        'id', e.id,
        'weekday', e.weekday,
        'on_date', e.on_date,
        'start_time', e.start_time,
        'end_time', e.end_time,
        'title', e.title,
        'location', e.location,
        'teacher', t.name,
        'notes', e.notes
      ) order by e.start_time)
      from public.school_schedule e
      left join public.team_members t on t.id = e.teacher_id
      where (e.group_name is null or e.group_name = s.group_name)
        and (e.on_date is null
          or e.on_date between public.org_today() - 7 and public.org_today() + 60)
    ), '[]'::json)
  )
  from public.students s
  where s.share_token = p_token and length(p_token) >= 32;
$$;
grant execute on function public.student_page(text) to anon, authenticated;
