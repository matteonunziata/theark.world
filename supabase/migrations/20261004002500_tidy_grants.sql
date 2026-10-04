-- Helpers used inside other functions; signed-out visitors don't need them.
revoke execute on function public.is_estate_staff() from anon, public;
revoke execute on function public.can_work_gate() from anon, public;
revoke execute on function public.org_now() from anon, public;
grant execute on function public.org_now() to authenticated;
