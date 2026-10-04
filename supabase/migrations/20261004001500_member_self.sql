-- What a signed-in member can read and change about themselves.
create or replace function public.my_member_profile()
returns table (
  id uuid,
  name text,
  email text,
  tier text,
  membership_status text,
  member_since date,
  renews_on date,
  city_id uuid,
  bio text,
  interests text[],
  instagram text,
  open_to_connect boolean,
  show_in_directory boolean,
  discount_name text,
  discount_percent numeric
)
language sql
stable
security definer
set search_path = ''
as $$
  select c.id, c.name, c.email::text, c.tier, c.membership_status, c.member_since,
    c.renews_on, c.city_id, c.bio, c.interests, c.instagram, c.open_to_connect,
    c.show_in_directory, d.name, d.percent
  from public.contacts c
  left join public.discounts d on d.id = c.discount_id
  where c.id = public.current_member_contact_id();
$$;
revoke execute on function public.my_member_profile() from anon, public;
grant execute on function public.my_member_profile() to authenticated;

create or replace function public.set_my_city(p_city_id uuid)
returns void
language sql
security definer
set search_path = ''
as $$
  update public.contacts set city_id = p_city_id
  where id = public.current_member_contact_id();
$$;
revoke execute on function public.set_my_city(uuid) from anon, public;
grant execute on function public.set_my_city(uuid) to authenticated;
