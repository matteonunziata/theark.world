-- Community managers issue passes: they can create a contact (first name, last
-- name, phone, email), attach the photo every pass needs, and give a
-- membership. They still can't edit other contacts directly.

create or replace function public.can_issue_pass()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(public.staff_role() in ('admin', 'sales', 'community_manager'), false);
$$;

-- A new contact from the Add new member drawer. Sales own what they add.
create or replace function public.add_member_contact(
  p_first text, p_last text, p_phone text, p_email text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_name text := nullif(trim(concat_ws(' ', trim(p_first), trim(p_last))), '');
  v_email text := nullif(lower(trim(coalesce(p_email, ''))), '');
  v_id uuid;
begin
  if not public.can_issue_pass() then
    raise exception 'You can''t add people.' using errcode = '42501';
  end if;
  if v_name is null then
    raise exception 'Enter a first name.' using errcode = 'P0001';
  end if;
  if v_email is not null and exists (select 1 from public.contacts where lower(email) = v_email) then
    raise exception 'Someone already has that email. Search for them instead.' using errcode = 'P0001';
  end if;
  insert into public.contacts (name, email, phone, type, source, owner_id, created_by)
  values (v_name, v_email, nullif(trim(coalesce(p_phone, '')), ''), 'contact', 'Memberships',
          public.current_staff_id(), public.current_staff_id())
  returning id into v_id;
  return v_id;
end;
$$;
revoke all on function public.add_member_contact(text, text, text, text) from public, anon;
grant execute on function public.add_member_contact(text, text, text, text) to authenticated;

create or replace function public.set_contact_photo(p_contact uuid, p_path text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.can_issue_pass() then
    raise exception 'You can''t change this photo.' using errcode = '42501';
  end if;
  if p_path is null or p_path !~ '^contacts/[0-9a-f-]{36}/[A-Za-z0-9._-]+$' then
    raise exception 'That photo isn''t valid.' using errcode = 'P0001';
  end if;
  update public.contacts set photo_path = p_path where id = p_contact;
end;
$$;
revoke all on function public.set_contact_photo(uuid, text) from public, anon;
grant execute on function public.set_contact_photo(uuid, text) to authenticated;

-- Staff upload photos for other people into avatars/contacts/<random id>/.
create policy "Pass issuers upload contact photos" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = 'contacts'
    and public.can_issue_pass()
  );
create policy "Pass issuers replace contact photos" on storage.objects
  for update to authenticated
  using (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = 'contacts'
    and public.can_issue_pass()
  );

-- set_membership: community managers may issue it too.
create or replace function public.set_membership(p_contact uuid, p_tier text, p_status text, p_starts date, p_ends date)
 returns uuid
 language plpgsql
 security definer
 set search_path to ''
as $function$
declare
  d date := public.org_today();
  cur public.memberships;
  t public.membership_tiers;
  v_status text;
  v_from date;
  v_to date;
  v_id uuid;
begin
  if not (public.can_write_contact(p_contact) or public.staff_role() = 'community_manager') then
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
$function$;
