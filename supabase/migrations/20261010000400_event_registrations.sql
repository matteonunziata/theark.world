-- Event registrations: cancel, add by hand, edit, live updates ------------------------------
-- A cancelled booking keeps its record (and any payment) but frees its seats and tickets,
-- no longer counts anywhere, and can't be checked in. Staff can restore it.

do $$
declare c text;
begin
  for c in
    select conname from pg_constraint
    where conrelid = 'public.registrations'::regclass and contype = 'c'
      and pg_get_constraintdef(oid) ilike '%held%' and pg_get_constraintdef(oid) ilike '%confirmed%'
  loop
    execute format('alter table public.registrations drop constraint %I', c);
  end loop;
end $$;
alter table public.registrations
  add constraint registrations_status_check check (status in ('held', 'confirmed', 'cancelled')),
  add column if not exists cancelled_at timestamptz;

-- Counts, rosters and capacity skip cancelled bookings and holds that lapsed.
create or replace function public.registration_live(r public.registrations)
returns boolean
language sql
stable
set search_path = ''
as $$
  select r.status = 'confirmed'
    or (r.status = 'held' and (r.hold_until is null or r.hold_until > now()));
$$;

-- A cancelled ticket can't be checked in.
create or replace function public.check_in(p_token text)
returns timestamp with time zone
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
  if r.status = 'cancelled' then
    raise exception 'This booking was cancelled.' using errcode = 'P0001';
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

-- Add or change a booking by hand ------------------------------------------------------------
-- p_registration_id null adds a new one. p_items: [{"ticket_type_id": "...", "qty": 2}].
-- Staff can go past sales windows; capacity and stock still hold unless p_override is set.
create or replace function public.staff_save_registration(
  p_offering_id uuid,
  p_registration_id uuid,
  p_session_date date,
  p_name text,
  p_email text,
  p_phone text,
  p_items jsonb,
  p_paid boolean,
  p_override boolean default false
)
returns table (registration_id uuid, qr_token text)
language plpgsql
security definer
set search_path = ''
as $$
declare
  o public.offerings;
  old public.registrations;
  t public.ticket_types;
  it record;
  v_name text := trim(coalesce(p_name, ''));
  v_email text := nullif(lower(trim(coalesce(p_email, ''))), '');
  v_phone text := nullif(trim(coalesce(p_phone, '')), '');
  v_items jsonb := coalesce(p_items, '[]'::jsonb);
  v_seats int := 0;
  v_main uuid;
  v_any boolean := false;
  v_own int;
  taken int;
  v_contact uuid;
  v_reg uuid;
  v_token text;
  v_kept jsonb := '[]'::jsonb;
begin
  if not public.can_manage_offering(p_offering_id) then
    raise exception 'You can''t change bookings for this.' using errcode = '42501';
  end if;
  select * into o from public.offerings where id = p_offering_id for update;
  if not found then
    raise exception 'That event no longer exists.' using errcode = 'P0001';
  end if;
  if p_registration_id is not null then
    select * into old from public.registrations
    where id = p_registration_id and offering_id = p_offering_id for update;
    if not found then
      raise exception 'That booking no longer exists.' using errcode = 'P0001';
    end if;
  end if;
  if v_name = '' then
    raise exception 'Enter a name.' using errcode = 'P0001';
  end if;
  if v_email is not null and v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then
    raise exception 'Enter a valid email.' using errcode = 'P0001';
  end if;
  if p_session_date is null then
    raise exception 'Pick a date.' using errcode = 'P0001';
  end if;
  if jsonb_typeof(v_items) <> 'array' then
    raise exception 'Choose a ticket.' using errcode = 'P0001';
  end if;

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
    if t.qty is not null and not p_override then
      -- Tickets this same booking already holds for that date don't count against it.
      select coalesce(sum(i.qty), 0) into v_own
      from public.registration_items i
      join public.registrations r on r.id = i.registration_id
      where i.registration_id = p_registration_id and i.ticket_type_id = t.id
        and r.session_date = p_session_date and public.registration_live(r);
      if public.ticket_taken(t.id, p_session_date) - v_own + it.qty > t.qty then
        raise exception 'Only % left of %.',
          greatest(0, t.qty - (public.ticket_taken(t.id, p_session_date) - v_own)), t.name
          using errcode = 'P0001';
      end if;
    end if;
    if t.kind = 'main' then
      v_seats := v_seats + it.qty;
      v_main := coalesce(v_main, t.id);
    end if;
  end loop;
  if v_any and v_seats = 0 then
    raise exception 'Choose a main ticket first. Add-ons come with one.' using errcode = 'P0001';
  end if;
  if v_seats = 0 then v_seats := 1; end if;

  if o.capacity is not null and not p_override
    and (old.id is null or old.status <> 'cancelled') then
    select coalesce(sum(r.seats), 0) into taken from public.registrations r
    where r.offering_id = o.id and r.session_date = p_session_date
      and public.registration_live(r)
      and r.id is distinct from p_registration_id;
    if taken + v_seats > o.capacity then
      raise exception 'Only % spots left.', greatest(0, o.capacity - taken) using errcode = 'P0001';
    end if;
  end if;

  if v_email is not null then
    select c.id into v_contact from public.contacts c where c.email = v_email::extensions.citext limit 1;
  end if;

  perform set_config('ark.items_managed', 'on', true);
  if p_registration_id is null then
    insert into public.registrations as r (
      offering_id, session_date, ticket_type_id, contact_id, name, email, phone,
      seats, paid, source, status
    ) values (
      o.id, p_session_date, v_main, v_contact, v_name, v_email, v_phone,
      v_seats, coalesce(p_paid, false), 'staff', 'confirmed'
    )
    returning r.id, r.qr_token into v_reg, v_token;
  else
    update public.registrations as r
    set session_date = p_session_date, ticket_type_id = v_main,
        contact_id = coalesce(v_contact, r.contact_id),
        name = v_name, email = v_email, phone = v_phone,
        seats = v_seats, paid = coalesce(p_paid, r.paid)
    where r.id = p_registration_id
    returning r.id, r.qr_token into v_reg, v_token;
    -- Keep each kept ticket's original price; new tickets get today's.
    select coalesce(jsonb_agg(jsonb_build_object('t', i.ticket_type_id, 'p', i.unit_price, 'c', i.currency)), '[]'::jsonb)
    into v_kept from public.registration_items i where i.registration_id = v_reg;
    delete from public.registration_items ri where ri.registration_id = v_reg;
  end if;
  perform set_config('ark.items_managed', 'off', true);

  insert into public.registration_items (registration_id, ticket_type_id, qty, unit_price, currency)
  select v_reg, b.ticket_type_id, b.qty,
    coalesce((select (k ->> 'p')::numeric from jsonb_array_elements(v_kept) k where (k ->> 't')::uuid = b.ticket_type_id), tt.price),
    coalesce((select k ->> 'c' from jsonb_array_elements(v_kept) k where (k ->> 't')::uuid = b.ticket_type_id), tt.currency)
  from (
    select (e ->> 'ticket_type_id')::uuid as ticket_type_id, sum((e ->> 'qty')::int)::int as qty
    from jsonb_array_elements(v_items) e
    where coalesce((e ->> 'qty')::int, 0) > 0
    group by 1
  ) b
  join public.ticket_types tt on tt.id = b.ticket_type_id;

  return query select v_reg, v_token;
exception when unique_violation then
  raise exception 'That person is already booked for this date.' using errcode = 'P0001';
end;
$$;
revoke execute on function public.staff_save_registration(uuid, uuid, date, text, text, text, jsonb, boolean, boolean) from public, anon;
grant execute on function public.staff_save_registration(uuid, uuid, date, text, text, text, jsonb, boolean, boolean) to authenticated;

-- Cancel a booking (frees its seats and tickets), or bring it back ---------------------------
create or replace function public.staff_set_registration_cancelled(p_registration_id uuid, p_cancelled boolean)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  r public.registrations;
  o public.offerings;
  taken int;
begin
  select * into r from public.registrations where id = p_registration_id for update;
  if not found then
    raise exception 'That booking no longer exists.' using errcode = 'P0001';
  end if;
  if not public.can_manage_offering(r.offering_id) then
    raise exception 'You can''t change bookings for this.' using errcode = '42501';
  end if;
  if p_cancelled then
    update public.registrations set status = 'cancelled', cancelled_at = now(), hold_until = null
    where id = r.id;
  else
    if r.status <> 'cancelled' then return; end if;
    select * into o from public.offerings where id = r.offering_id for update;
    select coalesce(sum(x.seats), 0) into taken from public.registrations x
    where x.offering_id = r.offering_id and x.session_date = r.session_date and public.registration_live(x);
    if o.capacity is not null and taken + r.seats > o.capacity then
      raise exception 'There aren''t enough spots left to restore this booking.' using errcode = 'P0001';
    end if;
    update public.registrations set status = 'confirmed', cancelled_at = null where id = r.id;
  end if;
end;
$$;
revoke execute on function public.staff_set_registration_cancelled(uuid, boolean) from public, anon;
grant execute on function public.staff_set_registration_cancelled(uuid, boolean) to authenticated;

-- Live updates for the registrations screen: staff screens listen for changes.
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'registrations') then
      alter publication supabase_realtime add table public.registrations;
    end if;
    if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'registration_items') then
      alter publication supabase_realtime add table public.registration_items;
    end if;
  end if;
end $$;
