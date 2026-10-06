-- The sign-in form asks this before any email goes out, so the rules hold
-- even before the before-user-created hook is switched on in Supabase, and
-- without the service-role key. Returns null when the email may sign in,
-- otherwise the reason to show. It says no more than the sign-in form does.
create or replace function public.sign_in_check(p_email text)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select case
    when lower(trim(coalesce(p_email, ''))) !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$'
      then 'Enter a valid email.'
    when exists (
      select 1 from public.team_members t
      where lower(t.email::text) = lower(trim(p_email)) and t.status = 'active'
    ) or exists (
      select 1 from public.contacts c
      where lower(c.email::text) = lower(trim(p_email))
        and c.tier is not null and c.membership_status = 'active'
    ) then null
    when public.is_ark_email(lower(trim(p_email)))
      then 'You haven’t been added to ARK OS yet. Ask an admin to add you in Settings, Team.'
    else 'We couldn’t find that email on the team or on an active membership. Write to us and we’ll sort it out.'
  end;
$$;

revoke all on function public.sign_in_check(text) from public;
grant execute on function public.sign_in_check(text) to anon, authenticated;
