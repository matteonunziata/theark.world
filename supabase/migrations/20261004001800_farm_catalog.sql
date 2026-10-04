-- Farm shop catalog: photos, sizes/flavours, and a link to the online shop
-- (thearkfarm.shop, on Shopify) so products can be synced from it.

alter table public.products
  add column image_path text,          -- uploaded here (products bucket)
  add column image_url text,           -- or hosted elsewhere (the online shop)
  add column product_group text,       -- e.g. "Farm Eggs" for "Farm Eggs · 30"
  add column variant text,             -- e.g. "30", "half liter / Herbal"
  add column track_stock boolean not null default true,
  add column online boolean,           -- available on the online shop
  add column web_url text,
  add column external_id text unique;  -- Shopify variant id

-- Products not being counted never raise a low-stock alert.
comment on column public.products.track_stock is
  'False until someone counts it; imported products start untracked.';

insert into storage.buckets (id, name, public)
values ('products', 'products', true)
on conflict (id) do nothing;

create policy "Shop staff upload product photos" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'products' and public.has_role('admin', 'shop'));
create policy "Shop staff replace product photos" on storage.objects
  for update to authenticated
  using (bucket_id = 'products' and public.has_role('admin', 'shop'));
create policy "Shop staff delete product photos" on storage.objects
  for delete to authenticated
  using (bucket_id = 'products' and public.has_role('admin', 'shop'));
