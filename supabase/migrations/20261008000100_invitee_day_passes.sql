-- People named in the invite step of a membership application get their own
-- free day pass (source 'invite'), sent by email or WhatsApp.

alter table public.memberships drop constraint memberships_source_check;
alter table public.memberships add constraint memberships_source_check
  check (source in ('stripe', 'staff', 'team', 'import', 'application', 'invite'));
