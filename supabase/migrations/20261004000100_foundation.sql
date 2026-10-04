-- Foundation: organization, divisions, team, and the role helpers every
-- other policy builds on.

create extension if not exists citext with schema extensions;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- Organization (single row) ------------------------------------------------

create table public.org_settings (
  id boolean primary key default true check (id),
  name text,
  location text not null default 'Santa Teresa, Costa Rica',
  currency text not null default 'CRC' check (currency in ('CRC', 'USD')),
  currency2 text default 'USD' check (currency2 in ('CRC', 'USD')),
  timezone text not null default 'America/Costa_Rica',
  language text not null default 'en' check (language in ('en', 'es')),
  email text,
  updated_at timestamptz not null default now()
);
insert into public.org_settings default values;

create trigger org_settings_updated_at before update on public.org_settings
  for each row execute function public.set_updated_at();

-- Divisions and team -------------------------------------------------------

create table public.divisions (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(trim(name)) > 0),
  description text,
  color text not null default 'leaf'
    check (color in ('leaf', 'sea', 'sun', 'clay', 'plum', 'slate')),
  lead_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.team_members (
  id uuid primary key default gen_random_uuid(),
  user_id uuid unique references auth.users (id) on delete set null,
  email extensions.citext unique,
  name text not null check (length(trim(name)) > 0),
  title text,
  type text not null default 'team'
    check (type in ('team', 'facilitator', 'crew', 'contractor')),
  division_id uuid references public.divisions (id) on delete set null,
  role text not null default 'lead'
    check (role in (
      'admin', 'lead', 'sales', 'facilitator', 'security', 'shop', 'crew'
    )),
  responsibilities text,
  phone text,
  start_date date,
  status text not null default 'active'
    check (status in ('active', 'inactive')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.divisions
  add constraint divisions_lead_id_fkey
  foreign key (lead_id) references public.team_members (id) on delete set null;

create index team_members_division_idx on public.team_members (division_id);

create trigger divisions_updated_at before update on public.divisions
  for each row execute function public.set_updated_at();
create trigger team_members_updated_at before update on public.team_members
  for each row execute function public.set_updated_at();

-- Role helpers ---------------------------------------------------------------
-- Security definer so policies can call them without recursing into RLS.

create or replace function public.current_staff_id()
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select id from public.team_members
  where user_id = auth.uid() and status = 'active';
$$;

create or replace function public.staff_role()
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select role from public.team_members
  where user_id = auth.uid() and status = 'active';
$$;

create or replace function public.staff_division()
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select division_id from public.team_members
  where user_id = auth.uid() and status = 'active';
$$;

create or replace function public.is_staff()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.staff_role() is not null;
$$;

create or replace function public.has_role(variadic roles text[])
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(public.staff_role() = any (roles), false);
$$;

-- Link a team member to their auth user by email, whichever is created first.

create or replace function public.link_team_member_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.email is not null and new.user_id is null then
    select u.id into new.user_id
    from auth.users u
    where lower(u.email) = lower(new.email::text);
  end if;
  return new;
end;
$$;

create trigger team_members_link_user
  before insert or update of email on public.team_members
  for each row execute function public.link_team_member_user();

-- RLS ------------------------------------------------------------------------

alter table public.org_settings enable row level security;
alter table public.divisions enable row level security;
alter table public.team_members enable row level security;

create policy "Staff read org" on public.org_settings
  for select to authenticated using (public.is_staff());
create policy "Admins update org" on public.org_settings
  for update to authenticated
  using (public.has_role('admin')) with check (public.has_role('admin'));

create policy "Staff read divisions" on public.divisions
  for select to authenticated using (public.is_staff());
create policy "Admins write divisions" on public.divisions
  for all to authenticated
  using (public.has_role('admin')) with check (public.has_role('admin'));

create policy "Staff read team" on public.team_members
  for select to authenticated using (public.is_staff());
create policy "Admins write team" on public.team_members
  for all to authenticated
  using (public.has_role('admin')) with check (public.has_role('admin'));

-- Public bits of the org (name, place, time zone) for portal and event pages.
create or replace function public.public_org()
returns table (name text, location text, timezone text, currency text)
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(name, 'The ARK'), location, timezone, currency
  from public.org_settings;
$$;
grant execute on function public.public_org() to anon, authenticated;

-- "Today" in the organization's time zone.
create or replace function public.org_today()
returns date
language sql
stable
security definer
set search_path = ''
as $$
  select (now() at time zone timezone)::date from public.org_settings;
$$;
grant execute on function public.org_today() to anon, authenticated;
