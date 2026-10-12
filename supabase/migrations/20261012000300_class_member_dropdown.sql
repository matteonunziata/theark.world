-- Let the class "Add a member" control list every active member (a dropdown),
-- not only name matches of two letters or more. A query still narrows the list.
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
    and c.type = 'member'
    and c.membership_status = 'active'
    and (
      length(trim(coalesce(p_query, ''))) = 0
      or c.name ilike '%' || replace(replace(trim(p_query), '%', ''), '_', '') || '%'
    )
    and not exists (
      select 1 from public.registrations r
      where r.offering_id = p_offering_id and r.session_date = p_date
        and r.contact_id = c.id and public.registration_live(r)
    )
  order by lower(c.name)
  limit 1000;
$$;
revoke execute on function public.search_members_for_class(uuid, date, text) from anon, public;
grant execute on function public.search_members_for_class(uuid, date, text) to authenticated;
