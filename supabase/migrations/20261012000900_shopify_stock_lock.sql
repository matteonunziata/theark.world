-- Shopify stock runs (nightly, Sync now, and one per Shopify stock webhook) must not
-- overlap, or two of them could each apply the same correction. A run takes this
-- lock for a minute; a second run waits for the next webhook retry.
alter table public.integrations add column if not exists stock_sync_lock timestamptz;
