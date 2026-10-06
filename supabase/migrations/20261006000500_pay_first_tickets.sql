-- Meals are confirmed only once they're paid, and pay through Stripe products
-- instead of an outside link. User decision, 2026-10-06.

-- Ticket types ------------------------------------------------------------------------
-- pay_first: the booking is a hold until the payment is in (meals).
-- stripe_price_id: the Stripe price to charge, found from the product with the
-- ticket's name the first time someone pays, or picked in the ticket editor.
alter table public.ticket_types
  add column if not exists pay_first boolean not null default false,
  add column if not exists stripe_price_id text;
update public.ticket_types set pay_first = true where payment_link is not null;

-- Registrations -------------------------------------------------------------------------
-- A held booking keeps its spot until hold_until (or until paid, when there's
-- no online payment to wait for). Confirmed bookings are what they always were.
alter table public.registrations
  add column if not exists status text not null default 'confirmed'
    check (status in ('held', 'confirmed')),
  add column if not exists hold_until timestamptz;
create index if not exists registrations_held_idx on public.registrations (status) where status = 'held';

-- A booking that still counts: confirmed, or a hold that hasn't lapsed.
create or replace function public.registration_live(r public.registrations)
returns boolean
language sql
stable
set search_path = ''
as $$
  select r.status = 'confirmed' or r.hold_until is null or r.hold_until > now();
$$;

-- Paying confirms the hold, whoever records the payment (Stripe or staff).
create or replace function public.confirm_paid_registration()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.paid and not coalesce(old.paid, false) and new.status = 'held' then
    new.status := 'confirmed';
    new.hold_until := null;
  end if;
  return new;
end;
$$;
drop trigger if exists registrations_confirm_paid on public.registrations;
create trigger registrations_confirm_paid
  before update of paid on public.registrations
  for each row execute function public.confirm_paid_registration();

-- Booking ----------------------------------------------------------------------------------
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

-- Counts, rosters and attendees skip holds that lapsed -----------------------------------
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
  select r.session_date, r.ticket_type_id, count(*)
  from public.registrations r
  where r.offering_id = p_offering_id
    and r.session_date between p_from and p_to
    and public.registration_live(r)
    and public.can_view_offering(p_offering_id)
  group by r.session_date, r.ticket_type_id;
$$;

create or replace function public.session_roster(p_offering_id uuid, p_date date)
returns table (
  registration_id uuid, name text, photo_path text, tier text, is_member boolean,
  source text, paid boolean, qr_token text, checked_in_at timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
  select r.id, coalesce(c.name, r.name), c.photo_path, c.tier,
    coalesce(public.has_access_today(c.id), false),
    r.source, r.paid, r.qr_token, r.checked_in_at
  from public.registrations r
  left join public.contacts c on c.id = r.contact_id
  where r.offering_id = p_offering_id
    and r.session_date = p_date
    and public.registration_live(r)
    and (
      public.can_check_in(p_offering_id)
      or public.has_role('admin', 'lead', 'sales')
    )
  order by lower(coalesce(c.name, r.name));
$$;

create or replace function public.session_attendees(p_offering_id uuid, p_from date, p_to date)
returns table (
  session_date date,
  id uuid,
  name text,
  photo_path text,
  is_me boolean
)
language sql
stable
security definer
set search_path = ''
as $$
  select distinct on (r.session_date, c.id)
    r.session_date, c.id, c.name, c.photo_path,
    c.id = public.current_member_contact_id()
  from public.registrations r
  join public.contacts c on c.id = r.contact_id
  where (public.is_member() or public.is_staff())
    and r.offering_id = p_offering_id
    and r.session_date between p_from and p_to
    and r.status = 'confirmed'
    and c.tier is not null
    and c.membership_status = 'active'
    and (c.show_in_directory or c.id = public.current_member_contact_id())
  order by r.session_date, c.id;
$$;

-- The ticket knows when it's waiting for payment, or lapsed ----------------------------------
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

create or replace function public.check_in(p_token text)
returns timestamptz
language plpgsql
security definer
set search_path = ''
as $$
declare
  r public.registrations;
  o public.offerings;
  v_at timestamptz;
begin
  select * into r from public.registrations where qr_token = p_token for update;
  if not found then
    raise exception 'Ticket not found.' using errcode = 'P0001';
  end if;
  if not public.can_check_in(r.offering_id) then
    raise exception 'You can''t check people in.' using errcode = '42501';
  end if;
  if r.checked_in_at is not null then
    return r.checked_in_at;
  end if;
  if r.status = 'held' then
    raise exception 'Not paid yet. This booking is confirmed once it''s paid.' using errcode = 'P0001';
  end if;
  if r.session_date <> public.org_today() then
    raise exception 'This ticket is for %.', to_char(r.session_date, 'Mon DD')
      using errcode = 'P0001';
  end if;
  if exists (
    select 1 from public.session_cancellations
    where offering_id = r.offering_id and session_date = r.session_date
  ) then
    raise exception 'This session was cancelled.' using errcode = 'P0001';
  end if;
  select * into o from public.offerings where id = r.offering_id;
  if o.start_time is not null
    and public.org_now() < r.session_date + o.start_time - interval '1 hour' then
    raise exception 'Too early. Entry opens at %.',
      to_char(o.start_time - interval '1 hour', 'FMHH12:MI AM')
      using errcode = 'P0001';
  end if;
  update public.registrations
  set checked_in_at = now(), checked_in_by = public.current_staff_id()
  where id = r.id
  returning checked_in_at into v_at;
  return v_at;
end;
$$;
