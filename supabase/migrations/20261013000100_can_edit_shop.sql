-- A per-person switch for editing farm shop products and stock, so people whose
-- role is something else (community manager, division lead) can be given it
-- without changing the rest of what they can do. Admin and Shop staff always can.

alter table public.team_members
  add column if not exists can_edit_shop boolean not null default false;

create or replace function public.can_edit_shop()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    (select role in ('admin', 'shop') or can_edit_shop
       from public.team_members
      where user_id = auth.uid() and status = 'active'),
    false
  );
$$;

drop policy if exists "Write products" on public.products;
create policy "Write products" on public.products
  for all to authenticated
  using (public.can_edit_shop())
  with check (public.can_edit_shop());

drop policy if exists "Record stock" on public.stock_movements;
create policy "Record stock" on public.stock_movements
  for insert to authenticated
  with check (public.can_edit_shop() and by_id = public.current_staff_id());

-- Stock levels are visible to anyone who can edit them.
drop policy if exists "Read stock" on public.stock_movements;
create policy "Read stock" on public.stock_movements
  for select to authenticated
  using (public.has_role('admin', 'lead', 'shop') or public.can_edit_shop());

drop policy if exists "Shop staff upload product photos" on storage.objects;
create policy "Shop staff upload product photos" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'products' and public.can_edit_shop());
drop policy if exists "Shop staff replace product photos" on storage.objects;
create policy "Shop staff replace product photos" on storage.objects
  for update to authenticated
  using (bucket_id = 'products' and public.can_edit_shop());
drop policy if exists "Shop staff delete product photos" on storage.objects;
create policy "Shop staff delete product photos" on storage.objects
  for delete to authenticated
  using (bucket_id = 'products' and public.can_edit_shop());

-- Tomas, Zoe and Susanne.
update public.team_members set can_edit_shop = true
 where email in ('tomas@theark.world', 'zoe@theark.world', 'susanne@theark.world');
