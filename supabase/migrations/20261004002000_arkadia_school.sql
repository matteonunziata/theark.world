-- Arkadia, the school at The ARK: students, their parents, and updates
-- teachers share with families. Only admins and the school division see it.
-- Parents read a student's page through a private link (no account needed).

alter table public.divisions
  add column is_school boolean not null default false;

insert into public.divisions (name, color, description, is_school)
values ('Arkadia', 'plum', 'The school: students, teachers, and families.', true);

create or replace function public.is_school_staff()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.has_role('admin') or exists (
    select 1 from public.divisions d
    where d.id = public.staff_division() and d.is_school
  );
$$;
grant execute on function public.is_school_staff() to authenticated;

create table public.students (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(trim(name)) > 0),
  preferred_name text,
  birthdate date,
  group_name text,                 -- class or age group
  photo_path text,                 -- school bucket
  about text,                      -- shared with the family
  staff_notes text,                -- allergies, needs, never shared
  status text not null default 'active' check (status in ('active', 'alumni')),
  start_date date,
  share_token text not null unique
    default replace(gen_random_uuid()::text, '-', '')
      || replace(gen_random_uuid()::text, '-', ''),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger students_updated_at before update on public.students
  for each row execute function public.set_updated_at();

create table public.student_guardians (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.students (id) on delete cascade,
  name text not null check (length(trim(name)) > 0),
  relation text,
  email extensions.citext,
  phone text,
  created_at timestamptz not null default now()
);
create index student_guardians_student_idx on public.student_guardians (student_id);

create table public.student_updates (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.students (id) on delete cascade,
  author_id uuid references public.team_members (id) on delete set null,
  body text not null check (length(trim(body)) between 1 and 5000),
  photo_path text,
  shared boolean not null default true,
  created_at timestamptz not null default now()
);
create index student_updates_student_idx
  on public.student_updates (student_id, created_at desc);

alter table public.students enable row level security;
alter table public.student_guardians enable row level security;
alter table public.student_updates enable row level security;

create policy "School staff" on public.students
  for all to authenticated
  using (public.is_school_staff()) with check (public.is_school_staff());
create policy "School staff" on public.student_guardians
  for all to authenticated
  using (public.is_school_staff()) with check (public.is_school_staff());
create policy "School staff read updates" on public.student_updates
  for select to authenticated using (public.is_school_staff());
create policy "School staff post as themselves" on public.student_updates
  for insert to authenticated
  with check (public.is_school_staff() and author_id = public.current_staff_id());
create policy "Authors and admins edit updates" on public.student_updates
  for update to authenticated
  using (author_id = public.current_staff_id() or public.has_role('admin'))
  with check (public.is_school_staff());
create policy "Authors and admins delete updates" on public.student_updates
  for delete to authenticated
  using (author_id = public.current_staff_id() or public.has_role('admin'));

-- What a family sees through the private link: the profile and shared
-- updates only. Staff notes and other families' details never leave here.
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
    ), '[]'::json)
  )
  from public.students s
  where s.share_token = p_token and length(p_token) >= 32;
$$;
grant execute on function public.student_page(text) to anon, authenticated;

-- Photos: public bucket, random file names, no listing. Only school staff
-- can add or remove.
insert into storage.buckets (id, name, public)
values ('school', 'school', true)
on conflict (id) do nothing;

create policy "School staff upload photos" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'school' and public.is_school_staff());
create policy "School staff replace photos" on storage.objects
  for update to authenticated
  using (bucket_id = 'school' and public.is_school_staff());
create policy "School staff delete photos" on storage.objects
  for delete to authenticated
  using (bucket_id = 'school' and public.is_school_staff());
