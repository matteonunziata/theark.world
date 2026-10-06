-- Two follow-ups to the memberships migration.
-- 1. Saving a contact who holds an unused pass sent the cache's "upcoming"
--    status back without a date; leave the pass alone in that case.
-- 2. Someone added to the team and removed the same day had a one-day Team
--    row revoked; just remove it, there was never a membership.

create or replace function public.set_membership(
  p_contact uuid, p_tier text, p_status text, p_starts date, p_ends date
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  d date := public.org_today();
  cur public.memberships;
  t public.membership_tiers;
  v_status text;
  v_from date;
  v_to date;
  v_id uuid;
begin
  if not public.can_write_contact(p_contact) then
    raise exception 'You can''t change this person''s membership.' using errcode = '42501';
  end if;
  cur := public.current_membership(p_contact, d);

  if nullif(trim(coalesce(p_tier, '')), '') is null then
    update public.memberships set
      status = 'revoked', revoked_at = now(), revoke_reason = 'Removed in the CRM'
    where contact_id = p_contact and status <> 'revoked'
      and public.membership_bucket(memberships, d) in (0, 1, 2, 3);
    return null;
  end if;

  select * into t from public.membership_tiers where key = p_tier;
  if not found then
    raise exception 'Unknown tier %.', p_tier using errcode = 'P0001';
  end if;

  -- An unused pass saved back as it is: nothing to change.
  if cur.id is not null and cur.tier = p_tier and cur.status = 'unused'
    and p_status = 'upcoming' and p_starts is null then
    return cur.id;
  end if;

  v_status := case p_status when 'paused' then 'paused' else 'active' end;
  v_from := coalesce(p_starts, case when cur.id is not null and cur.tier = p_tier then cur.starts_on end, d);
  v_to := p_ends;
  if p_status = 'upcoming' then
    if p_starts is null or p_starts <= d then
      raise exception 'Give the date the membership starts.' using errcode = 'P0001';
    end if;
  elsif p_status = 'expired' then
    v_to := least(coalesce(p_ends, d - 1), d - 1);
    if v_from > v_to then v_from := v_to; end if;
  elsif v_to is null and t.period in ('day', 'week') then
    v_to := case when t.period = 'week' then v_from + 6 else v_from end;
  end if;
  if v_to is not null and v_to < v_from then
    raise exception 'The end date is before the start date.' using errcode = 'P0001';
  end if;

  if cur.id is not null and cur.tier = p_tier and cur.status <> 'revoked' then
    update public.memberships set
      status = v_status, starts_on = v_from, ends_on = v_to,
      activate_by = null,
      activated_at = coalesce(activated_at, case when cur.status = 'unused' then now() end),
      activated_by = coalesce(activated_by, case when cur.status = 'unused' then public.current_staff_id() end)
    where id = cur.id
    returning id into v_id;
    return v_id;
  end if;

  -- A different tier: the covering membership ends yesterday (or is
  -- revoked if it only just started), passes are left alone.
  if cur.id is not null and public.membership_bucket(cur, d) in (0, 1) then
    select * into t from public.membership_tiers where key = cur.tier;
    if t.period not in ('day', 'week') then
      if cur.starts_on < d then
        update public.memberships set ends_on = d - 1 where id = cur.id;
      else
        update public.memberships set status = 'revoked', revoked_at = now(), revoke_reason = 'Replaced in the CRM'
        where id = cur.id;
      end if;
    end if;
  end if;

  insert into public.memberships (contact_id, tier, status, starts_on, ends_on, source, created_by)
  values (p_contact, p_tier, v_status, v_from, v_to, 'staff', public.current_staff_id())
  returning id into v_id;
  return v_id;
end;
$$;

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
      where m.contact_id = cid and m.tier = 'team' and m.status = 'active'
        and (m.ends_on is null or m.ends_on >= d)
    ) then
      insert into public.memberships (contact_id, tier, status, starts_on, source)
      values (cid, 'team', 'active', d, 'team');
    end if;
  elsif cid is not null then
    delete from public.memberships
    where contact_id = cid and tier = 'team' and status = 'active' and starts_on >= d;
    update public.memberships set ends_on = d - 1
    where contact_id = cid and tier = 'team' and status = 'active'
      and starts_on < d and (ends_on is null or ends_on >= d);
  end if;
  return new;
end;
$$;
