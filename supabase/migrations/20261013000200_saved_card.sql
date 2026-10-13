-- A member's saved card. The card itself lives at Stripe (set up through
-- Checkout in setup mode); we keep only the ids and what's safe to show:
-- brand, last four digits and expiry.
alter table public.contacts
  add column stripe_customer_id text,
  add column card_payment_method_id text,
  add column card_brand text,
  add column card_last4 text,
  add column card_exp_month int,
  add column card_exp_year int;

comment on column public.contacts.card_payment_method_id is
  'Stripe payment method saved through the portal. Never a card number.';

-- What the member sees about their own card.
create or replace function public.my_card()
returns table (brand text, last4 text, exp_month int, exp_year int)
language sql
stable
security definer
set search_path = ''
as $$
  select c.card_brand, c.card_last4, c.card_exp_month, c.card_exp_year
  from public.contacts c
  where c.id = public.current_member_contact_id()
    and c.card_payment_method_id is not null;
$$;
revoke execute on function public.my_card() from anon, public;
grant execute on function public.my_card() to authenticated;
