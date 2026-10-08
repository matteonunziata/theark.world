-- The whole ARK team shows in the members portal directory (user decision,
-- 2026-10-08). Team contacts were created hidden; now they appear by default.
-- Members can still switch it off on Me. Test accounts stay hidden.

-- Only touch people who haven't finished onboarding: after that the choice is theirs.
update public.contacts c set show_in_directory = true
where c.onboarded_at is null
  and c.email not like 'test.%'
  and exists (
    select 1 from public.team_members t
    where t.status = 'active' and lower(t.email) = lower(c.email)
  );

-- New team members start visible.
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
      values (new.name, new.email, 'member', 'Team', new.email not like 'test.%')
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
