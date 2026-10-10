-- Recurring services per property (weekly cleaning, monthly garden...). A daily
-- job turns them into Operations tasks linked to the lot, so they show on the
-- board and in the property's maintenance log like any other task.

create table public.property_services (
  id uuid primary key default gen_random_uuid(),
  lot_id uuid not null references public.lots (id) on delete cascade,
  title text not null check (length(trim(title)) > 0),
  maint_category text not null default 'cleaning'
    check (maint_category in ('repair', 'garden', 'pool', 'cleaning', 'inspection', 'build', 'other')),
  freq text not null check (freq in ('once', 'weekly', 'monthly', 'yearly')),
  every int not null default 1 check (every between 1 and 52),
  weekday smallint check (weekday between 0 and 6),          -- 0 = Monday, for weekly
  month_day smallint check (month_day between 1 and 31),     -- for monthly (clamped to month end)
  start_date date not null,
  end_date date,
  assignee_id uuid references public.team_members (id) on delete set null,
  notes text,
  owner_visible boolean not null default true,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  check (freq <> 'weekly' or weekday is not null),
  check (freq <> 'monthly' or month_day is not null),
  check (end_date is null or end_date >= start_date)
);
create index property_services_lot_idx on public.property_services (lot_id);

alter table public.tasks
  add column service_id uuid references public.property_services (id) on delete set null;
create unique index tasks_service_day_idx on public.tasks (service_id, due_date) where service_id is not null;

alter table public.property_services enable row level security;
create policy "Estate staff" on public.property_services
  for all to authenticated
  using (public.is_estate_staff()) with check (public.is_estate_staff());

-- Does the service fall on this day?
create or replace function public.service_on(s public.property_services, d date)
returns boolean
language sql
stable
set search_path = ''
as $$
  select d >= s.start_date and (s.end_date is null or d <= s.end_date) and case s.freq
    when 'once' then d = s.start_date
    when 'weekly' then
      extract(isodow from d)::int - 1 = s.weekday
      and ((date_trunc('week', d)::date - date_trunc('week', s.start_date)::date) / 7) % s.every = 0
    when 'monthly' then
      extract(day from d)::int = least(s.month_day,
        extract(day from (date_trunc('month', d) + interval '1 month - 1 day'))::int)
      and ((extract(year from d)::int - extract(year from s.start_date)::int) * 12
           + extract(month from d)::int - extract(month from s.start_date)::int) % s.every = 0
    when 'yearly' then
      extract(month from d) = extract(month from s.start_date)
      and extract(day from d) = least(extract(day from s.start_date),
        extract(day from (date_trunc('month', d) + interval '1 month - 1 day')))
      and (extract(year from d)::int - extract(year from s.start_date)::int) % s.every = 0
  end;
$$;

-- Create the tasks for the next p_days (all services, or one). Safe to repeat.
create or replace function public.generate_service_tasks(p_service uuid default null, p_days int default 60)
returns int
language plpgsql
security definer
set search_path = ''
as $$
declare n int;
begin
  if auth.uid() is not null and not public.is_estate_staff() then
    raise exception 'Only the team can do that.' using errcode = '42501';
  end if;
  with ins as (
    insert into public.tasks (title, description, kind, maint_category, status, due_date,
      lot_id, assignee_id, owner_visible, service_id, location)
    select s.title, s.notes, 'maintenance', s.maint_category, 'backlog', d::date,
      s.lot_id, s.assignee_id, s.owner_visible, s.id, coalesce(l.name, 'Lot ' || l.code)
    from public.property_services s
    join public.lots l on l.id = s.lot_id
    cross join lateral generate_series(
      greatest(s.start_date, public.org_today()), public.org_today() + p_days, interval '1 day') d
    where s.active and (p_service is null or s.id = p_service)
      and public.service_on(s, d::date)
    on conflict do nothing
    returning 1
  )
  select count(*) into n from ins;
  return n;
end $$;
revoke all on function public.generate_service_tasks(uuid, int) from public, anon;
grant execute on function public.generate_service_tasks(uuid, int) to authenticated, service_role;

-- After a service is edited or paused: drop its not-yet-started future tasks and
-- make them again from the new rule. Past and started tasks stay as they are.
create or replace function public.resync_service(p_service uuid)
returns int
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.is_estate_staff() then
    raise exception 'Only the team can do that.' using errcode = '42501';
  end if;
  delete from public.tasks
  where service_id = p_service and status = 'backlog' and due_date >= public.org_today();
  return public.generate_service_tasks(p_service);
end $$;
revoke all on function public.resync_service(uuid) from public, anon;
grant execute on function public.resync_service(uuid) to authenticated;
