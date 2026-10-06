-- Team members get the Annual membership's benefits (user decision,
-- 2026-10-06): 20% off courts, events and the Farm shop, so member20 in Shopify.
update public.membership_tiers set court_discount = 20 where key = 'team';
