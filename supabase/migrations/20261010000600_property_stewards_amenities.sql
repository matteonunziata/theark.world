-- Stewards <-> properties is many-to-many (a property can have several stewards,
-- a steward several properties). lots.owner_contact_id stays as the primary
-- steward and is kept in sync here. Also the club amenities registry.

create table public.property_stewards (
  lot_id uuid not null references public.lots (id) on delete cascade,
  contact_id uuid not null references public.contacts (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (lot_id, contact_id)
);
create index property_stewards_contact_idx on public.property_stewards (contact_id);

insert into public.property_stewards (lot_id, contact_id)
select id, owner_contact_id from public.lots where owner_contact_id is not null
on conflict do nothing;

create or replace function public.sync_primary_steward()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.owner_contact_id is not null then
    insert into public.property_stewards (lot_id, contact_id)
    values (new.id, new.owner_contact_id) on conflict do nothing;
  end if;
  return new;
end $$;
create trigger lots_sync_primary_steward
  after insert or update of owner_contact_id on public.lots
  for each row execute function public.sync_primary_steward();

alter table public.property_stewards enable row level security;
create policy "Estate staff" on public.property_stewards
  for all to authenticated
  using (public.is_estate_staff()) with check (public.is_estate_staff());

-- Any steward of a lot counts as its owner in My Property.
create or replace function public.owns_lot(p_lot uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.property_stewards
    where lot_id = p_lot and contact_id = public.current_member_contact_id()
  );
$$;

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
  where exists (
    select 1 from public.property_stewards ps
    where ps.lot_id = l.id and ps.contact_id = public.current_member_contact_id()
  )
  order by l.code;
$$;

-- Club amenities (facilities members and stewards use), for schedules and access.
create table public.amenities (
  id uuid primary key default gen_random_uuid(),
  name text not null unique check (length(trim(name)) > 0),
  category text not null default 'other'
    check (category in ('wellness', 'play', 'work', 'land', 'other')),
  active boolean not null default true,
  position int not null default 0,
  created_at timestamptz not null default now()
);
alter table public.amenities enable row level security;
create policy "Signed-in users read amenities" on public.amenities
  for select to authenticated using (true);
create policy "Admins and leads manage amenities" on public.amenities
  for all to authenticated
  using (public.has_role('admin', 'lead')) with check (public.has_role('admin', 'lead'));

insert into public.amenities (name, category, position) values
  ('Sauna', 'wellness', 1),
  ('Cold plunge', 'wellness', 2),
  ('Spa deck', 'wellness', 3),
  ('Jungle gym', 'play', 4),
  ('Cowork', 'work', 5),
  ('Farm', 'land', 6);
