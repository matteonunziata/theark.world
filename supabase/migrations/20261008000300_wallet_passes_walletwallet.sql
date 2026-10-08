-- Wallet passes now come from WalletWallet: keep its serial and its install page.
-- The table was just created and is empty.

delete from public.wallet_passes;
alter table public.wallet_passes rename column pass2u_id to serial;
alter table public.wallet_passes add column share_url text not null;
