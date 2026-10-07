-- 1. Google sign-in is no longer limited to @theark.world: anyone added to
--    Settings > Team with an active status can sign in with the Google account
--    that matches their email. (Email links already worked for any domain.)
-- 2. Team is no longer a membership tier (user decision, 2026-10-07). Everyone
--    on the team holds an Annual membership, so team members get Annual's
--    guest passes and can bring guests.

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
    ) then null
    else 'We couldn’t find that email on the team or on an active membership. Write to us and we’ll sort it out.'
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
    ) then
      return '{}'::jsonb;
    end if;
    return public.auth_reject(
      'We couldn''t find that email on the team or on an active membership. Write to us and we''ll sort it out.'
    );
  end if;

  return public.auth_reject('This sign-in method isn''t available.');
end;
$$;

-- Team members get an Annual membership (source 'team'), open-ended while
-- they're on the team. A membership they already hold is left alone.
create or replace function public.sync_team_membership()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  cid uuid;
  d date := public.org_today();
begin
  if new.email is null then return new; end if;
  select id into cid from public.contacts where email = new.email limit 1;

  if new.status = 'active' then
    if cid is null then
      insert into public.contacts (name, email, type, source, show_in_directory)
      values (new.name, new.email, 'member', 'Team', false)
      returning id into cid;
    end if;
    if not exists (
      select 1 from public.memberships m
      where m.contact_id = cid and m.status = 'active'
        and m.starts_on <= d and (m.ends_on is null or m.ends_on >= d)
    ) then
      insert into public.memberships (contact_id, tier, status, starts_on, source)
      values (cid, 'annual', 'active', d, 'team');
    end if;
  elsif cid is not null then
    delete from public.memberships
    where contact_id = cid and source = 'team' and status = 'active' and starts_on >= d;
    update public.memberships set ends_on = d - 1
    where contact_id = cid and source = 'team' and status = 'active'
      and starts_on < d and (ends_on is null or ends_on >= d);
  end if;
  return new;
end;
$$;

create or replace function public.contact_insert_membership()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  d date := public.org_today();
  v_from date;
  v_to date;
begin
  if new.tier is null then return new; end if;
  v_from := coalesce(new.member_since, d);
  select case
      when new.membership_status = 'expired' then least(coalesce(new.renews_on, d - 1), d - 1)
      when t.period = 'day' then coalesce(new.renews_on, v_from)
      when t.period = 'week' then coalesce(new.renews_on, v_from + 6)
      else new.renews_on
    end into v_to
  from public.membership_tiers t where t.key = new.tier;
  if v_to is not null and v_to < v_from then v_from := v_to; end if;
  insert into public.memberships (contact_id, tier, status, starts_on, ends_on, source, created_by)
  values (new.id, new.tier,
    case when new.membership_status = 'paused' then 'paused' else 'active' end,
    v_from, v_to, 'import', new.created_by);
  return new;
end;
$$;

-- Move current Team memberships to Annual, then drop the tier.
update public.memberships set tier = 'annual' where tier = 'team';
update public.payments set tier = null where tier = 'team';
delete from public.membership_tiers where key = 'team';
