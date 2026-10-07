-- Finance can be viewed in colones or dollars. The toggle converts at one
-- rate kept here: colones per US dollar. Edited in Settings > Organization.

alter table public.org_settings
  add column usd_crc_rate numeric(10, 2) not null default 500
  check (usd_crc_rate > 0);
