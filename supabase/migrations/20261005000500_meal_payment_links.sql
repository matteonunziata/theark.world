-- Members pay for breakfast and lunch through a payment link after booking.
-- Staff can change these links in Events → the class → Tickets.
insert into public.ticket_types (offering_id, name, payment_link, position)
select o.id, o.title, l.link, 0
from public.offerings o
join (values
  ('Breakfast', 'https://site.theark.world/payment-link/6aabe11a9f7ff2c808a761bd'),
  ('Lunch', 'https://site.theark.world/payment-link/6aabe11a9f7ff2c808a761bd')
) as l (title, link) on l.title = o.title
where o.kind = 'class'
  and not exists (select 1 from public.ticket_types t where t.offering_id = o.id);
