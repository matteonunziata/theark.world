-- Real estate: lots, the home on each, the household living there, and
-- maintenance. Hospitality: owners in the active stewardship programme list
-- their home, and the team manages guest stays and availability.

create extension if not exists btree_gist with schema extensions;

create or replace function public.is_estate_staff()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.has_role('admin', 'lead', 'sales');
$$;
grant execute on function public.is_estate_staff() to authenticated;

create table public.lots (
  id uuid primary key default gen_random_uuid(),
  code text not null unique check (length(trim(code)) > 0),   -- "A-12"
  name text,                                                  -- "Casa Higuerón"
  zone text,
  status text not null default 'available'
    check (status in ('available', 'reserved', 'sold', 'not_for_sale')),
  size_m2 numeric(12, 2) check (size_m2 > 0),
  price numeric(14, 2) check (price >= 0),
  currency text not null default 'USD' check (currency in ('CRC', 'USD')),
  owner_contact_id uuid references public.contacts (id) on delete set null,
  photo_path text,            -- estate bucket: the lot or the home
  aerial_path text,           -- estate bucket: drone / site plan
  description text,
  -- The home
  home_status text not null default 'none'
    check (home_status in ('none', 'planned', 'building', 'built')),
  home_name text,
  bedrooms smallint check (bedrooms >= 0),
  bathrooms numeric(3, 1) check (bathrooms >= 0),
  built_m2 numeric(10, 2) check (built_m2 > 0),
  home_notes text,
  -- Hospitality / active stewardship
  in_hospitality boolean not null default false,
  hospitality_since date,
  nightly_rate numeric(14, 2) check (nightly_rate >= 0),
  rate_currency text not null default 'USD' check (rate_currency in ('CRC', 'USD')),
  max_guests smallint check (max_guests > 0),
  min_nights smallint not null default 1 check (min_nights > 0),
  listing_notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index lots_owner_idx on public.lots (owner_contact_id);
create trigger lots_updated_at before update on public.lots
  for each row execute function public.set_updated_at();

create table public.lot_household (
  id uuid primary key default gen_random_uuid(),
  lot_id uuid not null references public.lots (id) on delete cascade,
  name text not null check (length(trim(name)) > 0),
  relation text not null default 'family'
    check (relation in ('owner', 'partner', 'child', 'family', 'resident', 'staff', 'other')),
  contact_id uuid references public.contacts (id) on delete set null,
  birth_year smallint check (birth_year between 1900 and 2100),
  email extensions.citext,
  phone text,
  lives_on_site boolean not null default true,
  notes text,
  created_at timestamptz not null default now()
);
create index lot_household_lot_idx on public.lot_household (lot_id);

create table public.lot_maintenance (
  id uuid primary key default gen_random_uuid(),
  lot_id uuid not null references public.lots (id) on delete cascade,
  title text not null check (length(trim(title)) > 0),
  details text,
  category text not null default 'repair'
    check (category in ('repair', 'garden', 'pool', 'cleaning', 'inspection', 'build', 'other')),
  status text not null default 'done' check (status in ('open', 'scheduled', 'done')),
  performed_on date not null default current_date,
  cost numeric(14, 2) check (cost >= 0),
  currency text not null default 'USD' check (currency in ('CRC', 'USD')),
  done_by text,
  created_by uuid references public.team_members (id) on delete set null,
  created_at timestamptz not null default now()
);
create index lot_maintenance_lot_idx on public.lot_maintenance (lot_id, performed_on desc);

create table public.stays (
  id uuid primary key default gen_random_uuid(),
  lot_id uuid not null references public.lots (id) on delete cascade,
  kind text not null default 'guest' check (kind in ('guest', 'owner', 'hold')),
  status text not null default 'confirmed'
    check (status in ('inquiry', 'confirmed', 'cancelled')),
  guest_name text not null check (length(trim(guest_name)) > 0),
  email extensions.citext,
  phone text,
  guests smallint check (guests > 0),
  check_in date not null,
  check_out date not null,
  nightly_rate numeric(14, 2) check (nightly_rate >= 0),
  currency text not null default 'USD' check (currency in ('CRC', 'USD')),
  total numeric(14, 2) check (total >= 0),
  paid boolean not null default false,
  source text not null default 'direct'
    check (source in ('direct', 'airbnb', 'booking', 'owner', 'other')),
  contact_id uuid references public.contacts (id) on delete set null,
  notes text,
  created_by uuid references public.team_members (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (check_out > check_in),
  -- Two confirmed stays (or owner blocks) can't overlap in the same home.
  -- Checkout day is free for the next check-in.
  constraint stays_no_overlap exclude using gist (
    lot_id with =,
    daterange(check_in, check_out, '[)') with &&
  ) where (status = 'confirmed')
);
create index stays_dates_idx on public.stays (check_in, check_out);
create trigger stays_updated_at before update on public.stays
  for each row execute function public.set_updated_at();

alter table public.lots enable row level security;
alter table public.lot_household enable row level security;
alter table public.lot_maintenance enable row level security;
alter table public.stays enable row level security;

create policy "Estate staff" on public.lots
  for all to authenticated
  using (public.is_estate_staff()) with check (public.is_estate_staff());
create policy "Estate staff" on public.lot_household
  for all to authenticated
  using (public.is_estate_staff()) with check (public.is_estate_staff());
create policy "Estate staff" on public.lot_maintenance
  for all to authenticated
  using (public.is_estate_staff()) with check (public.is_estate_staff());
create policy "Estate staff" on public.stays
  for all to authenticated
  using (public.is_estate_staff()) with check (public.is_estate_staff());

-- Photos: public bucket, random file names, no listing.
insert into storage.buckets (id, name, public)
values ('estate', 'estate', true)
on conflict (id) do nothing;

create policy "Estate staff upload photos" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'estate' and public.is_estate_staff());
create policy "Estate staff replace photos" on storage.objects
  for update to authenticated
  using (bucket_id = 'estate' and public.is_estate_staff());
create policy "Estate staff delete photos" on storage.objects
  for delete to authenticated
  using (bucket_id = 'estate' and public.is_estate_staff());
