-- Today's guests for the security console (host names only).
create or replace function public.todays_guests()
returns table (
  guest_name text,
  host_name text,
  token text,
  status text,
  used_at timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
  select g.guest_name, c.name, g.token, g.status, g.used_at
  from public.guest_passes g
  join public.contacts c on c.id = g.host_contact_id
  where g.visit_date = public.org_today() and g.status <> 'cancelled'
    and public.can_work_gate()
  order by g.guest_name;
$$;
revoke execute on function public.todays_guests() from anon, public;
grant execute on function public.todays_guests() to authenticated;
