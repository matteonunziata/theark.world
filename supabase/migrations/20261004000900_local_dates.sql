-- Use The ARK's local date (not UTC) for enrollment and send dates.
alter table public.enrollments alter column started_on set default public.org_today();
alter table public.enrollment_sends alter column sent_on set default public.org_today();
update public.enrollments set started_on = public.org_today()
where started_on > public.org_today();
