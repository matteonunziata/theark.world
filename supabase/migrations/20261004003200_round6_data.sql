-- Round 6 data: the real lot inventory and the member class schedule.

-- Sample lots used codes that are now real lots (12 is part of Tanit
-- Estate). Remove them with their households, logs and stays.
delete from public.lots l
using public.sample_records s
where s.table_name = 'lots' and s.record_id = l.id::text;
delete from public.sample_records s
where s.table_name = 'lots'
  and not exists (select 1 from public.lots l where l.id::text = s.record_id);

-- Every lot on the map (1–4 and 9–93). Prices in USD; anything not in the
-- inventory is sold.
insert into public.lots
  (code, name, kind, features, status, size_m2, price, home_status, home_name)
values
  ('1', null, 'lot', null, 'sold', null, null, 'none', null),
  ('2', null, 'lot', null, 'sold', null, null, 'none', null),
  ('3', null, 'lot', null, 'sold', null, null, 'none', null),
  ('4', 'Mountain House', 'lot', 'Valley & Mountain View', 'available', null, 899000, 'built', 'Mountain House'),
  ('9', 'Casa Trinidad', 'lot', 'Ocean Horizon & Jungle', 'available', null, 1500000, 'built', 'Casa Trinidad'),
  ('10', 'Tanit Estate', 'estate', 'Estate Grounds & Ocean View. Lots 10, 11 and 12 together.', 'available', null, 4500000, 'built', 'Tanit Estate'),
  ('11', null, 'estate', 'Part of Tanit Estate', 'available', null, null, 'built', null),
  ('12', null, 'estate', 'Part of Tanit Estate', 'available', null, null, 'built', null),
  ('13', null, 'lot', null, 'sold', null, null, 'none', null),
  ('14', null, 'lot', null, 'sold', null, null, 'none', null),
  ('15', null, 'lot', null, 'sold', null, null, 'none', null),
  ('16', null, 'lot', null, 'sold', null, null, 'none', null),
  ('17', null, 'lot', null, 'sold', null, null, 'none', null),
  ('18', null, 'lot', null, 'sold', null, null, 'none', null),
  ('19', null, 'lot', null, 'sold', null, null, 'none', null),
  ('20', null, 'lot', null, 'sold', null, null, 'none', null),
  ('21', null, 'lot', null, 'sold', null, null, 'none', null),
  ('22', null, 'lot', null, 'sold', null, null, 'none', null),
  ('23', null, 'lot', null, 'available', 5000, 696530, 'none', null),
  ('24', null, 'lot', null, 'sold', null, null, 'none', null),
  ('25', null, 'lot', null, 'sold', null, null, 'none', null),
  ('26', null, 'lot', null, 'available', 5000, 372300, 'none', null),
  ('27', null, 'lot', null, 'available', 5000, 427050, 'none', null),
  ('28', null, 'lot', null, 'available', 5000, 372300, 'none', null),
  ('29', null, 'lot', null, 'available', 5000, 372300, 'none', null),
  ('30', null, 'lot', null, 'available', 5000, 448950, 'none', null),
  ('31', null, 'lot', null, 'available', 5000, 481800, 'none', null),
  ('32', null, 'lot', null, 'sold', null, null, 'none', null),
  ('33', null, 'lot', null, 'available', 5000, 427050, 'none', null),
  ('34', null, 'lot', null, 'available', 5000, 427050, 'none', null),
  ('35', null, 'lot', null, 'sold', null, null, 'none', null),
  ('36', null, 'lot', null, 'available', 5000, 427050, 'none', null),
  ('37', null, 'lot', null, 'available', 5000, 427050, 'none', null),
  ('38', null, 'lot', null, 'available', 5000, 372300, 'none', null),
  ('39', null, 'lot', null, 'available', 5000, 372300, 'none', null),
  ('40', null, 'lot', null, 'available', 5955, 443475, 'none', null),
  ('41', null, 'lot', null, 'available', 5000, 427050, 'none', null),
  ('42', null, 'lot', null, 'sold', null, null, 'none', null),
  ('43', null, 'lot', null, 'available', 5000, 481800, 'none', null),
  ('44', null, 'lot', null, 'available', 5000, 372300, 'none', null),
  ('45', 'Fractional Ownership', 'fractional', 'Resort Estate Share ($24.9k/share)', 'available', null, 24900, 'none', null),
  ('46', null, 'lot', null, 'sold', null, null, 'none', null),
  ('47', null, 'lot', null, 'sold', null, null, 'none', null),
  ('48', null, 'lot', null, 'available', 5000, 427050, 'none', null),
  ('49', null, 'lot', null, 'available', 5000, 427050, 'none', null),
  ('50', null, 'lot', null, 'sold', null, null, 'none', null),
  ('51', null, 'lot', null, 'available', 5000, 481800, 'none', null),
  ('52', null, 'lot', null, 'available', 5888, 563925, 'none', null),
  ('53', null, 'lot', null, 'available', 5000, 481800, 'none', null),
  ('54', null, 'lot', null, 'available', 6029, 575970, 'none', null),
  ('55', null, 'lot', null, 'available', 5000, 481800, 'none', null),
  ('56', null, 'lot', null, 'sold', null, null, 'none', null),
  ('57', null, 'lot', null, 'sold', null, null, 'none', null),
  ('58', null, 'lot', null, 'sold', null, null, 'none', null),
  ('59', null, 'lot', null, 'sold', null, null, 'none', null),
  ('60', null, 'lot', null, 'sold', null, null, 'none', null),
  ('61', null, 'lot', null, 'sold', null, null, 'none', null),
  ('62', null, 'lot', null, 'sold', null, null, 'none', null),
  ('63', null, 'lot', null, 'available', 5000, 481800, 'none', null),
  ('64', null, 'lot', null, 'sold', null, null, 'none', null),
  ('65', null, 'lot', null, 'sold', null, null, 'none', null),
  ('66', null, 'lot', null, 'sold', null, null, 'none', null),
  ('67', null, 'lot', null, 'available', 6095, 405150, 'none', null),
  ('68', null, 'lot', null, 'sold', null, null, 'none', null),
  ('69', null, 'lot', null, 'sold', null, null, 'none', null),
  ('70', null, 'lot', null, 'sold', null, null, 'none', null),
  ('71', null, 'lot', null, 'sold', null, null, 'none', null),
  ('72', null, 'lot', null, 'available', 5953, 705180, 'none', null),
  ('73', null, 'lot', null, 'sold', null, null, 'none', null),
  ('74', null, 'lot', null, 'sold', null, null, 'none', null),
  ('75', null, 'lot', null, 'sold', null, null, 'none', null),
  ('76', null, 'lot', null, 'available', 5006, 481800, 'none', null),
  ('77', null, 'lot', null, 'sold', null, null, 'none', null),
  ('78', null, 'lot', null, 'available', 5000, 481800, 'none', null),
  ('79', null, 'lot', null, 'available', 5000, 427050, 'none', null),
  ('80', null, 'lot', null, 'available', 5000, 536550, 'none', null),
  ('81', null, 'lot', null, 'sold', null, null, 'none', null),
  ('82', null, 'lot', null, 'sold', null, null, 'built', null),
  ('83', null, 'lot', null, 'available', 5000, 372300, 'none', null),
  ('84', null, 'lot', null, 'available', 5000, 481800, 'none', null),
  ('85', null, 'lot', null, 'available', 5000, 427050, 'none', null),
  ('86', null, 'lot', null, 'available', 5000, 427050, 'none', null),
  ('87', null, 'lot', null, 'available', 5000, 372300, 'none', null),
  ('88', null, 'lot', null, 'available', 5000, 481800, 'none', null),
  ('89', null, 'lot', null, 'available', 5000, 481800, 'none', null),
  ('90', null, 'lot', null, 'available', 5000, 536550, 'none', null),
  ('91', null, 'lot', null, 'available', 5000, 536550, 'none', null),
  ('92', null, 'lot', null, 'available', 5000, 536550, 'none', null),
  ('93', null, 'lot', null, 'available', 5000, 536550, 'none', null)
on conflict (code) do nothing;

update public.lots l set estate_lot_id = e.id
from public.lots e
where e.code = '10' and l.code in ('11', '12');

-- Team: the guard is security, and the schedule's facilitators.
update public.team_members set type = 'security' where role = 'security';

-- Security staff only ever get the security role.
alter table public.team_members add constraint team_members_security_role
  check (type <> 'security' or role = 'security');

insert into public.team_members (name, title, type, role)
select v.name, v.title, 'facilitator', 'facilitator'
from (values
  ('Jordan', 'Muay Thai'),
  ('Jonathan', 'Movement'),
  ('Stephanie', 'Strength'),
  ('Alejandro', 'Padel & pickleball')
) as v (name, title)
where not exists (select 1 from public.team_members t where t.name = v.name);

-- The member class schedule replaces the sample classes and events.
delete from public.offerings o
using public.sample_records s
where s.table_name = 'offerings' and s.record_id = o.id::text;
delete from public.sample_records s
where s.table_name in ('offerings', 'ticket_types', 'registrations')
  and not exists (select 1 from public.offerings o where o.id::text = s.record_id)
  and not exists (select 1 from public.ticket_types t where t.id::text = s.record_id)
  and not exists (select 1 from public.registrations r where r.id::text = s.record_id);
delete from public.offerings where title = 'test';

insert into public.offerings
  (kind, title, description, facilitator_id, location, repeat, start_date,
   days, start_time, end_time, access, status, city_id)
select 'class', v.title, v.description,
  (select id from public.team_members t where t.name = v.who limit 1),
  v.location, 'weekly', date '2026-09-28', v.days, v.st::time, v.et::time,
  'members', 'published',
  (select id from public.cities where is_home limit 1)
from (values
  ('Muay Thai', null, 'Jordan', 'The Shala', '{1,3}'::smallint[], '08:00', '09:00'),
  ('Movement Class', null, 'Jonathan', 'The Shala', '{2,4}'::smallint[], '09:00', '10:00'),
  ('Strength', null, 'Stephanie', 'The Shala', '{3,5}'::smallint[], '09:30', '10:30'),
  ('Breakfast', null, null, 'La Cocineta', '{1,2,3,4,5}'::smallint[], '09:00', '10:00'),
  ('Lunch', null, null, 'La Cocineta', '{1,2,3,4,5}'::smallint[], '13:00', '14:00'),
  ('Padel: Adults', null, 'Alejandro', 'The Courts', '{1}'::smallint[], '15:00', '16:00'),
  ('Pickleball: Adults', null, 'Alejandro', 'The Courts', '{2}'::smallint[], '15:00', '16:00'),
  ('Gene Keys: Your Genius Path', null, 'Marat Omarov', 'The Ark House', '{4}'::smallint[], '16:00', '17:30'),
  ('Founder Circle', null, 'Matteo Nunziata', 'The Ark House', '{3}'::smallint[], '17:00', '19:00'),
  ('Women/Men Circle', 'Rotating every two weeks: a women’s circle one week, a men’s circle the next.', null, 'The Shala', '{2}'::smallint[], '18:00', '20:00'),
  ('Farm Volunteer Day', 'A morning working the land together.', null, 'The Farm', '{6}'::smallint[], '09:00', '12:00')
) as v (title, description, who, location, days, st, et);
