-- Images used in workflow emails. Public (emails load them), random names,
-- no listing. Staff who edit workflows upload them.
insert into storage.buckets (id, name, public)
values ('email', 'email', true)
on conflict (id) do nothing;

create policy "Workflow editors upload email images" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'email' and public.has_role('admin', 'sales'));
create policy "Workflow editors replace email images" on storage.objects
  for update to authenticated
  using (bucket_id = 'email' and public.has_role('admin', 'sales'));
create policy "Workflow editors delete email images" on storage.objects
  for delete to authenticated
  using (bucket_id = 'email' and public.has_role('admin', 'sales'));
