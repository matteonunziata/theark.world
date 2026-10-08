-- Cleaning becomes a schedule: a team roster with hourly rates, and tasks with a person, start time and length.

create table public.cleaning_staff (
  id uuid primary key default gen_random_uuid(),
  name text not null unique check (length(trim(name)) > 0),
  hourly_rate numeric(12, 2) check (hourly_rate >= 0),
  currency text not null default 'CRC' check (currency in ('CRC', 'USD')),
  color text not null default '#4a63b0',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger cleaning_staff_updated_at before update on public.cleaning_staff
  for each row execute function public.set_updated_at();
alter table public.cleaning_staff enable row level security;
create policy "Estate staff" on public.cleaning_staff
  for all to authenticated
  using (public.is_estate_staff()) with check (public.is_estate_staff());

insert into public.cleaning_staff (name, color) values
  ('Regi', '#3f8a4f'), ('Rosi', '#4a63b0'), ('Daniela', '#b23a48'), ('Erika', '#c26b1f');

alter table public.cleaning_tasks
  add column staff_id uuid references public.cleaning_staff (id) on delete set null,
  add column start_time time,
  add column hours numeric(4, 2) check (hours > 0 and hours <= 24),
  drop column assignee,
  drop column time_slot;

-- Reload the schedule with times and lengths read off the team's sheet
-- (7:00 start, breakfast 9:00, lunch 13:00 to 14:00, out at 15:00 or 18:00).
delete from public.cleaning_tasks;
insert into public.cleaning_tasks (area, task, days, staff_id, start_time, hours, position) values
('Arkadia','Arkadia',array[0,2]::smallint[],(select id from public.cleaning_staff where name='Regi'),'07:00',1.5,0),
('Gym','Gym',array[0]::smallint[],(select id from public.cleaning_staff where name='Regi'),'08:30',0.5,1),
('Beehive','Beehive',array[0]::smallint[],(select id from public.cleaning_staff where name='Regi'),'09:30',2,2),
('Deck','Deck y baños',array[0]::smallint[],(select id from public.cleaning_staff where name='Regi'),'11:30',1.5,3),
('Laundry','Lavandería',array[0]::smallint[],(select id from public.cleaning_staff where name='Regi'),'14:00',1.0,4),
('The Ark House','The Ark House',array[1,3,4]::smallint[],(select id from public.cleaning_staff where name='Regi'),'07:00',2.0,5),
('Beehive','Beehive chequeo general',array[1]::smallint[],(select id from public.cleaning_staff where name='Regi'),'09:30',3.0,6),
('Baños','Baños',array[1]::smallint[],(select id from public.cleaning_staff where name='Regi'),'12:30',0.5,7),
('Beehive','Cerrar beehives',array[1]::smallint[],(select id from public.cleaning_staff where name='Regi'),'14:00',1.0,8),
('Basurero','Basurero',array[2]::smallint[],(select id from public.cleaning_staff where name='Regi'),'08:30',0.5,10),
('La Sierra','La Sierra - Trailer',array[2]::smallint[],(select id from public.cleaning_staff where name='Regi'),'09:30',3.5,11),
('The Ark House','Repaso Ark House',array[2,3]::smallint[],(select id from public.cleaning_staff where name='Regi'),'14:00',1.0,12),
('Beehive','Beehive y deck',array[3]::smallint[],(select id from public.cleaning_staff where name='Regi'),'09:30',3.0,14),
('Baños','Baños, repaso',array[3,4]::smallint[],(select id from public.cleaning_staff where name='Regi'),'12:30',0.5,15),
('Cocina','Cocineta, bodegas',array[4]::smallint[],(select id from public.cleaning_staff where name='Regi'),'09:30',3.0,18),
('Contenedor','Contenedor limpieza profunda',array[4]::smallint[],(select id from public.cleaning_staff where name='Regi'),'14:00',1.0,20),
('The Ark House','The Ark House limpieza profunda',array[5]::smallint[],(select id from public.cleaning_staff where name='Regi'),'07:00',2.0,21),
('Cocina','Cocina limpieza profunda y baños, prender aire del container',array[5]::smallint[],(select id from public.cleaning_staff where name='Regi'),'09:30',3.5,22),
('The Shala','The Shala limpieza profunda',array[5]::smallint[],(select id from public.cleaning_staff where name='Regi'),'14:00',1.0,23),
('The Ark House','The Ark House',array[0,2]::smallint[],(select id from public.cleaning_staff where name='Rosi'),'07:00',2.0,24),
('The Shala','Shala, general',array[0]::smallint[],(select id from public.cleaning_staff where name='Rosi'),'09:30',1.0,25),
('Padel','Paletas de padel',array[0]::smallint[],(select id from public.cleaning_staff where name='Rosi'),'10:30',2.0,26),
('Cocina','Cocina repaso',array[0]::smallint[],(select id from public.cleaning_staff where name='Rosi'),'12:30',0.5,27),
('Baños','Baños y chequear deck',array[0]::smallint[],(select id from public.cleaning_staff where name='Rosi'),'14:00',1.0,28),
('Arkadia','Arkadia',array[1,3,4]::smallint[],(select id from public.cleaning_staff where name='Rosi'),'07:00',1.5,29),
('Gym','Gym',array[1,3]::smallint[],(select id from public.cleaning_staff where name='Rosi'),'08:30',0.5,30),
('The Shala','Shala general, limpieza pesas y deck',array[1,3]::smallint[],(select id from public.cleaning_staff where name='Rosi'),'09:30',3.0,31),
('Cocina','Cocina',array[1,2,3]::smallint[],(select id from public.cleaning_staff where name='Rosi'),'14:00',1.0,32),
('Deck','Deck limpieza profunda',array[2,4]::smallint[],(select id from public.cleaning_staff where name='Rosi'),'09:30',2.5,34),
('Cocina','Cocina repaso',array[2]::smallint[],(select id from public.cleaning_staff where name='Rosi'),'12:00',0.5,35),
('Cocina','Cocina',array[3]::smallint[],(select id from public.cleaning_staff where name='Rosi'),'12:30',0.5,40),
('Baños','Baños',array[4]::smallint[],(select id from public.cleaning_staff where name='Rosi'),'08:30',0.5,43),
('The Ark House','Repaso Ark House',array[4]::smallint[],(select id from public.cleaning_staff where name='Rosi'),'14:00',1.0,45),
('The Ark House','The Ark House limpieza profunda',array[5]::smallint[],(select id from public.cleaning_staff where name='Rosi'),'07:00',2.0,46),
('Cocina','Cocina limpieza profunda, baños',array[5]::smallint[],(select id from public.cleaning_staff where name='Rosi'),'09:30',3.0,47),
('Deck','Deck, repaso',array[5]::smallint[],(select id from public.cleaning_staff where name='Rosi'),'12:30',0.5,48),
('The Shala','The Shala limpieza profunda',array[5]::smallint[],(select id from public.cleaning_staff where name='Rosi'),'14:00',1.0,49),
('Contenedor','Contenedor AM',array[0,1,2,3,4]::smallint[],(select id from public.cleaning_staff where name='Daniela'),'07:00',1.5,50),
('Baños','Baños',array[0,1,2]::smallint[],(select id from public.cleaning_staff where name='Daniela'),'08:30',0.5,55),
('Beehive','Beehive',array[0]::smallint[],(select id from public.cleaning_staff where name='Daniela'),'09:30',2,58),
('Deck','Deck y baños',array[0]::smallint[],(select id from public.cleaning_staff where name='Daniela'),'11:30',1.5,59),
('Cocina','Cocina repaso',array[0]::smallint[],(select id from public.cleaning_staff where name='Daniela'),'14:00',1.0,60),
('Beehive','Beehive chequeo general',array[1]::smallint[],(select id from public.cleaning_staff where name='Daniela'),'09:30',3.0,61),
('Beehive','Beehive',array[2]::smallint[],(select id from public.cleaning_staff where name='Daniela'),'09:30',3.0,62),
('Baños','Repaso baños',array[2]::smallint[],(select id from public.cleaning_staff where name='Daniela'),'12:30',0.5,63),
('Baños','Repaso baños',array[2]::smallint[],(select id from public.cleaning_staff where name='Daniela'),'14:00',1.0,64),
('Beehive','Beehive y deck',array[3]::smallint[],(select id from public.cleaning_staff where name='Daniela'),'09:30',3.0,65),
('Reception','A disposición',array[3]::smallint[],(select id from public.cleaning_staff where name='Daniela'),'12:30',0.5,66),
('Baños','Repaso baños',array[3]::smallint[],(select id from public.cleaning_staff where name='Daniela'),'14:00',0.5,67),
('Reception','Recepción limpieza profunda',array[4]::smallint[],(select id from public.cleaning_staff where name='Daniela'),'09:30',3.0,68),
('Reception','A disposición',array[4]::smallint[],(select id from public.cleaning_staff where name='Daniela'),'12:30',0.5,69),
('Contenedor','Contenedor limpieza profunda',array[4]::smallint[],(select id from public.cleaning_staff where name='Daniela'),'14:00',1.0,70),
('Cocina','Baños, cocina',array[6]::smallint[],(select id from public.cleaning_staff where name='Daniela'),'07:00',1.5,71),
('Arkadia','Arkadia',array[6]::smallint[],(select id from public.cleaning_staff where name='Daniela'),'09:30',3.0,72),
('Baños','Baños repaso',array[6]::smallint[],(select id from public.cleaning_staff where name='Daniela'),'12:30',0.5,73),
('Extras','Extras',array[6]::smallint[],(select id from public.cleaning_staff where name='Daniela'),'14:00',1.0,74),
('Padel','Baños de padel y paletas',array[0]::smallint[],(select id from public.cleaning_staff where name='Erika'),'10:00',2.5,75),
('Gym','Gym',array[0,2,3,4]::smallint[],(select id from public.cleaning_staff where name='Erika'),'12:30',0.5,76),
('Arkadia','Arkadia',array[0,1,2,3,4]::smallint[],(select id from public.cleaning_staff where name='Erika'),'14:00',4.0,77),
('Padel','Baños de padel y limpiar paletas',array[1]::smallint[],(select id from public.cleaning_staff where name='Erika'),'10:00',2.0,78),
('Deck','Deck',array[1]::smallint[],(select id from public.cleaning_staff where name='Erika'),'12:00',1.0,79),
('Padel','Baños de padel y raquetas',array[2,3,4]::smallint[],(select id from public.cleaning_staff where name='Erika'),'10:00',2.5,81),
('Deck','Deck y gym',array[6]::smallint[],(select id from public.cleaning_staff where name='Erika'),'07:00',2.0,90),
('Arkadia','Arkadia',array[6]::smallint[],(select id from public.cleaning_staff where name='Erika'),'09:30',3.0,91),
('Padel','Baños padel',array[6]::smallint[],(select id from public.cleaning_staff where name='Erika'),'12:30',0.5,92),
('Extras','Extras',array[6]::smallint[],(select id from public.cleaning_staff where name='Erika'),'14:00',1.0,93);
