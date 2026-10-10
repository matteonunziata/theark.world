-- Tickets: several types per event, sales windows, sequential release, add-ons, quantities ----
-- kind: 'main' is the admission; 'addon' is optional and rides on a main ticket (e.g. Lunch).
-- sales_start / sales_end: venue-local date and time. Empty means no limit on that side.
-- unlocks_after_ticket_id: this type is only on sale once that one has sold out for the date.
-- max_per_order: most of this type one booking can take.
alter table public.ticket_types
  add column if not exists kind text not null default 'main'
    check (kind in ('main', 'addon')),
  add column if not exists sales_start timestamp,
  add column if not exists sales_end timestamp,
  add column if not exists max_per_order int not null default 10
    check (max_per_order > 0),
  add column if not exists unlocks_after_ticket_id uuid
    references public.ticket_types (id) on delete set null;

alter table public.ticket_types
  add constraint ticket_types_sales_window
    check (sales_start is null or sales_end is null or sales_end > sales_start),
  add constraint ticket_types_not_self_unlock
    check (unlocks_after_ticket_id is null or unlocks_after_ticket_id <> id);

-- A booking can hold several tickets. seats = main tickets, what counts against capacity.
alter table public.registrations
  add column if not exists seats int not null default 1 check (seats >= 1),
  add column if not exists phone text;

create table public.registration_items (
  id uuid primary key default gen_random_uuid(),
  registration_id uuid not null references public.registrations (id) on delete cascade,
  ticket_type_id uuid references public.ticket_types (id) on delete set null,
  qty int not null check (qty > 0),
  unit_price numeric(14, 2) not null default 0 check (unit_price >= 0),
  currency text not null default 'CRC' check (currency in ('CRC', 'USD')),
  unique (registration_id, ticket_type_id)
);
create index registration_items_ticket_idx on public.registration_items (ticket_type_id);

-- Every booking made so far has one ticket (or none).
insert into public.registration_items (registration_id, ticket_type_id, qty, unit_price, currency)
select r.id, r.ticket_type_id, 1, t.price, t.currency
from public.registrations r
join public.ticket_types t on t.id = r.ticket_type_id;

alter table public.registration_items enable row level security;

create policy "Read registration items" on public.registration_items
  for select to authenticated
  using (exists (select 1 from public.registrations r where r.id = registration_id));
create policy "Staff manage registration items" on public.registration_items
  for all to authenticated
  using (exists (
    select 1 from public.registrations r
    where r.id = registration_id and public.can_manage_offering(r.offering_id)
  ))
  with check (exists (
    select 1 from public.registrations r
    where r.id = registration_id and public.can_manage_offering(r.offering_id)
  ));

-- Bookings that name a ticket but come without items (staff adding someone, older code)
-- get the one item. book_tickets writes its own and turns this off for its insert.
create or replace function public.default_registration_item()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.ticket_type_id is not null
    and coalesce(current_setting('ark.items_managed', true), '') <> 'on' then
    insert into public.registration_items (registration_id, ticket_type_id, qty, unit_price, currency)
    select new.id, t.id, new.seats, t.price, t.currency
    from public.ticket_types t where t.id = new.ticket_type_id;
  end if;
  return null;
end;
$$;
create trigger registrations_default_item
  after insert on public.registrations
  for each row execute function public.default_registration_item();

-- How many of a ticket are taken for a date (confirmed, or a hold that hasn't lapsed).
create or replace function public.ticket_taken(p_ticket uuid, p_date date)
returns int
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(sum(i.qty), 0)::int
  from public.registration_items i
  join public.registrations r on r.id = i.registration_id
  where i.ticket_type_id = p_ticket
    and r.session_date = p_date
    and public.registration_live(r);
$$;

-- Where a ticket stands for a date: ok, not_started, ended, sold_out or locked.
create or replace function public.ticket_state(p_ticket uuid, p_date date)
returns text
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  t public.ticket_types;
  prev public.ticket_types;
  v_now timestamp := public.org_now();
begin
  select * into t from public.ticket_types where id = p_ticket;
  if not found then return 'ended'; end if;
  if t.sales_start is not null and t.sales_start > v_now then return 'not_started'; end if;
  if t.sales_end is not null and t.sales_end <= v_now then return 'ended'; end if;
  if t.qty is not null and public.ticket_taken(t.id, p_date) >= t.qty then return 'sold_out'; end if;
  if t.unlocks_after_ticket_id is not null then
    select * into prev from public.ticket_types where id = t.unlocks_after_ticket_id;
    if found and (prev.qty is null or public.ticket_taken(prev.id, p_date) < prev.qty) then
      return 'locked';
    end if;
  end if;
  return 'ok';
end;
$$;

-- What the booking page shows for each ticket on a date.
create or replace function public.ticket_availability(p_offering_id uuid, p_date date)
returns table (ticket_type_id uuid, taken int, state text)
language sql
stable
security definer
set search_path = ''
as $$
  select t.id, public.ticket_taken(t.id, p_date), public.ticket_state(t.id, p_date)
  from public.ticket_types t
  where t.offering_id = p_offering_id
    and public.can_view_offering(p_offering_id)
  order by t.position;
$$;
revoke execute on function public.ticket_taken(uuid, date) from anon, public;
revoke execute on function public.ticket_state(uuid, date) from anon, public;
revoke execute on function public.ticket_availability(uuid, date) from public;
grant execute on function public.ticket_availability(uuid, date) to anon, authenticated;

-- Counts: main tickets by type, plus bookings with no ticket, in seats. Add-ons don't take a seat.
create or replace function public.session_counts(
  p_offering_id uuid,
  p_from date,
  p_to date
)
returns table (session_date date, ticket_type_id uuid, taken bigint)
language sql
stable
security definer
set search_path = ''
as $$
  select r.session_date, i.ticket_type_id, sum(i.qty)::bigint
  from public.registrations r
  join public.registration_items i on i.registration_id = r.id
  join public.ticket_types t on t.id = i.ticket_type_id and t.kind = 'main'
  where r.offering_id = p_offering_id
    and r.session_date between p_from and p_to
    and public.registration_live(r)
    and public.can_view_offering(p_offering_id)
  group by r.session_date, i.ticket_type_id
  union all
  select r.session_date, null::uuid, sum(r.seats)::bigint
  from public.registrations r
  where r.offering_id = p_offering_id
    and r.session_date between p_from and p_to
    and public.registration_live(r)
    and public.can_view_offering(p_offering_id)
    and not exists (select 1 from public.registration_items i where i.registration_id = r.id)
  group by r.session_date;
$$;

-- Booking: any number of tickets in one go -------------------------------------------------
-- p_items: [{"ticket_type_id": "...", "qty": 2}, ...]. Same rules as book_session, plus
-- sales windows, release order, per-order limits, add-ons and seats against capacity.
create or replace function public.book_tickets(
  p_offering_id uuid,
  p_session_date date,
  p_name text,
  p_email text,
  p_phone text default null,
  p_items jsonb default '[]'::jsonb
)
returns table (registration_id uuid, qr_token text)
language plpgsql
security definer
set search_path = ''
as $$
declare
  o public.offerings;
  t public.ticket_types;
  it record;
  member_id uuid := public.current_member_contact_id();
  v_email text := lower(trim(coalesce(p_email, '')));
  v_name text := trim(coalesce(p_name, ''));
  v_phone text := nullif(trim(coalesce(p_phone, '')), '');
  v_items jsonb := coalesce(p_items, '[]'::jsonb);
  taken int;
  has_tickets boolean;
  v_status text := 'confirmed';
  v_hold timestamptz;
  v_seats int := 0;
  v_main uuid;
  v_total numeric := 0;
  v_stripe boolean := false;
  v_reg uuid;
  v_token text;
  v_state text;
  v_any boolean := false;
begin
  select * into o from public.offerings where id = p_offering_id for update;
  if not found or o.status <> 'published' then
    raise exception 'This isn''t available to book.' using errcode = 'P0001';
  end if;

  if member_id is null and not (o.kind <> 'class' and o.access = 'everyone') then
    raise exception 'Only members can book this. Sign in to the members portal.'
      using errcode = 'P0001';
  end if;

  if member_id is not null then
    select c.name, lower(c.email::text) into v_name, v_email
    from public.contacts c where c.id = member_id;
  end if;

  if v_name = '' or v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then
    raise exception 'Enter your name and a valid email.' using errcode = 'P0001';
  end if;

  if jsonb_typeof(v_items) <> 'array' then
    raise exception 'Choose a ticket.' using errcode = 'P0001';
  end if;

  if p_session_date < public.org_today()
    or not public.occurs_on(o, p_session_date)
    or exists (
      select 1 from public.session_cancellations
      where offering_id = o.id and session_date = p_session_date
    ) then
    raise exception 'That date isn''t on the schedule.' using errcode = 'P0001';
  end if;

  if member_id is not null and o.kind = 'class'
    and p_session_date > public.org_today() + 14 then
    raise exception 'Classes open for booking two weeks ahead. Check back closer to the date.'
      using errcode = 'P0001';
  end if;

  if o.booking_cutoff_minutes is not null and o.start_time is not null
    and (p_session_date + o.start_time) - make_interval(mins => o.booking_cutoff_minutes)
      <= public.org_now() then
    raise exception 'Booking for this session has closed.' using errcode = 'P0001';
  end if;

  -- A hold that lapsed unpaid is gone; the same person can book again.
  delete from public.registrations r
  where r.offering_id = o.id and r.session_date = p_session_date
    and r.email = v_email::extensions.citext
    and r.status = 'held' and r.hold_until is not null and r.hold_until <= now();

  if exists (
    select 1 from public.registrations r
    where r.offering_id = o.id and r.session_date = p_session_date
      and r.email = v_email::extensions.citext
  ) then
    raise exception 'You''re already booked for this session.'
      using errcode = 'P0001';
  end if;

  select exists (select 1 from public.ticket_types where offering_id = o.id)
    into has_tickets;
  if jsonb_array_length(v_items) = 0 and has_tickets and member_id is null then
    raise exception 'Choose a ticket.' using errcode = 'P0001';
  end if;

  -- One line per ticket type, however the page sent them.
  for it in
    select (e ->> 'ticket_type_id')::uuid as ticket_type_id, sum((e ->> 'qty')::int)::int as qty
    from jsonb_array_elements(v_items) e
    where coalesce((e ->> 'qty')::int, 0) > 0
    group by 1
    order by 1
  loop
    v_any := true;
    select * into t from public.ticket_types
    where id = it.ticket_type_id and offering_id = o.id;
    if not found then
      raise exception 'Choose a ticket.' using errcode = 'P0001';
    end if;
    if it.qty > t.max_per_order then
      raise exception 'You can book up to % of %.', t.max_per_order, t.name using errcode = 'P0001';
    end if;
    v_state := public.ticket_state(t.id, p_session_date);
    if v_state = 'not_started' then
      raise exception '% isn''t on sale yet.', t.name using errcode = 'P0001';
    elsif v_state = 'ended' then
      raise exception 'Sales for % have ended.', t.name using errcode = 'P0001';
    elsif v_state = 'locked' then
      raise exception '% isn''t available yet.', t.name using errcode = 'P0001';
    elsif v_state = 'sold_out' then
      raise exception '% just sold out.', t.name using errcode = 'P0001';
    end if;
    if t.qty is not null and public.ticket_taken(t.id, p_session_date) + it.qty > t.qty then
      raise exception 'Only % left of %.',
        t.qty - public.ticket_taken(t.id, p_session_date), t.name using errcode = 'P0001';
    end if;
    if t.kind = 'main' then
      v_seats := v_seats + it.qty;
      v_main := coalesce(v_main, t.id);
    end if;
    if t.pay_first then
      v_status := 'held';
    end if;
    v_total := v_total + t.price * it.qty;
    if t.stripe_price_id is not null then v_stripe := true; end if;
  end loop;

  if v_any and v_seats = 0 then
    raise exception 'Choose a main ticket first. Add-ons come with one.' using errcode = 'P0001';
  end if;
  if v_seats = 0 then v_seats := 1; end if;

  select coalesce(sum(r.seats), 0) into taken from public.registrations r
  where r.offering_id = o.id and r.session_date = p_session_date
    and public.registration_live(r);
  if o.capacity is not null and taken + v_seats > o.capacity then
    if o.capacity - taken <= 0 then
      raise exception 'Sorry, this session just filled up.' using errcode = 'P0001';
    end if;
    raise exception 'Only % spots left.', o.capacity - taken using errcode = 'P0001';
  end if;

  if v_status = 'held' then
    -- Online payment has half an hour; an outside link or the desk waits for staff to mark it paid.
    v_hold := case when v_total > 0 or v_stripe then now() + interval '30 minutes' end;
  end if;

  perform set_config('ark.items_managed', 'on', true);
  insert into public.registrations as r (
    offering_id, session_date, ticket_type_id, contact_id, user_id,
    name, email, phone, seats, source, status, hold_until
  ) values (
    o.id, p_session_date, v_main, member_id,
    case when member_id is not null then auth.uid() end,
    v_name, v_email, v_phone, v_seats,
    case when member_id is not null then 'portal' else 'public' end,
    v_status, v_hold
  )
  returning r.id, r.qr_token into v_reg, v_token;
  perform set_config('ark.items_managed', 'off', true);

  insert into public.registration_items (registration_id, ticket_type_id, qty, unit_price, currency)
  select v_reg, b.ticket_type_id, b.qty, tt.price, tt.currency
  from (
    select (e ->> 'ticket_type_id')::uuid as ticket_type_id, sum((e ->> 'qty')::int)::int as qty
    from jsonb_array_elements(v_items) e
    where coalesce((e ->> 'qty')::int, 0) > 0
    group by 1
  ) b
  join public.ticket_types tt on tt.id = b.ticket_type_id;

  return query select v_reg, v_token;
end;
$$;
revoke execute on function public.book_tickets(uuid, date, text, text, text, jsonb) from public;
grant execute on function public.book_tickets(uuid, date, text, text, text, jsonb) to anon, authenticated;

-- book_session: the one-ticket way in, now the same rules as everything else ----------------
create or replace function public.book_session(
  p_offering_id uuid,
  p_session_date date,
  p_name text,
  p_email text,
  p_ticket_type_id uuid default null
)
returns table (registration_id uuid, qr_token text)
language plpgsql
security definer
set search_path = ''
as $$
begin
  return query
  select * from public.book_tickets(
    p_offering_id, p_session_date, p_name, p_email, null,
    case when p_ticket_type_id is null then '[]'::jsonb
      else jsonb_build_array(jsonb_build_object('ticket_type_id', p_ticket_type_id, 'qty', 1)) end
  );
end;
$$;

-- Ticket revenue counts every ticket in a booking, at the price it was sold for --------------
create or replace function public.ticket_sales_for_month(p_month date)
returns numeric
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.has_role('admin') then
    raise exception 'Finance is restricted.' using errcode = '42501';
  end if;
  return coalesce((
    select sum(i.unit_price * i.qty)
    from public.registrations r
    join public.registration_items i on i.registration_id = r.id
    where r.paid
      and date_trunc('month', r.session_date) = date_trunc('month', p_month)
  ), 0);
end;
$$;
