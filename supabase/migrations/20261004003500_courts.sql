-- Padel and pickleball courts, booked by the slot. Staff book for anyone;
-- members book for themselves in the portal (up to 14 days ahead, two
-- slots a day). Classes held at the courts block the matching court.

create table public.courts (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(trim(name)) > 0),
  sport text not null default 'padel' check (sport in ('padel', 'pickleball')),
  open_time time not null default '07:00',
  close_time time not null default '20:00',
  slot_minutes smallint not null default 60 check (slot_minutes between 15 and 240),
  active boolean not null default true,
  position int not null default 0,
  created_at timestamptz not null default now(),
  check (close_time > open_time)
);

create table public.court_bookings (
  id uuid primary key default gen_random_uuid(),
  court_id uuid not null references public.courts (id) on delete cascade,
  date date not null,
  start_time time not null,
  end_time time not null,
  contact_id uuid references public.contacts (id) on delete set null,
  name text not null check (length(trim(name)) > 0),
  email extensions.citext,
  phone text,
  players smallint check (players between 1 and 8),
  notes text,
  status text not null default 'booked' check (status in ('booked', 'cancelled')),
  source text not null default 'staff' check (source in ('staff', 'portal')),
  created_by uuid references public.team_members (id) on delete set null,
  created_at timestamptz not null default now(),
  check (end_time > start_time),
  -- One booking per court at a time (cancelled ones don't count).
  constraint court_bookings_no_overlap exclude using gist (
    court_id with =,
    tsrange(date + start_time, date + end_time) with &&
  ) where (status = 'booked')
);
create index court_bookings_day_idx on public.court_bookings (date, court_id);
create index court_bookings_contact_idx on public.court_bookings (contact_id);

alter table public.courts enable row level security;
alter table public.court_bookings enable row level security;

create policy "Staff read courts" on public.courts
  for select to authenticated using (public.is_staff() or public.is_member());
create policy "Admins and leads manage courts" on public.courts
  for all to authenticated
  using (public.has_role('admin', 'lead')) with check (public.has_role('admin', 'lead'));

create policy "Staff manage court bookings" on public.court_bookings
  for all to authenticated
  using (public.has_role('admin', 'lead', 'sales', 'facilitator'))
  with check (public.has_role('admin', 'lead', 'sales', 'facilitator'));

-- Does a class at the courts cover this court at this time? Classes held
-- "at the courts" with "padel" or "pickleball" in the title block that
-- sport's courts; any other class there blocks every court.
create or replace function public.court_class_at(p_court uuid, p_date date, p_start time, p_end time)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select o.title
  from public.offerings o, public.courts c
  where c.id = p_court
    and o.status = 'published'
    and o.location ilike '%court%'
    and public.occurs_on(o, p_date)
    and not exists (
      select 1 from public.session_cancellations x
      where x.offering_id = o.id and x.session_date = p_date
    )
    and o.start_time < p_end and o.end_time > p_start
    and (
      (o.title ilike '%padel%' and c.sport = 'padel')
      or (o.title ilike '%pickleball%' and c.sport = 'pickleball')
      or (o.title not ilike '%padel%' and o.title not ilike '%pickleball%')
    )
  limit 1;
$$;

-- What members see for a day: taken slots (no names) and their own.
create or replace function public.court_day(p_date date)
returns table (id uuid, court_id uuid, start_time time, end_time time, mine boolean)
language sql
stable
security definer
set search_path = ''
as $$
  select b.id, b.court_id, b.start_time, b.end_time,
    b.contact_id is not null and b.contact_id = public.current_member_contact_id()
  from public.court_bookings b
  where b.date = p_date and b.status = 'booked'
    and (public.is_member() or public.is_staff());
$$;

create or replace function public.book_court(p_court uuid, p_date date, p_start time)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  me uuid := public.current_member_contact_id();
  c public.courts;
  p public.contacts;
  e time;
  today date := public.org_today();
  now_local time := (now() at time zone (select timezone from public.org_settings limit 1))::time;
  bid uuid;
begin
  if me is null then raise exception 'Court booking is for members.'; end if;
  select * into c from public.courts where id = p_court and active;
  if not found then raise exception 'That court isn’t available.'; end if;
  if p_date < today or p_date > today + 14 then
    raise exception 'Courts can be booked up to two weeks ahead.';
  end if;
  e := p_start + make_interval(mins => c.slot_minutes);
  if p_start < c.open_time or e > c.close_time
    or extract(epoch from (p_start - c.open_time))::int % (c.slot_minutes * 60) <> 0 then
    raise exception 'Pick one of the listed times.';
  end if;
  if p_date = today and p_start <= now_local then
    raise exception 'That time has passed.';
  end if;
  if public.court_class_at(p_court, p_date, p_start, e) is not null then
    raise exception 'There’s a class on that court then.';
  end if;
  if (select count(*) from public.court_bookings
      where contact_id = me and date = p_date and status = 'booked') >= 2 then
    raise exception 'You can book two slots a day.';
  end if;
  select * into p from public.contacts where id = me;
  begin
    insert into public.court_bookings (court_id, date, start_time, end_time, contact_id, name, email, phone, source)
    values (p_court, p_date, p_start, e, me, p.name, p.email, p.phone, 'portal')
    returning id into bid;
  exception when exclusion_violation then
    raise exception 'Someone just booked that slot. Try another.';
  end;
  return bid;
end;
$$;

create or replace function public.cancel_court_booking(p_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.court_bookings
  set status = 'cancelled'
  where id = p_id
    and contact_id = public.current_member_contact_id()
    and status = 'booked'
    and date >= public.org_today();
  if not found then raise exception 'That booking can’t be cancelled.'; end if;
end;
$$;

revoke all on function public.court_class_at(uuid, date, time, time) from public, anon;
revoke all on function public.court_day(date) from public, anon;
revoke all on function public.book_court(uuid, date, time) from public, anon;
revoke all on function public.cancel_court_booking(uuid) from public, anon;
grant execute on function public.court_class_at(uuid, date, time, time) to authenticated;
grant execute on function public.court_day(date) to authenticated;
grant execute on function public.book_court(uuid, date, time) to authenticated;
grant execute on function public.cancel_court_booking(uuid) to authenticated;

insert into public.courts (name, sport, position) values
  ('Padel court', 'padel', 0),
  ('Pickleball court', 'pickleball', 1);

-- A member's own upcoming court bookings.
create or replace function public.my_court_bookings()
returns table (id uuid, court text, date date, start_time time, end_time time)
language sql
stable
security definer
set search_path = ''
as $$
  select b.id, c.name, b.date, b.start_time, b.end_time
  from public.court_bookings b join public.courts c on c.id = b.court_id
  where b.contact_id = public.current_member_contact_id()
    and b.status = 'booked'
    and b.date >= public.org_today()
  order by b.date, b.start_time;
$$;
revoke all on function public.my_court_bookings() from public, anon;
grant execute on function public.my_court_bookings() to authenticated;
