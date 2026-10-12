-- Breakfast and lunch can be booked by anyone, not only members.
-- An offering is open to the public when its access is "everyone" and it is
-- either an event or a class whose tickets are paid first (the meals). A guest
-- books, then pays on Stripe; the spot is held until the payment lands.
-- Classes were members-only by constraint. Breakfast and lunch are classes that
-- guests may book, so the rule moves into is_open_to_public (below), which also
-- requires a pay-first ticket.
alter table public.offerings drop constraint offerings_class_members_only;

create or replace function public.is_open_to_public(oid uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.offerings o
    where o.id = oid and o.status = 'published' and o.access = 'everyone'
      and (
        o.kind <> 'class'
        or exists (
          select 1 from public.ticket_types t
          where t.offering_id = o.id and t.pay_first
        )
      )
  );
$$;
revoke execute on function public.is_open_to_public(uuid) from public;
grant execute on function public.is_open_to_public(uuid) to anon, authenticated;

create or replace function public.can_view_offering(oid uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.is_staff() or public.is_member() and exists (
    select 1 from public.offerings o where o.id = oid and o.status = 'published'
  ) or public.is_open_to_public(oid);
$$;

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

-- The two meals: open to everyone, with clean links (/e/breakfast, /e/lunch).
update public.offerings set access = 'everyone', slug = 'breakfast'
where kind = 'class' and title = 'Breakfast' and slug is null;
update public.offerings set access = 'everyone', slug = 'lunch'
where kind = 'class' and title = 'Lunch' and slug is null;
