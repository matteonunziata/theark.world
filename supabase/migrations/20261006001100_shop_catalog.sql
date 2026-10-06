-- The Farm shop inside the member portal. The catalog is the products synced
-- from thearkfarm.shop (Shopify); products is staff-only, so members read it
-- through this function, which returns only what's for sale online and only to
-- portal members and shop staff. Nothing about stock counts or costs leaves.

create or replace function public.shop_catalog()
returns table (
  external_id text,
  name text,
  product_group text,
  variant text,
  category text,
  price numeric,
  image_url text,
  description text,
  web_url text
)
language sql
stable
security definer
set search_path = ''
as $$
  select p.external_id, p.name, coalesce(p.product_group, p.name), p.variant, p.category,
         p.price, p.image_url, p.description, p.web_url
  from public.products p
  where p.active and p.online is true and p.external_id is not null
    and (public.is_portal_member(public.current_member_contact_id())
         or public.has_role('admin', 'lead', 'shop'))
  order by p.category, 3, p.price;
$$;

revoke all on function public.shop_catalog() from public, anon;
grant execute on function public.shop_catalog() to authenticated;
