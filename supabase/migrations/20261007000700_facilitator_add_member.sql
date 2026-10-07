-- A facilitator searches the members and adds one to their own class session.
-- Facilitators can't read the CRM, so both steps go through functions that
-- check the caller runs the class.

create or replace function public.search_members_for_class(
  p_offering_id uuid, p_date date, p_query text
)
returns table (id uuid, name text, photo_path text, tier text)
language sql
stable
security definer
set search_path = ''
as $$
  select c.id, c.name, c.photo_path, c.tier
  from public.contacts c
  where public.can_check_in(p_offering_id)
    and length(trim(coalesce(p_query, ''))) >= 2
    and c.type = 'member'
    and c.membership_status = 'active'
    and c.name ilike '%' || replace(replace(trim(p_query), '%', ''), '_', '') || '%'
    and not exists (
      select 1 from public.registrations r
      where r.offering_id = p_offering_id and r.session_date = p_date
        and r.contact_id = c.id and public.registration_live(r)
    )
  order by lower(c.name)
  limit 8;
$$;
revoke execute on function public.search_members_for_class(uuid, date, text) from anon, public;
grant execute on function public.search_members_for_class(uuid, date, text) to authenticated;

create or replace function public.add_member_to_session(
  p_offering_id uuid, p_date date, p_contact_id uuid
)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  o public.offerings;
  c public.contacts;
  v_token text;
begin
  if not public.can_check_in(p_offering_id) then
    raise exception 'You don''t have access to this class.' using errcode = '42501';
  end if;
  select * into o from public.offerings where id = p_offering_id for update;
  if not found then
    raise exception 'That class no longer exists.' using errcode = 'P0001';
  end if;
  if not public.occurs_on(o, p_date) then
    raise exception 'This class doesn''t run on that day.' using errcode = 'P0001';
  end if;
  select * into c from public.contacts where id = p_contact_id and type = 'member';
  if not found then
    raise exception 'Pick a member.' using errcode = 'P0001';
  end if;
  if o.capacity is not null and (
    select count(*) from public.registrations r
    where r.offering_id = p_offering_id and r.session_date = p_date
      and public.registration_live(r)
  ) >= o.capacity then
    raise exception 'This session is full.' using errcode = 'P0001';
  end if;
  if exists (
    select 1 from public.registrations r
    where r.offering_id = p_offering_id and r.session_date = p_date
      and r.contact_id = c.id and public.registration_live(r)
  ) then
    raise exception 'They''re already booked for this session.' using errcode = 'P0001';
  end if;

  insert into public.registrations (offering_id, session_date, name, email, contact_id, source)
  values (p_offering_id, p_date, c.name, c.email, c.id, 'staff')
  returning qr_token into v_token;
  return v_token;
end;
$$;
revoke execute on function public.add_member_to_session(uuid, date, uuid) from anon, public;
grant execute on function public.add_member_to_session(uuid, date, uuid) to authenticated;
