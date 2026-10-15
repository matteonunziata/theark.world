-- Events: one email can book more than once, and everyone reserves a ticket ------------------
-- 1. Booking again with the same email (more tickets later, or an add-on such as lunch) is
--    allowed: the one-per-email rule is gone. Each purchase is its own booking with its own QR.
-- 2. An add-on can be bought on its own when the email already holds a ticket for that date.
--    It takes no seat, so seats may now be 0.
-- 3. Members choose a ticket like everyone else, so the team can count expected attendance.
do $$
declare c text;
begin
  for c in
    select con.conname from pg_constraint con
    where con.conrelid = 'public.registrations'::regclass and con.contype = 'u'
      and (select array_agg(a.attname::text order by a.attname) from pg_attribute a
           where a.attrelid = con.conrelid and a.attnum = any (con.conkey))
        = array['email', 'offering_id', 'session_date']
  loop
    execute format('alter table public.registrations drop constraint %I', c);
  end loop;
end $$;
create index if not exists registrations_offering_date_email_idx
  on public.registrations (offering_id, session_date, email);

do $$
declare c text;
begin
  for c in
    select con.conname from pg_constraint con
    where con.conrelid = 'public.registrations'::regclass and con.contype = 'c'
      and pg_get_constraintdef(con.oid) ilike '%seats >= 1%'
  loop
    execute format('alter table public.registrations drop constraint %I', c);
  end loop;
end $$;
alter table public.registrations add constraint registrations_seats_check check (seats >= 0);

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
  v_has_booking boolean := false;
begin
  select * into o from public.offerings where id = p_offering_id for update;
  if not found or o.status <> 'published' then
    raise exception 'This isn''t available to book.' using errcode = 'P0001';
  end if;

  if member_id is null and not public.is_open_to_public(o.id) then
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

  -- The same email can book again for the same date: more tickets later, or an add-on.
  select exists (
    select 1 from public.registrations r
    where r.offering_id = o.id and r.session_date = p_session_date
      and r.email = v_email::extensions.citext
      and r.seats >= 1 and public.registration_live(r)
  ) into v_has_booking;

  select exists (select 1 from public.ticket_types where offering_id = o.id)
    into has_tickets;
  if jsonb_array_length(v_items) = 0 and has_tickets then
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

  -- An add-on on its own is fine when they already hold a ticket for this date; it takes no seat.
  if v_any and v_seats = 0 and not v_has_booking then
    raise exception 'Choose a main ticket first. Add-ons come with one.' using errcode = 'P0001';
  end if;
  if v_seats = 0 and not v_any then v_seats := 1; end if;

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


-- What a booking holds: every ticket and add-on with its quantity ---------------------------
create or replace function public.ticket_items_by_token(p_token text)
returns table (name text, kind text, qty int, unit_price numeric, currency text)
language sql
stable
security definer
set search_path = ''
as $$
  select t.name, t.kind, i.qty, i.unit_price, i.currency
  from public.registrations r
  join public.registration_items i on i.registration_id = r.id
  join public.ticket_types t on t.id = i.ticket_type_id
  where r.qr_token = p_token
  order by (t.kind = 'main') desc, t.position, t.name;
$$;
revoke execute on function public.ticket_items_by_token(text) from public;
grant execute on function public.ticket_items_by_token(text) to anon, authenticated;

-- The ticket page tells a cancelled booking apart from a cancelled session.
create or replace function public.ticket_by_token(p_token text)
returns table (
  registration_id uuid,
  offering_id uuid,
  title text,
  kind text,
  session_date date,
  start_time time,
  end_time time,
  location text,
  facilitator text,
  holder text,
  ticket_name text,
  price numeric,
  currency text,
  paid boolean,
  checked_in_at timestamptz,
  state text,
  can_check_in boolean,
  gate_opens time
)
language sql
stable
security definer
set search_path = ''
as $$
  select r.id, o.id, o.title, o.kind, r.session_date, o.start_time,
    o.end_time, o.location, f.name, r.name, t.name, t.price, t.currency,
    r.paid, r.checked_in_at,
    case
      when r.status = 'cancelled' then 'voided'
      when exists (
        select 1 from public.session_cancellations c
        where c.offering_id = o.id and c.session_date = r.session_date
      ) then 'cancelled'
      when r.status = 'held' and not public.registration_live(r) then 'lapsed'
      when r.status = 'held' then 'unpaid'
      when r.checked_in_at is not null then 'used'
      when r.session_date < public.org_today() then 'expired'
      when r.session_date > public.org_today() then 'upcoming'
      when o.start_time is not null
        and public.org_now() < r.session_date + o.start_time - interval '1 hour' then 'early'
      else 'valid'
    end,
    public.can_check_in(o.id),
    case when o.start_time is not null
      then (o.start_time - interval '1 hour')::time end
  from public.registrations r
  join public.offerings o on o.id = r.offering_id
  left join public.team_members f on f.id = o.facilitator_id
  left join public.ticket_types t on t.id = r.ticket_type_id
  where r.qr_token = p_token;
$$;

-- Guests change their own booking from the link in their confirmation email -----------------
-- The ticket's token is the key. A guest can cancel or move a booking until the session starts
-- and until they have checked in. Payments stay as they are; the team handles refunds.
create or replace function public.guest_booking_check(r public.registrations)
returns void
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  o public.offerings;
begin
  if r.status = 'cancelled' then
    raise exception 'This booking was cancelled.' using errcode = 'P0001';
  end if;
  if r.checked_in_at is not null then
    raise exception 'You''ve already checked in.' using errcode = 'P0001';
  end if;
  select * into o from public.offerings where id = r.offering_id;
  if r.session_date < public.org_today()
    or (r.session_date = public.org_today() and o.start_time is not null
        and r.session_date + o.start_time <= public.org_now()) then
    raise exception 'This has already started, so it can''t be changed.' using errcode = 'P0001';
  end if;
end;
$$;
revoke execute on function public.guest_booking_check(public.registrations) from public, anon, authenticated;

create or replace function public.guest_cancel_booking(p_token text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  r public.registrations;
begin
  select * into r from public.registrations where qr_token = p_token for update;
  if not found then
    raise exception 'That booking wasn''t found.' using errcode = 'P0001';
  end if;
  perform public.guest_booking_check(r);
  update public.registrations
  set status = 'cancelled', cancelled_at = now(), hold_until = null
  where id = r.id;
end;
$$;
revoke execute on function public.guest_cancel_booking(text) from public;
grant execute on function public.guest_cancel_booking(text) to anon, authenticated;

create or replace function public.guest_reschedule_booking(p_token text, p_session_date date)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  r public.registrations;
  o public.offerings;
  it record;
  taken int;
begin
  select * into r from public.registrations where qr_token = p_token for update;
  if not found then
    raise exception 'That booking wasn''t found.' using errcode = 'P0001';
  end if;
  perform public.guest_booking_check(r);
  if p_session_date is null then
    raise exception 'Pick a date.' using errcode = 'P0001';
  end if;
  if r.session_date = p_session_date then
    return;
  end if;
  select * into o from public.offerings where id = r.offering_id for update;
  if o.status <> 'published' then
    raise exception 'This isn''t available to book.' using errcode = 'P0001';
  end if;
  if p_session_date < public.org_today()
    or not public.occurs_on(o, p_session_date)
    or exists (
      select 1 from public.session_cancellations
      where offering_id = o.id and session_date = p_session_date
    ) then
    raise exception 'That date isn''t on the schedule.' using errcode = 'P0001';
  end if;
  if (o.booking_cutoff_minutes is not null and o.start_time is not null
      and (p_session_date + o.start_time) - make_interval(mins => o.booking_cutoff_minutes)
        <= public.org_now())
    or (o.booking_closes_at is not null and o.booking_closes_at <= public.org_now()) then
    raise exception 'Booking for that date has closed.' using errcode = 'P0001';
  end if;
  if o.capacity is not null and r.seats > 0 then
    select coalesce(sum(x.seats), 0) into taken from public.registrations x
    where x.offering_id = o.id and x.session_date = p_session_date
      and public.registration_live(x) and x.id <> r.id;
    if taken + r.seats > o.capacity then
      raise exception 'Only % spots left on that date.', greatest(0, o.capacity - taken)
        using errcode = 'P0001';
    end if;
  end if;
  for it in
    select t.id, t.name, t.qty as stock, i.qty
    from public.registration_items i
    join public.ticket_types t on t.id = i.ticket_type_id
    where i.registration_id = r.id and t.qty is not null
  loop
    if public.ticket_taken(it.id, p_session_date) + it.qty > it.stock then
      raise exception 'Only % left of % on that date.',
        greatest(0, it.stock - public.ticket_taken(it.id, p_session_date)), it.name
        using errcode = 'P0001';
    end if;
  end loop;
  update public.registrations set session_date = p_session_date where id = r.id;
end;
$$;
revoke execute on function public.guest_reschedule_booking(text, date) from public;
grant execute on function public.guest_reschedule_booking(text, date) to anon, authenticated;
