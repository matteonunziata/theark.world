-- Booking cutoff and facilitator pay tier -------------------------------------------------
-- booking_cutoff_minutes: bookings close this many minutes before a session starts.
--   null = no cutoff (people can book until the day is over, as before).
-- facilitator_pay_tier: how the facilitator is paid for this class.
--   1 = free (no pay), 2 = fixed rate, 3 = flex (by people checked in). Amounts live in
--   src/lib/facilitator-pay.ts.
alter table public.offerings
  add column if not exists booking_cutoff_minutes integer
    check (booking_cutoff_minutes is null or booking_cutoff_minutes >= 0),
  add column if not exists facilitator_pay_tier smallint not null default 1
    check (facilitator_pay_tier in (1, 2, 3));

-- book_session: the same checks as before, plus the cutoff ----------------------------------
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
declare
  o public.offerings;
  t public.ticket_types;
  member_id uuid := public.current_member_contact_id();
  v_email text := lower(trim(coalesce(p_email, '')));
  v_name text := trim(coalesce(p_name, ''));
  taken int;
  has_tickets boolean;
  v_status text := 'confirmed';
  v_hold timestamptz;
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

  if p_session_date < public.org_today()
    or not public.occurs_on(o, p_session_date)
    or exists (
      select 1 from public.session_cancellations
      where offering_id = o.id and session_date = p_session_date
    ) then
    raise exception 'That date isn''t on the schedule.' using errcode = 'P0001';
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

  select count(*) into taken from public.registrations r
  where r.offering_id = o.id and r.session_date = p_session_date
    and public.registration_live(r);
  if o.capacity is not null and taken >= o.capacity then
    raise exception 'Sorry, this session just filled up.' using errcode = 'P0001';
  end if;

  select exists (select 1 from public.ticket_types where offering_id = o.id)
    into has_tickets;

  if p_ticket_type_id is not null then
    select * into t from public.ticket_types
    where id = p_ticket_type_id and offering_id = o.id;
    if not found then
      raise exception 'Choose a ticket.' using errcode = 'P0001';
    end if;
    if t.qty is not null and (
      select count(*) from public.registrations r
      where r.ticket_type_id = t.id and r.session_date = p_session_date
        and public.registration_live(r)
    ) >= t.qty then
      raise exception 'That ticket just sold out.' using errcode = 'P0001';
    end if;
    if t.pay_first then
      v_status := 'held';
      -- Online payment has half an hour; an outside link or the desk waits for staff to mark it paid.
      v_hold := case when t.price > 0 or t.stripe_price_id is not null
        then now() + interval '30 minutes' end;
    end if;
  elsif has_tickets and member_id is null then
    raise exception 'Choose a ticket.' using errcode = 'P0001';
  end if;

  return query
  insert into public.registrations as r (
    offering_id, session_date, ticket_type_id, contact_id, user_id,
    name, email, source, status, hold_until
  ) values (
    o.id, p_session_date, p_ticket_type_id, member_id,
    case when member_id is not null then auth.uid() end,
    v_name, v_email,
    case when member_id is not null then 'portal' else 'public' end,
    v_status, v_hold
  )
  returning r.id, r.qr_token;
end;
$$;
