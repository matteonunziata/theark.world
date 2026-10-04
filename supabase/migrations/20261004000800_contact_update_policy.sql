-- Sales may edit contacts they can see through an assigned pipeline, not
-- only ones they own.
drop policy "Write contacts" on public.contacts;
create policy "Write contacts" on public.contacts
  for update to authenticated
  using (public.can_write_contact(id))
  with check (public.can_write_contact(id));
