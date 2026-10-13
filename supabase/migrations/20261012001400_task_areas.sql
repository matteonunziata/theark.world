-- The areas a task can be set in (the amenities list, renamed in the UI to "Area").
delete from public.amenities;
insert into public.amenities (name, category, position) values
  ('ARK House', 'other', 1),
  ('Space Deck', 'wellness', 2),
  ('Shala', 'wellness', 3),
  ('Cocineta', 'other', 4),
  ('Jungle Gym', 'play', 5),
  ('Farm', 'land', 6),
  ('Courts', 'play', 7),
  ('Arkadia', 'other', 8);
