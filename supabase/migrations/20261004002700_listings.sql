-- Hospitality listings: what guests see for each home in the programme
-- (title, description, photos, amenities, house rules, check-in times),
-- a public search by dates and guests, and booking requests from the public
-- that land as inquiries for the team to confirm.

alter table public.lots
  add column listing_title text,
  add column listing_summary text,
  add column amenities text[] not null default '{}',
  add column house_rules text,
  add column beds smallint check (beds >= 0),
  add column check_in_time time not null default '15:00',
  add column check_out_time time not null default '11:00',
  add column cleaning_fee numeric(14, 2) check (cleaning_fee >= 0),
  add column listing_published boolean not null default false;

create table public.listing_photos (
  id uuid primary key default gen_random_uuid(),
  lot_id uuid not null references public.lots (id) on delete cascade,
  path text not null,
  caption text,
  position int not null default 0,
  created_at timestamptz not null default now()
);
create index listing_photos_lot_idx on public.listing_photos (lot_id, position);
alter table public.listing_photos enable row level security;
create policy "Estate staff" on public.listing_photos
  for all to authenticated
  using (public.is_estate_staff()) with check (public.is_estate_staff());

alter table public.stays drop constraint stays_source_check;
alter table public.stays add constraint stays_source_check
  check (source in ('direct', 'website', 'airbnb', 'booking', 'owner', 'other'));

-- Is a home free for every night in [check_in, check_out)?
create or replace function public.lot_is_free(p_lot_id uuid, p_check_in date, p_check_out date)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select not exists (
    select 1 from public.stays s
    where s.lot_id = p_lot_id and s.status = 'confirmed'
      and daterange(s.check_in, s.check_out, '[)') && daterange(p_check_in, p_check_out, '[)')
  );
$$;
revoke execute on function public.lot_is_free(uuid, date, date) from anon, public;

-- Published homes, optionally filtered by dates and party size.
-- Never exposes owners, guests or private notes.
create or replace function public.public_listings(
  p_check_in date default null,
  p_check_out date default null,
  p_guests int default null
)
returns table (
  id uuid,
  title text,
  summary text,
  zone text,
  bedrooms smallint,
  beds smallint,
  bathrooms numeric,
  max_guests smallint,
  min_nights smallint,
  nightly_rate numeric,
  rate_currency text,
  cleaning_fee numeric,
  amenities text[],
  cover_path text,
  available boolean
)
language sql
stable
security definer
set search_path = ''
as $$
  select l.id, coalesce(l.listing_title, l.home_name, l.name, 'Lot ' || l.code),
    l.listing_summary, l.zone, l.bedrooms, l.beds, l.bathrooms, l.max_guests,
    l.min_nights, l.nightly_rate, l.rate_currency, l.cleaning_fee, l.amenities,
    coalesce((select p.path from public.listing_photos p where p.lot_id = l.id
      order by p.position, p.created_at limit 1), l.photo_path),
    case when p_check_in is null or p_check_out is null or p_check_out <= p_check_in then true
      else public.lot_is_free(l.id, p_check_in, p_check_out)
        and (p_check_out - p_check_in) >= l.min_nights
    end
  from public.lots l
  where l.in_hospitality and l.listing_published
    and (p_guests is null or l.max_guests is null or l.max_guests >= p_guests)
  order by l.nightly_rate nulls last, l.code;
$$;
grant execute on function public.public_listings(date, date, int) to anon, authenticated;

-- One published home: details, photos, and the nights already taken
-- (dates only) for the next year.
create or replace function public.public_listing(p_id uuid)
returns json
language sql
stable
security definer
set search_path = ''
as $$
  select json_build_object(
    'id', l.id,
    'title', coalesce(l.listing_title, l.home_name, l.name, 'Lot ' || l.code),
    'summary', l.listing_summary,
    'zone', l.zone,
    'bedrooms', l.bedrooms, 'beds', l.beds, 'bathrooms', l.bathrooms,
    'max_guests', l.max_guests, 'min_nights', l.min_nights,
    'nightly_rate', l.nightly_rate, 'rate_currency', l.rate_currency,
    'cleaning_fee', l.cleaning_fee,
    'amenities', l.amenities, 'house_rules', l.house_rules,
    'check_in_time', l.check_in_time, 'check_out_time', l.check_out_time,
    'built_m2', l.built_m2,
    'photos', coalesce((select json_agg(json_build_object('path', p.path, 'caption', p.caption)
        order by p.position, p.created_at)
      from public.listing_photos p where p.lot_id = l.id), '[]'::json),
    'fallback_photo', l.photo_path,
    'taken', coalesce((select json_agg(json_build_array(s.check_in, s.check_out) order by s.check_in)
      from public.stays s
      where s.lot_id = l.id and s.status = 'confirmed'
        and s.check_out >= public.org_today() and s.check_in <= public.org_today() + 365), '[]'::json),
    'today', public.org_today()
  )
  from public.lots l
  where l.id = p_id and l.in_hospitality and l.listing_published;
$$;
grant execute on function public.public_listing(uuid) to anon, authenticated;

-- A booking request from the public site. It lands as an inquiry; the team
-- confirms it (which is when the dates are actually held).
create or replace function public.request_stay(
  p_lot_id uuid,
  p_check_in date,
  p_check_out date,
  p_guests int,
  p_name text,
  p_email text,
  p_phone text,
  p_message text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  l public.lots;
  v_id uuid;
  v_email text := lower(trim(coalesce(p_email, '')));
  v_nights int := p_check_out - p_check_in;
begin
  select * into l from public.lots
  where id = p_lot_id and in_hospitality and listing_published;
  if not found then
    raise exception 'This home isn''t taking bookings.' using errcode = 'P0001';
  end if;
  if length(trim(coalesce(p_name, ''))) = 0 or v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then
    raise exception 'Enter your name and a valid email.' using errcode = 'P0001';
  end if;
  if p_check_in is null or p_check_out is null or p_check_in < public.org_today() or v_nights < 1 then
    raise exception 'Choose check-in and check-out dates.' using errcode = 'P0001';
  end if;
  if p_check_in > public.org_today() + 365 then
    raise exception 'We take bookings up to a year ahead.' using errcode = 'P0001';
  end if;
  if v_nights < l.min_nights then
    raise exception 'This home has a %-night minimum.', l.min_nights using errcode = 'P0001';
  end if;
  if l.max_guests is not null and coalesce(p_guests, 1) > l.max_guests then
    raise exception 'This home sleeps %.', l.max_guests using errcode = 'P0001';
  end if;
  if not public.lot_is_free(l.id, p_check_in, p_check_out) then
    raise exception 'Those dates are taken. Try other dates.' using errcode = 'P0001';
  end if;
  -- A light guard against repeat submissions.
  if (select count(*) from public.stays
      where email = v_email::extensions.citext and source = 'website'
        and created_at > now() - interval '1 hour') >= 5 then
    raise exception 'We''ve got your requests. We''ll be in touch soon.' using errcode = 'P0001';
  end if;

  insert into public.stays (lot_id, kind, status, guest_name, email, phone, guests,
    check_in, check_out, nightly_rate, currency, total, source, notes)
  values (l.id, 'guest', 'inquiry', trim(p_name), v_email, nullif(trim(coalesce(p_phone, '')), ''),
    greatest(1, coalesce(p_guests, 1)), p_check_in, p_check_out, l.nightly_rate, l.rate_currency,
    case when l.nightly_rate is not null
      then l.nightly_rate * v_nights + coalesce(l.cleaning_fee, 0) end,
    'website', nullif(trim(coalesce(p_message, '')), ''))
  returning id into v_id;
  return v_id;
end;
$$;
grant execute on function public.request_stay(uuid, date, date, int, text, text, text, text) to anon, authenticated;
