-- Rows created by "Load sample data", so they can be removed cleanly.
create table public.sample_records (
  table_name text not null,
  record_id text not null,
  primary key (table_name, record_id)
);
alter table public.sample_records enable row level security;
create policy "Admins only" on public.sample_records
  for all to authenticated
  using (public.has_role('admin')) with check (public.has_role('admin'));
