-- Where the event is, for the map and directions on the event page.
-- location stays the short place name ("La Cocineta"); location_address is the street address.
-- Empty means the page searches Maps for the name in Santa Teresa.
alter table public.offerings
  add column if not exists location_address text;
