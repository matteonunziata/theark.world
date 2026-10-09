-- Event setup: short description, public link, booking cut-off, schedule, gallery ----------
-- offerings.description stays as the long description; short_description is the card line.
-- slug: the clean public link (/e/<slug>). Lowercase letters, numbers and dashes.
-- booking_closes_at: venue-local date and time when online booking stops. null = no cut-off.
-- It is separate from booking_cutoff_minutes (relative to each session's start).
alter table public.offerings
  add column if not exists slug text,
  add column if not exists short_description text,
  add column if not exists booking_closes_at timestamp;

alter table public.offerings
  add constraint offerings_slug_format
    check (slug is null or slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$');
create unique index offerings_slug_key on public.offerings (slug) where slug is not null;

-- Schedule ------------------------------------------------------------------------------
create table public.event_schedule_items (
  id uuid primary key default gen_random_uuid(),
  offering_id uuid not null references public.offerings (id) on delete cascade,
  day date not null,
  start_time time not null,
  end_time time check (end_time is null or end_time > start_time),
  title text not null check (length(trim(title)) > 0),
  location text,
  description text,
  position int not null default 0
);
create index event_schedule_items_offering_idx
  on public.event_schedule_items (offering_id, day, start_time);

-- Gallery: extra photos beyond the cover (menus, programs, venue) -----------------------
create table public.event_images (
  id uuid primary key default gen_random_uuid(),
  offering_id uuid not null references public.offerings (id) on delete cascade,
  path text not null check (length(trim(path)) > 0),
  position int not null default 0
);
create index event_images_offering_idx on public.event_images (offering_id, position);

alter table public.event_schedule_items enable row level security;
alter table public.event_images enable row level security;

create policy "View schedule" on public.event_schedule_items
  for select to anon, authenticated using (public.can_view_offering(offering_id));
create policy "Manage schedule" on public.event_schedule_items
  for all to authenticated
  using (public.can_manage_offering(offering_id))
  with check (public.can_manage_offering(offering_id));

create policy "View event images" on public.event_images
  for select to anon, authenticated using (public.can_view_offering(offering_id));
create policy "Manage event images" on public.event_images
  for all to authenticated
  using (public.can_manage_offering(offering_id))
  with check (public.can_manage_offering(offering_id));

-- Booking cut-off ---------------------------------------------------------------------------
-- Online bookings (portal and public) stop at booking_closes_at. Staff can still add people.
create or replace function public.enforce_booking_closes_at()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  closes timestamp;
begin
  if new.source = 'staff' then
    return new;
  end if;
  select booking_closes_at into closes from public.offerings where id = new.offering_id;
  if closes is not null and closes <= public.org_now() then
    raise exception 'Registration closed.' using errcode = 'P0001';
  end if;
  return new;
end;
$$;

create trigger registrations_booking_closes_at
  before insert on public.registrations
  for each row execute function public.enforce_booking_closes_at();
