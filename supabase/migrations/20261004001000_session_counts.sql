-- Spots taken per session and per ticket, for anyone who can see the
-- offering (bookings themselves stay private).
create or replace function public.session_counts(
  p_offering_id uuid,
  p_from date,
  p_to date
)
returns table (session_date date, ticket_type_id uuid, taken bigint)
language sql
stable
security definer
set search_path = ''
as $$
  select r.session_date, r.ticket_type_id, count(*)
  from public.registrations r
  where r.offering_id = p_offering_id
    and r.session_date between p_from and p_to
    and public.can_view_offering(p_offering_id)
  group by r.session_date, r.ticket_type_id;
$$;
grant execute on function public.session_counts(uuid, date, date) to anon, authenticated;
