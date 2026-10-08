-- Who's going, across every session in a date range, for the portal's schedule
-- cards. Same rules as session_attendees: live bookings by directory members.
create or replace function public.portal_attendees(p_from date, p_to date)
returns table (
  offering_id uuid,
  session_date date,
  id uuid,
  name text,
  photo_path text,
  is_me boolean
)
language sql
stable
security definer
set search_path = ''
as $$
  select distinct on (r.offering_id, r.session_date, c.id)
    r.offering_id, r.session_date, c.id, c.name, c.photo_path,
    c.id = public.current_member_contact_id()
  from public.registrations r
  join public.contacts c on c.id = r.contact_id
  where (public.is_member() or public.is_staff())
    and r.session_date between p_from and p_to
    and public.registration_live(r)
    and public.can_view_offering(r.offering_id)
    and c.tier is not null
    and c.membership_status = 'active'
    and (c.show_in_directory or c.id = public.current_member_contact_id())
  order by r.offering_id, r.session_date, c.id;
$$;
revoke execute on function public.portal_attendees(date, date) from anon, public;
grant execute on function public.portal_attendees(date, date) to authenticated;
