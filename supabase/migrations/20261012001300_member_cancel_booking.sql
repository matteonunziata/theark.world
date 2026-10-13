-- Members cancel their own class or event booking from the portal.
-- Same effect as staff cancelling: the record (and any payment) stays, the seats are freed.
-- Allowed until the session starts, and not once the person has checked in.
create or replace function public.cancel_my_registration(p_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  r public.registrations;
  o public.offerings;
  v_tz text;
  v_now timestamp;
begin
  select * into r from public.registrations
  where id = p_id
    and (
      (contact_id is not null and contact_id = public.current_member_contact_id())
      or user_id = auth.uid()
    )
  for update;
  if not found then
    raise exception 'That booking can’t be cancelled.' using errcode = 'P0001';
  end if;
  if r.status = 'cancelled' then return; end if;
  if r.checked_in_at is not null then
    raise exception 'You’ve already checked in.' using errcode = 'P0001';
  end if;
  select * into o from public.offerings where id = r.offering_id;
  select timezone into v_tz from public.org_settings;
  v_now := now() at time zone coalesce(v_tz, 'America/Costa_Rica');
  if r.session_date < v_now::date
    or (r.session_date = v_now::date and o.start_time is not null and o.start_time <= v_now::time) then
    raise exception 'This has already started, so it can’t be cancelled.' using errcode = 'P0001';
  end if;
  update public.registrations
  set status = 'cancelled', cancelled_at = now(), hold_until = null
  where id = r.id;
end;
$$;
revoke all on function public.cancel_my_registration(uuid) from public, anon;
grant execute on function public.cancel_my_registration(uuid) to authenticated;
