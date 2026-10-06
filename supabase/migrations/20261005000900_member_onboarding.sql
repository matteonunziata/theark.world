-- Members portal onboarding, WhatsApp between members, and who's going.
-- User decision, 2026-10-05.

-- Profile ---------------------------------------------------------------------------
-- Cities a member spends time in (free text, several), when they finished
-- onboarding, and when the portal welcome email went out.
alter table public.contacts
  add column if not exists cities text[] not null default '{}',
  add column if not exists onboarded_at timestamptz,
  add column if not exists welcome_sent_at timestamptz;

drop function if exists public.my_member_profile();
create function public.my_member_profile()
returns table (
  id uuid,
  name text,
  email text,
  phone text,
  tier text,
  membership_status text,
  member_since date,
  renews_on date,
  city_id uuid,
  cities text[],
  bio text,
  interests text[],
  instagram text,
  photo_path text,
  open_to_connect boolean,
  show_in_directory boolean,
  onboarded_at timestamptz,
  discount_name text,
  discount_percent numeric
)
language sql
stable
security definer
set search_path = ''
as $$
  select c.id, c.name, c.email::text, c.phone, c.tier, c.membership_status, c.member_since,
    c.renews_on, c.city_id, c.cities, c.bio, c.interests, c.instagram, c.photo_path,
    c.open_to_connect, c.show_in_directory, c.onboarded_at, d.name, d.percent
  from public.contacts c
  left join public.discounts d on d.id = c.discount_id
  where c.id = public.current_member_contact_id();
$$;
revoke execute on function public.my_member_profile() from anon, public;
grant execute on function public.my_member_profile() to authenticated;

-- Members edit their name and WhatsApp too now; the city picker is gone, so
-- city_id is left as it is.
drop function if exists public.update_my_profile(text, text[], uuid, text, boolean, boolean);
create function public.update_my_profile(
  p_name text,
  p_phone text,
  p_bio text,
  p_interests text[],
  p_cities text[],
  p_instagram text,
  p_open_to_connect boolean,
  p_show_in_directory boolean
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  me uuid := public.current_member_contact_id();
begin
  if me is null then
    raise exception 'Only members can edit a member profile.' using errcode = '42501';
  end if;
  if length(trim(coalesce(p_name, ''))) < 2 then
    raise exception 'Enter your name.' using errcode = 'P0001';
  end if;
  update public.contacts set
    name = trim(p_name),
    phone = nullif(trim(coalesce(p_phone, '')), ''),
    bio = nullif(trim(coalesce(p_bio, '')), ''),
    interests = coalesce(p_interests, '{}'),
    cities = coalesce(p_cities, '{}'),
    instagram = nullif(trim(coalesce(p_instagram, '')), ''),
    open_to_connect = coalesce(p_open_to_connect, true),
    show_in_directory = coalesce(p_show_in_directory, true)
  where id = me;
end;
$$;
revoke execute on function public.update_my_profile(text, text, text, text[], text[], text, boolean, boolean) from anon, public;
grant execute on function public.update_my_profile(text, text, text, text[], text[], text, boolean, boolean) to authenticated;

-- The quick onboarding after the welcome email: the same fields, and it
-- marks the member as onboarded so the portal stops asking.
create or replace function public.complete_my_onboarding(
  p_name text,
  p_phone text,
  p_instagram text,
  p_bio text,
  p_cities text[],
  p_open_to_connect boolean
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  me uuid := public.current_member_contact_id();
begin
  if me is null then
    raise exception 'Only members can finish onboarding.' using errcode = '42501';
  end if;
  if length(trim(coalesce(p_name, ''))) < 2 then
    raise exception 'Enter your name.' using errcode = 'P0001';
  end if;
  update public.contacts set
    name = trim(p_name),
    phone = nullif(trim(coalesce(p_phone, '')), ''),
    instagram = nullif(trim(coalesce(p_instagram, '')), ''),
    bio = nullif(trim(coalesce(p_bio, '')), ''),
    cities = coalesce(p_cities, '{}'),
    open_to_connect = coalesce(p_open_to_connect, true),
    onboarded_at = coalesce(onboarded_at, now())
  where id = me;
end;
$$;
revoke execute on function public.complete_my_onboarding(text, text, text, text, text[], boolean) from anon, public;
grant execute on function public.complete_my_onboarding(text, text, text, text, text[], boolean) to authenticated;

-- Directory ---------------------------------------------------------------------------
-- Members message each other on WhatsApp now, so a member who is open to
-- connecting shares their number (and Instagram) with other members. Email
-- stays private. Photos and cities show too.
drop function if exists public.member_directory();
create function public.member_directory()
returns table (
  id uuid,
  name text,
  tier text,
  city_id uuid,
  cities text[],
  bio text,
  interests text[],
  instagram text,
  phone text,
  photo_path text,
  open_to_connect boolean,
  is_me boolean
)
language sql
stable
security definer
set search_path = ''
as $$
  select c.id, c.name, c.tier, c.city_id, c.cities, c.bio, c.interests,
    case when c.open_to_connect then c.instagram end,
    case when c.open_to_connect then c.phone end,
    c.photo_path,
    c.open_to_connect,
    c.id = public.current_member_contact_id()
  from public.contacts c
  where (public.is_member() or public.is_staff())
    and c.tier is not null
    and c.membership_status = 'active'
    and (c.show_in_directory or c.id = public.current_member_contact_id())
  order by c.name;
$$;
revoke execute on function public.member_directory() from anon, public;
grant execute on function public.member_directory() to authenticated;

-- Who's going -------------------------------------------------------------------------
-- Members (and staff) see which directory members are booked into the
-- sessions of a class or event. Guests who booked from the public page and
-- members who stay out of the directory are counted, not named.
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
    and c.tier is not null
    and c.membership_status = 'active'
    and (c.show_in_directory or c.id = public.current_member_contact_id())
  order by r.session_date, c.id;
$$;
revoke execute on function public.session_attendees(uuid, date, date) from anon, public;
grant execute on function public.session_attendees(uuid, date, date) to authenticated;
