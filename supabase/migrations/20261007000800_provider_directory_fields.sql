-- Provider directory: fields from the finance team's provider spreadsheet.

alter table public.providers
  add column country text,
  add column city text,
  add column tax_id text,
  add column address text,
  add column email text;

alter table public.provider_bank_accounts
  add column swift text,
  add column routing text,
  add column sinpe text,
  add column account_type text;

-- Some accounts hold both colones and dollars; one account in pesos.
alter table public.provider_bank_accounts
  drop constraint provider_bank_accounts_currency_check;
alter table public.provider_bank_accounts
  add constraint provider_bank_accounts_currency_check
  check (currency in ('CRC', 'USD', 'CRC/USD', 'MXN'));

-- Imports key on the name so a re-run doesn't duplicate providers.
create unique index providers_name_key on public.providers (lower(name));
