-- "Who's going" should match the spots count: only live bookings, so people
-- who cancelled (or never paid) are not shown as going.
create or replace function public.session_attendees(p_offering_id uuid, p_from date, p_to date)
returns table (
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
  select distinct on (r.session_date, c.id)
    r.session_date, c.id, c.name, c.photo_path,
    c.id = public.current_member_contact_id()
  from public.registrations r
  join public.contacts c on c.id = r.contact_id
  where (public.is_member() or public.is_staff())
    and r.offering_id = p_offering_id
    and r.session_date between p_from and p_to
    and public.registration_live(r)
    and public.can_view_offering(p_offering_id)
    and c.tier is not null
    and c.membership_status = 'active'
    and (c.show_in_directory or c.id = public.current_member_contact_id())
  order by r.session_date, c.id;
$$;
revoke execute on function public.session_attendees(uuid, date, date) from anon, public;
grant execute on function public.session_attendees(uuid, date, date) to authenticated;
