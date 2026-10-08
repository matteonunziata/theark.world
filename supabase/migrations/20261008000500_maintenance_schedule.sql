-- Maintenance gets its own schedule beside cleaning, on the same tables.
alter table public.cleaning_staff
  add column kind text not null default 'cleaning' check (kind in ('cleaning', 'maintenance'));
alter table public.cleaning_tasks
  add column kind text not null default 'cleaning' check (kind in ('cleaning', 'maintenance'));

alter table public.cleaning_staff drop constraint cleaning_staff_name_key;
alter table public.cleaning_staff add constraint cleaning_staff_kind_name_key unique (kind, name);
