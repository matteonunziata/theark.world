-- Which rate the signed-in member pays (rack or friends & family).
create or replace function public.my_rate()
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select rate from public.contacts where id = public.current_member_contact_id();
$$;
revoke execute on function public.my_rate() from anon, public;
grant execute on function public.my_rate() to authenticated;
