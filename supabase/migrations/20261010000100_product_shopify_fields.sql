-- What the Shopify product pull keeps on each product, next to the fields the
-- shop team edits here. Shopify's own stock count is stored beside ARK OS's
-- count (stock) and never overwrites it.

alter table public.products
  add column sku text,
  add column barcode text,
  add column cost numeric(14, 2),
  add column shopify_status text check (shopify_status in ('ACTIVE', 'ARCHIVED', 'DRAFT')),
  add column shopify_stock numeric,
  add column shopify_product_id text,
  add column shopify_synced_at timestamptz;

create index products_sku_idx on public.products (sku) where sku is not null;
