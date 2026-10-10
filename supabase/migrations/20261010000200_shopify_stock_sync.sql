-- Two-way stock with Shopify (user decision, 2026-10-10): Shopify's quantity
-- at its one location is the master and ARK OS mirrors it. Stock changes made
-- here (a till sale, a delivery, a count) are pushed to Shopify as inventory
-- adjustments, once each; Shopify's sales come in through the order pull and
-- are never pushed back.

alter table public.stock_movements
  -- Made in ARK OS and not yet sent to Shopify. Only the shop screens set it.
  add column shopify_pending boolean not null default false;
create index stock_movements_pending_idx on public.stock_movements (product_id) where shopify_pending;

alter table public.products
  add column shopify_inventory_item_id text,
  add column shopify_tracked boolean;
