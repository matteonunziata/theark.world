-- The steward platform: one sign-in for everyone, and only ACTIVE stewards get
-- in. Not every steward is a member, so none of this depends on a membership.

create or replace function public.current_contact_id()
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select id from public.contacts where user_id = auth.uid();
$$;
revoke execute on function public.current_contact_id() from anon, public;
grant execute on function public.current_contact_id() to authenticated;

-- The signed-in person's contact, when its stewardship is active.
create or replace function public.current_active_steward_id()
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select c.id from public.contacts c
  join public.stewardships s on s.contact_id = c.id
  where c.user_id = auth.uid() and s.status = 'active';
$$;
revoke execute on function public.current_active_steward_id() from anon, public;
grant execute on function public.current_active_steward_id() to authenticated;

create or replace function public.is_active_steward_email(p_email text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.contacts c
    join public.stewardships s on s.contact_id = c.id
    where lower(c.email::text) = lower(trim(coalesce(p_email, ''))) and s.status = 'active'
  );
$$;
revoke execute on function public.is_active_steward_email(text) from anon, public;
grant execute on function public.is_active_steward_email(text) to authenticated, service_role;

-- Sign-in: the team, portal members and active stewards.
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
      where lower(c.email::text) = lower(trim(p_email)) and public.is_portal_member(c.id)
    ) or public.is_active_steward_email(p_email) then null
    else 'We couldn’t find that email on the team, an active membership or an active stewardship. Write to us and we’ll sort it out.'
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
      where lower(c.email::text) = v_email and public.is_portal_member(c.id)
    ) or public.is_active_steward_email(v_email) then
      return '{}'::jsonb;
    end if;
    return public.auth_reject(
      'We couldn''t find that email on the team, an active membership or an active stewardship. Write to us and we''ll sort it out.'
    );
  end if;

  return public.auth_reject('This sign-in method isn''t available.');
end;
$$;

-- A steward reads their own stewardship row, member or not.
drop policy "Stewards read their own" on public.stewardships;
create policy "Stewards read their own" on public.stewardships
  for select to authenticated using (contact_id = public.current_contact_id());

-- Everything an owner can do now needs an ACTIVE stewardship on that lot.
create or replace function public.owns_lot(p_lot uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.property_stewards
    where lot_id = p_lot and contact_id = public.current_active_steward_id()
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
    where ps.lot_id = l.id and ps.contact_id = public.current_active_steward_id()
  )
  order by l.code;
$$;

create or replace function public.steward_deactivate_self(p_reason text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare me uuid := public.current_active_steward_id();
begin
  if me is null then
    raise exception 'You''re not an active steward.' using errcode = 'P0001';
  end if;
  perform public.steward_move(me, 'inactive', 'steward', p_reason);
end $$;

-- Hospitality on or off for their own home.
create or replace function public.steward_set_hospitality(p_lot uuid, p_on boolean)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.owns_lot(p_lot) then raise exception 'Not your property.' using errcode = 'P0001'; end if;
  update public.lots set
    in_hospitality = p_on,
    hospitality_since = case when p_on then coalesce(hospitality_since, public.org_today()) end
  where id = p_lot;
end $$;
revoke execute on function public.steward_set_hospitality(uuid, boolean) from anon, public;
grant execute on function public.steward_set_hospitality(uuid, boolean) to authenticated;

-- The recurring services the team has set up for their home (view only).
create or replace function public.my_property_services(p_lot uuid)
returns table (
  id uuid, title text, maint_category text, freq text, every int,
  weekday smallint, month_day smallint, start_date date, end_date date
)
language sql
stable
security definer
set search_path = ''
as $$
  select s.id, s.title, s.maint_category, s.freq, s.every, s.weekday, s.month_day, s.start_date, s.end_date
  from public.property_services s
  where s.lot_id = p_lot and s.active and s.owner_visible and public.owns_lot(p_lot)
  order by s.title;
$$;
revoke execute on function public.my_property_services(uuid) from anon, public;
grant execute on function public.my_property_services(uuid) to authenticated;

-- Who the steward platform greets.
create or replace function public.my_steward_profile()
returns table (id uuid, name text, email text, active_since date)
language sql
stable
security definer
set search_path = ''
as $$
  select c.id, c.name, c.email::text, s.active_since
  from public.contacts c join public.stewardships s on s.contact_id = c.id
  where c.id = public.current_active_steward_id();
$$;
revoke execute on function public.my_steward_profile() from anon, public;
grant execute on function public.my_steward_profile() to authenticated;
