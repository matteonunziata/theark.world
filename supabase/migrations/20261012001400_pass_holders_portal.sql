-- Everyone who buys a pass gets the members portal, and everyone needs a photo.
-- User decisions, 2026-10-12.
--
-- Two questions that used to be one:
--   has_portal_login(cid)  can this person sign in? Anyone who ever held a
--                          pass or membership that wasn't revoked, expired or not.
--   has_portal_access(cid) can they book and interact? Only while a pass or
--                          membership covers today, is paused, is waiting for
--                          its first visit, or starts later.
-- current_member_contact_id() and is_member() mean "has access", so every
-- existing booking, guest and profile function stops working the day a pass
-- ends without touching any of them. current_portal_contact_id() is the
-- sign-in version, used to show someone whose pass has ended where they are
-- and how to buy another.
--
-- is_portal_member() is left as it was (memberships of a month or longer);
-- the directory, "who's going" and the members mailing list still use it, so
-- day-pass holders don't appear there.

create or replace function public.has_portal_login(cid uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.memberships m
    where m.contact_id = cid and m.status <> 'revoked'
  );
$$;
revoke all on function public.has_portal_login(uuid) from public;
grant execute on function public.has_portal_login(uuid) to anon, authenticated;

create or replace function public.has_portal_access(cid uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.memberships m
    where m.contact_id = cid
      and public.membership_bucket(m, public.org_today()) in (0, 1, 2, 3)
  );
$$;
revoke all on function public.has_portal_access(uuid) from public;
grant execute on function public.has_portal_access(uuid) to anon, authenticated;

create or replace function public.is_member()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.contacts c
    where c.user_id = auth.uid() and public.has_portal_access(c.id)
  );
$$;

create or replace function public.current_member_contact_id()
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select c.id from public.contacts c
  where c.user_id = auth.uid() and public.has_portal_access(c.id);
$$;

create or replace function public.current_portal_contact_id()
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select c.id from public.contacts c
  where c.user_id = auth.uid() and public.has_portal_login(c.id);
$$;
revoke all on function public.current_portal_contact_id() from public, anon;
grant execute on function public.current_portal_contact_id() to authenticated;

-- Sign-in: the team, anyone who holds or held a pass or membership, and active stewards.
create or replace function public.sign_in_check(p_email text)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select case
    when lower(trim(coalesce(p_email, ''))) !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$'
      then 'Enter a valid email.'
    when exists (
      select 1 from public.team_members t
      where lower(t.email::text) = lower(trim(p_email)) and t.status = 'active'
    ) or exists (
      select 1 from public.contacts c
      where lower(c.email::text) = lower(trim(p_email)) and public.has_portal_login(c.id)
    ) or public.is_active_steward_email(p_email) then null
    else 'We couldn’t find that email on the team, a pass, a membership or an active stewardship. Write to us and we’ll sort it out.'
  end;
$$;

create or replace function public.hook_before_user_created(event jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_provider text := event -> 'user' -> 'app_metadata' ->> 'provider';
  v_email text := lower(coalesce(event -> 'user' ->> 'email', ''));
begin
  if v_provider = 'google' then
    if not exists (
      select 1 from public.team_members t
      where lower(t.email::text) = v_email and t.status = 'active'
    ) then
      return public.auth_reject(
        'You haven''t been added to ARK OS yet. Ask an admin to add you in Settings, Team.'
      );
    end if;
    return '{}'::jsonb;
  end if;

  if v_provider = 'email' then
    if exists (
      select 1 from public.team_members t
      where lower(t.email::text) = v_email and t.status = 'active'
    ) or exists (
      select 1 from public.contacts c
      where lower(c.email::text) = v_email and public.has_portal_login(c.id)
    ) or public.is_active_steward_email(v_email) then
      return '{}'::jsonb;
    end if;
    return public.auth_reject(
      'We couldn''t find that email on the team, a pass, a membership or an active stewardship. Write to us and we''ll sort it out.'
    );
  end if;

  return public.auth_reject('This sign-in method isn''t available.');
end;
$$;

-- Someone whose pass has ended still reads their own profile and memberships,
-- so the portal can say what ended and offer another.
drop policy if exists "Read memberships" on public.memberships;
create policy "Read memberships" on public.memberships
  for select to authenticated
  using (
    public.can_read_contact(contact_id)
    or contact_id = public.current_member_contact_id()
    or contact_id = public.current_portal_contact_id()
  );

create or replace function public.my_member_profile()
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
  where c.id = public.current_portal_contact_id();
$$;

-- A photo is required -------------------------------------------------------------------
-- Security lets people in by their face, so the portal won't open for anyone
-- without one (the app sends them to the welcome page), onboarding won't
-- finish without one, and it can't be removed.

create or replace function public.set_my_photo(p_path text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  me uuid := public.current_member_contact_id();
  v_path text := nullif(trim(coalesce(p_path, '')), '');
begin
  if me is null then
    raise exception 'Only members can add a profile photo.' using errcode = '42501';
  end if;
  if v_path is null then
    raise exception 'A photo is needed so security can let you in. Choose a new one instead.' using errcode = 'P0001';
  end if;
  if split_part(v_path, '/', 1) <> auth.uid()::text then
    raise exception 'Upload the photo again.' using errcode = 'P0001';
  end if;
  update public.contacts set photo_path = v_path where id = me;
end;
$$;

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
  if not exists (select 1 from public.contacts where id = me and photo_path is not null) then
    raise exception 'Add a photo so security can let you in.' using errcode = 'P0001';
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

-- Claiming a pass -------------------------------------------------------------------------
-- A pass that hasn't been used yet starts at the gate. Without a photo on file
-- it can't: the gate shows "Needs a photo" until the holder adds one in the
-- member app. Memberships already running are not held up.

alter table public.gate_entries drop constraint if exists gate_entries_result_check;
alter table public.gate_entries add constraint gate_entries_result_check
  check (result in ('admitted', 'checked_in', 'paused', 'not_started', 'expired', 'inactive', 'not_found', 'no_photo'));

create or replace function public.gate_state(cid uuid)
returns table (
  membership_id uuid, tier text, tier_name text, period text, state text,
  valid_from date, valid_until date, activate_by date, checked_in_at timestamptz
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  d date := public.org_today();
  m public.memberships;
  t public.membership_tiers;
  b int;
  v_in timestamptz;
  v_photo text;
  steward boolean := exists (select 1 from public.property_stewards where contact_id = cid);
begin
  select max(e.entered_at) into v_in
  from public.gate_entries e
  where e.contact_id = cid and e.result = 'admitted'
    and (e.entered_at at time zone (select timezone from public.org_settings))::date = d;
  select photo_path into v_photo from public.contacts where id = cid;
  m := public.current_membership(cid, d);
  if m.id is not null then
    select * into t from public.membership_tiers where key = m.tier;
    b := public.membership_bucket(m, d);
  end if;
  if steward and (m.id is null or b not in (0, 2)) then
    return query select m.id, null::text, 'Steward'::text, 'steward'::text,
      case when v_in is not null then 'checked_in' else 'valid' end::text,
      null::date, null::date, null::date, v_in;
    return;
  end if;
  if m.id is null then
    return query select null::uuid, null::text, null::text, null::text, 'inactive'::text,
      null::date, null::date, null::date, null::timestamptz;
    return;
  end if;
  return query select m.id, m.tier, t.name, t.period,
    case b
      when 0 then case when v_in is not null then 'checked_in' else 'valid' end
      when 1 then 'paused'
      when 2 then case when v_photo is null then 'no_photo' else 'unused' end
      when 3 then 'not_started'
      else 'expired'
    end::text,
    m.starts_on, m.ends_on, m.activate_by, v_in;
end;
$$;
revoke all on function public.gate_state(uuid) from public, anon, authenticated;
