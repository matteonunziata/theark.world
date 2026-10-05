-- Everyone on the team (staff and facilitators) is also a member, and one
-- email sign-in works for both. User decision, 2026-10-05.

-- A Team tier that isn't sold: it marks staff memberships in the CRM.
insert into public.membership_tiers (key, name, price, period, description, perks, position, active)
values ('team', 'Team', null, 'month', 'Staff and facilitators. Comes with being on the team.', '{}', 99, false)
on conflict (key) do nothing;

-- Keep each active team member's member record in step with the team.
-- A paid membership they already have is left alone.
create or replace function public.sync_team_membership()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  cid uuid;
begin
  if new.email is null then return new; end if;
  select id into cid from public.contacts where email = new.email limit 1;

  if new.status = 'active' then
    if cid is null then
      insert into public.contacts (name, email, type, tier, membership_status, source, show_in_directory)
      values (new.name, new.email, 'member', 'team', 'active', 'Team', false);
    else
      update public.contacts
      set tier = 'team', membership_status = 'active', type = 'member'
      where id = cid and (tier is null or tier = 'team');
    end if;
  elsif cid is not null then
    update public.contacts set membership_status = 'expired'
    where id = cid and tier = 'team';
  end if;
  return new;
end;
$$;

revoke all on function public.sync_team_membership() from authenticated, anon, public;

create trigger team_members_sync_membership
  after insert or update of email, status on public.team_members
  for each row execute function public.sync_team_membership();

-- Team emails used to be kept out of member records; link them like anyone else.
create or replace function public.link_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.team_members set user_id = new.id
  where lower(email::text) = lower(new.email) and user_id is null;
  update public.contacts set user_id = new.id
  where lower(email::text) = lower(new.email) and user_id is null;
  return new;
end;
$$;

create or replace function public.link_contact_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.email is not null and new.user_id is null then
    select u.id into new.user_id
    from auth.users u
    where lower(u.email) = lower(new.email::text);
  end if;
  return new;
end;
$$;

-- Email links work for anyone on the team, whatever their role or domain,
-- and for active members. Google stays @theark.world team accounts only.
create or replace function public.hook_before_user_created(event jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_provider text := event -> 'user' -> 'app_metadata' ->> 'provider';
  v_email text := lower(coalesce(event -> 'user' ->> 'email', ''));
  v_hd text := event -> 'user' -> 'user_metadata' -> 'custom_claims' ->> 'hd';
begin
  if v_provider = 'google' then
    if public.is_ark_email(v_email) is not true
      or coalesce(v_hd, 'theark.world') <> 'theark.world' then
      return public.auth_reject(
        'Sign in with your @theark.world Google account.'
      );
    end if;
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
      where lower(c.email::text) = v_email
        and c.tier is not null
        and c.membership_status = 'active'
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

-- Bring the current team in.
update public.team_members set status = status where email is not null;

-- Link member records to logins that already exist.
update public.contacts c set user_id = u.id
from auth.users u
where c.user_id is null and c.email is not null and lower(u.email) = lower(c.email::text);
