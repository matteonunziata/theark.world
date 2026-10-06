-- Guesty: the property management system The ARK's rental homes are booked
-- through (Airbnb, Booking.com and the Guesty booking site all land there).
-- Reservations come into ARK OS as stays, so Hospitality and /stay see the
-- same calendar Guesty does; stays booked in ARK OS can go out as blocked
-- nights on the Guesty calendar. Settings → Integrations → Guesty.

-- The integrations table grows a second row. Guesty connects with an Open API
-- client (id + secret) and hands out a 24-hour token, at most five a day, so
-- the token is kept here between runs.
alter table public.integrations drop constraint integrations_key_check;
alter table public.integrations add constraint integrations_key_check
  check (key in ('ghl', 'guesty'));
alter table public.integrations
  add column client_id text,
  add column access_token text,
  add column token_expires_at timestamptz,
  -- The v2 webhook ARK OS registered in Guesty, and its signing secret.
  add column webhook_id text,
  add column webhook_signing_secret text,
  -- Copy rate, sleeps, minimum nights and check-in times from Guesty onto
  -- linked homes at each sync.
  add column sync_details boolean not null default true;
insert into public.integrations (key, direction) values ('guesty', 'pull')
on conflict (key) do nothing;

-- Guesty's listings, as last seen. Used to link each one to a home here.
create table public.guesty_listings (
  id text primary key,
  title text not null,
  nickname text,
  active boolean not null default true,
  listed boolean not null default true,
  accommodates smallint,
  bedrooms smallint,
  bathrooms numeric(3, 1),
  beds smallint,
  base_price numeric(14, 2),
  currency text,
  cleaning_fee numeric(14, 2),
  min_nights smallint,
  check_in_time text,
  check_out_time text,
  cover_url text,
  seen_at timestamptz not null default now()
);
alter table public.guesty_listings enable row level security;
create policy "Admins manage Guesty listings" on public.guesty_listings
  for all to authenticated
  using (public.has_role('admin')) with check (public.has_role('admin'));
create policy "Estate staff read Guesty listings" on public.guesty_listings
  for select to authenticated using (public.is_estate_staff());

-- Which Guesty listing a home is. Filled from the import notes for the
-- eleven homes that came from the Guesty booking site.
alter table public.lots add column guesty_listing_id text unique;
update public.lots
set guesty_listing_id = substring(listing_notes from 'guestybookings\.com/en/properties/([0-9a-f]{24})')
where kind = 'rental' and listing_notes ~ 'guestybookings\.com/en/properties/[0-9a-f]{24}';

-- Stays that came from Guesty keep the reservation id (so a change in Guesty
-- updates the same stay), the confirmation code and the channel it was booked
-- on. Stays booked here remember when they were last sent to the Guesty
-- calendar as blocked nights.
alter table public.stays drop constraint stays_source_check;
alter table public.stays add constraint stays_source_check
  check (source in ('direct', 'website', 'airbnb', 'booking', 'owner', 'other', 'guesty'));
alter table public.stays
  add column external_id text,
  add column external_ref text,
  add column channel text,
  add column guesty_pushed_at timestamptz;
create unique index stays_guesty_reservation_idx
  on public.stays (external_id) where (source = 'guesty');
