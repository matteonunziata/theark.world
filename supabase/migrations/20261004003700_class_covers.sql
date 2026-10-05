-- Photos for the member class schedule. The files ship with the site in
-- public/classes/, so cover_path holds a site path rather than a bucket path
-- (coverUrl() passes paths starting with "/" through). The Women/Men Circle
-- alternates weeks under one class, so it gets the Women Circle photo;
-- public/classes/men-circle.jpg is there if it's split into two classes.
-- Farm Volunteer Day has no photo yet.
update public.offerings o set cover_path = v.path
from (values
  ('Founder Circle', '/classes/founder-circle.jpg'),
  ('Women/Men Circle', '/classes/women-circle.jpg'),
  ('Pickleball: Adults', '/classes/pickleball.jpg'),
  ('Muay Thai', '/classes/muay-thai.jpg'),
  ('Breakfast', '/classes/breakfast.jpg'),
  ('Lunch', '/classes/lunch.jpg'),
  ('Padel: Adults', '/classes/padel.jpg'),
  ('Strength', '/classes/strength.jpg'),
  ('Gene Keys: Your Genius Path', '/classes/gene-keys.jpg'),
  ('Movement Class', '/classes/movement.jpg')
) as v (title, path)
where o.title = v.title and o.cover_path is null;
