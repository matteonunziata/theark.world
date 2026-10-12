-- Community managers get the same data access as division leads, so the pages
-- they can open (Dashboard, CRM, Memberships, Schedule, Operations) have data.
-- Policies that name 'lead' now also admit 'community_manager'.

create or replace function public.has_role(variadic roles text[])
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    public.staff_role() = any (roles)
    or (public.staff_role() = 'community_manager' and 'lead' = any (roles)),
    false
  );
$$;
