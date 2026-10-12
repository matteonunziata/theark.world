-- Find and merge duplicate contacts.
-- find_duplicate_contacts() runs as the caller, so RLS decides who sees which contacts.
-- merge_contacts() is admin-only: it moves everything from the duplicate onto the contact
-- being kept, fills blanks on the kept contact, notes the merge, and deletes the duplicate.

create or replace function public.find_duplicate_contacts()
returns table (a_id uuid, b_id uuid, reason text)
language sql
stable
set search_path = ''
as $$
  with c as (
    select id, email::text as email,
      regexp_replace(lower(trim(name)), '\s+', ' ', 'g') as nm,
      regexp_replace(coalesce(phone, ''), '\D', '', 'g') as digits,
      split_part(regexp_replace(lower(trim(name)), '\s+', ' ', 'g'), ' ', 1) as first,
      nullif(regexp_replace(lower(trim(name)), '^\S+\s*', ''), '') as rest
    from public.contacts
  )
  select a.id, b.id,
    case
      when a.email is not null and lower(a.email) = lower(b.email) then 'Same email'
      when a.nm = b.nm then 'Same name'
      when length(a.digits) >= 7 and a.digits = b.digits then 'Same phone'
      else 'Similar name'
    end
  from c a
  join c b on a.id < b.id and (
    (a.email is not null and lower(a.email) = lower(b.email))
    or a.nm = b.nm
    or (length(a.digits) >= 7 and a.digits = b.digits)
    or (a.rest is not null and a.rest = b.rest
        and length(least(a.first, b.first)) >= 3
        and (a.first like b.first || '%' or b.first like a.first || '%'))
  )
  order by 3, 1;
$$;

create or replace function public.merge_contacts(p_keep uuid, p_drop uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  k public.contacts;
  d public.contacts;
  r record;
  ks public.stewardships;
  ds public.stewardships;
begin
  if not public.has_role('admin') then
    raise exception using errcode = '42501', message = 'Only admins can merge contacts.';
  end if;
  if p_keep = p_drop then
    raise exception using errcode = 'P0001', message = 'Pick two different contacts.';
  end if;
  select * into k from public.contacts where id = p_keep;
  select * into d from public.contacts where id = p_drop;
  if k.id is null or d.id is null then
    raise exception using errcode = 'P0001', message = 'One of those contacts no longer exists.';
  end if;
  -- Never delete a sign-in that belongs to the team.
  if d.user_id is not null and d.user_id is distinct from k.user_id
     and exists (select 1 from public.team_members t where t.user_id = d.user_id) then
    raise exception using errcode = 'P0001',
      message = 'That record is a team member’s sign-in. Keep it and merge the other one into it.';
  end if;

  -- Rows that would collide with the kept contact's own: the kept contact's win.
  delete from public.contact_stages x where x.contact_id = p_drop
    and exists (select 1 from public.contact_stages y where y.contact_id = p_keep and y.pipeline = x.pipeline);
  delete from public.email_sends x where x.contact_id = p_drop
    and exists (select 1 from public.email_sends y where y.contact_id = p_keep and y.automation_step = x.automation_step);
  delete from public.enrollments x where x.contact_id = p_drop and x.status = 'active'
    and exists (select 1 from public.enrollments y where y.contact_id = p_keep and y.sequence_id = x.sequence_id and y.status = 'active');
  delete from public.integration_links x where x.contact_id = p_drop
    and exists (select 1 from public.integration_links y where y.contact_id = p_keep and y.provider = x.provider);
  delete from public.property_stewards x where x.contact_id = p_drop
    and exists (select 1 from public.property_stewards y where y.contact_id = p_keep and y.lot_id = x.lot_id);

  -- One stewardship per person: keep the kept contact's, unless only the duplicate is active.
  select * into ks from public.stewardships where contact_id = p_keep;
  select * into ds from public.stewardships where contact_id = p_drop;
  if ds.contact_id is not null and ks.contact_id is not null then
    if ds.status = 'active' and ks.status <> 'active' then
      update public.stewardships set
        status = ds.status,
        active_since = ds.active_since,
        status_reason = ds.status_reason
      where contact_id = p_keep;
    end if;
    if ks.agreement_signed_at is null and ds.agreement_signed_at is not null then
      update public.stewardships set
        agreement_signed_at = ds.agreement_signed_at,
        agreement_path = ds.agreement_path,
        agreement_name = ds.agreement_name
      where contact_id = p_keep;
    end if;
    delete from public.stewardships where contact_id = p_drop;
  end if;

  -- Everything else that points at a contact moves over.
  for r in
    select c.conrelid::regclass::text as tbl, a.attname as col
    from pg_constraint c
    join pg_attribute a on a.attrelid = c.conrelid and a.attnum = any (c.conkey)
    where c.contype = 'f' and c.confrelid = 'public.contacts'::regclass
      and c.conrelid <> 'public.contacts'::regclass
  loop
    execute format('update %s set %I = $1 where %I = $2', r.tbl, r.col, r.col) using p_keep, p_drop;
  end loop;

  -- Free the unique values (email, sign-in, tokens), then fill the kept contact's blanks.
  delete from public.contacts where id = p_drop;
  update public.contacts set
    email = coalesce(k.email, d.email),
    user_id = coalesce(k.user_id, d.user_id),
    phone = coalesce(k.phone, d.phone),
    instagram = coalesce(k.instagram, d.instagram),
    location = coalesce(k.location, d.location),
    source = coalesce(k.source, d.source),
    bio = coalesce(k.bio, d.bio),
    photo_path = coalesce(k.photo_path, d.photo_path),
    city_id = coalesce(k.city_id, d.city_id),
    type = case when 'member' in (k.type, d.type) then 'member'
                when 'steward' in (k.type, d.type) then 'steward' else 'contact' end,
    email_opt_out = k.email_opt_out or d.email_opt_out
  where id = p_keep;

  perform public.refresh_contact_membership(p_keep);

  insert into public.contact_notes (contact_id, author_id, body)
  values (p_keep, (select t.id from public.team_members t where t.user_id = auth.uid()),
    'Merged duplicate contact "' || d.name || '"' || coalesce(' (' || d.email::text || ')', '') || ' into this one.');
end;
$$;

revoke all on function public.merge_contacts(uuid, uuid) from public, anon;
grant execute on function public.merge_contacts(uuid, uuid) to authenticated;
grant execute on function public.find_duplicate_contacts() to authenticated;
