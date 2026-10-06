-- Shopify: the farm shop's online store. ARK OS pushes who is a member into
-- Shopify as customer tags (ark-member10, ark-member20); two discount codes
-- there, member10 and member20, are limited to the customer segments those
-- tags make up. A membership that ends loses its tag, so the code stops
-- working with it. Settings → Integrations → Shopify.
--
-- Same integrations table as GHL, Guesty and Slack; the token is admin-only
-- through RLS. Customers are linked on integration_links (external_id is the
-- Shopify customer id).

alter table public.integrations drop constraint if exists integrations_key_check;
alter table public.integrations add constraint integrations_key_check
  check (key in ('ghl', 'guesty', 'slack', 'shopify'));

alter table public.integrations
  -- yourstore.myshopify.com
  add column shop_domain text,
  -- Ids of what ARK OS made in Shopify: { "segments": { "member10": "gid://…" },
  -- "discounts": { "member10": "gid://…" } }
  add column settings jsonb not null default '{}'::jsonb;

insert into public.integrations (key, direction) values ('shopify', 'push')
on conflict (key) do nothing;
