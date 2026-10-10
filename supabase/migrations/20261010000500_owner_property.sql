-- "My Property": active members who own a lot manage it from the portal.
-- Access is by ownership (lots.owner_contact_id = the signed-in member's contact).
-- Owners get no direct write access to lots or stays; they use the functions below,
-- which expose only what an owner should see (no guest contact details or totals).

create or replace function public.owns_lot(p_lot uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.lots
    where id = p_lot and owner_contact_id = public.current_member_contact_id()
  );
$$;
revoke execute on function public.owns_lot(uuid) from anon, public;
grant execute on function public.owns_lot(uuid) to authenticated;

-- Household and maintenance log: owners read and manage their own household,
-- and read the maintenance log.
create policy "Owners manage their household" on public.lot_household
  for all to authenticated
  using (public.owns_lot(lot_id)) with check (public.owns_lot(lot_id));
create policy "Owners read their maintenance log" on public.lot_maintenance
  for select to authenticated
  using (public.owns_lot(lot_id));

-- The owner's lots, with the fields an owner sees.
create or replace function public.my_properties()
returns table (
  id uuid, code text, name text, zone text, kind text, status text, features text,
  size_m2 numeric, description text, photo_path text, aerial_path text,
  home_status text, home_name text, bedrooms smallint, bathrooms numeric, built_m2 numeric,
  home_notes text, estate_lot_id uuid, in_hospitality boolean, hospitality_since date,
  nightly_rate numeric, rate_currency text, max_guests smallint, min_nights smallint,
  listing_notes text, listing_published boolean, check_in_time time, check_out_time time
)
language sql
stable
security definer
set search_path = ''
as $$
  select l.id, l.code, l.name, l.zone, l.kind, l.status, l.features,
    l.size_m2, l.description, l.photo_path, l.aerial_path,
    l.home_status, l.home_name, l.bedrooms, l.bathrooms, l.built_m2,
    l.home_notes, l.estate_lot_id, l.in_hospitality, l.hospitality_since,
    l.nightly_rate, l.rate_currency, l.max_guests, l.min_nights,
    l.listing_notes, l.listing_published, l.check_in_time, l.check_out_time
  from public.lots l
  where l.owner_contact_id = public.current_member_contact_id()
  order by l.code;
$$;
revoke execute on function public.my_properties() from anon, public;
grant execute on function public.my_properties() to authenticated;

-- Upcoming stays at an owned home: dates and first name only.
create or replace function public.my_property_stays(p_lot uuid)
returns table (
  id uuid, kind text, status text, label text, guests smallint,
  check_in date, check_out date
)
language sql
stable
security definer
set search_path = ''
as $$
  select s.id, s.kind, s.status,
    case s.kind when 'guest' then split_part(s.guest_name, ' ', 1)
                when 'owner' then 'You' else 'Blocked' end,
    s.guests, s.check_in, s.check_out
  from public.stays s
  where s.lot_id = p_lot and public.owns_lot(p_lot)
    and s.status <> 'cancelled' and s.check_out >= public.org_today()
  order by s.check_in;
$$;
revoke execute on function public.my_property_stays(uuid) from anon, public;
grant execute on function public.my_property_stays(uuid) to authenticated;

-- Block nights [from, to) for the owner's own use.
create or replace function public.owner_block_dates(p_lot uuid, p_from date, p_to date, p_note text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.owns_lot(p_lot) then raise exception 'Not your property.'; end if;
  if p_to <= p_from then raise exception 'Check-out has to be after check-in.'; end if;
  if p_from < public.org_today() then raise exception 'Choose dates from today.'; end if;
  insert into public.stays (lot_id, kind, status, guest_name, check_in, check_out, source, notes)
  values (p_lot, 'owner', 'confirmed', 'Owner', p_from, p_to, 'owner', nullif(trim(p_note), ''));
end $$;
revoke execute on function public.owner_block_dates(uuid, date, date, text) from anon, public;
grant execute on function public.owner_block_dates(uuid, date, date, text) to authenticated;

create or replace function public.owner_cancel_block(p_stay uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  delete from public.stays s
  where s.id = p_stay and s.kind = 'owner' and public.owns_lot(s.lot_id);
end $$;
revoke execute on function public.owner_cancel_block(uuid) from anon, public;
grant execute on function public.owner_cancel_block(uuid) to authenticated;

-- Notes for the hospitality team (house rules, check-in, what stays private).
create or replace function public.owner_set_listing_notes(p_lot uuid, p_notes text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.owns_lot(p_lot) then raise exception 'Not your property.'; end if;
  update public.lots set listing_notes = nullif(trim(p_notes), '') where id = p_lot;
end $$;
revoke execute on function public.owner_set_listing_notes(uuid, text) from anon, public;
grant execute on function public.owner_set_listing_notes(uuid, text) to authenticated;

-- Ask the team for work. Lands in the maintenance log as open.
create or replace function public.owner_request_work(
  p_lot uuid, p_title text, p_category text, p_details text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.owns_lot(p_lot) then raise exception 'Not your property.'; end if;
  if length(trim(coalesce(p_title, ''))) = 0 then raise exception 'Say what you need.'; end if;
  insert into public.lot_maintenance (lot_id, title, category, status, details)
  values (
    p_lot, trim(p_title),
    case when p_category in ('repair', 'garden', 'pool', 'cleaning', 'inspection', 'other')
         then p_category else 'repair' end,
    'open',
    trim('Requested by the owner in the portal. ' || coalesce(p_details, ''))
  );
end $$;
revoke execute on function public.owner_request_work(uuid, text, text, text) from anon, public;
grant execute on function public.owner_request_work(uuid, text, text, text) to authenticated;
