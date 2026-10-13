-- Pipelines and their stages become data, so admins can rename, reorder, add
-- and delete them from the CRM. Stage keys never change (GHL tags and
-- contact_stages point at them); only labels and order do.

create table public.pipelines (
  key text primary key check (key ~ '^[a-z0-9_]+$'),
  name text not null check (length(trim(name)) > 0),
  position int not null default 0,
  created_at timestamptz not null default now()
);

create table public.pipeline_stages (
  pipeline text not null references public.pipelines (key) on delete cascade,
  key text not null check (key ~ '^[a-z0-9_]+$'),
  label text not null check (length(trim(label)) > 0),
  position int not null default 0,
  primary key (pipeline, key)
);

insert into public.pipelines (key, name, position) values
  ('memberships', 'Memberships', 0),
  ('estate', 'Real estate', 1),
  ('stewardship_application', 'Stewardship application', 2),
  ('stewardship_purchase', 'Stewardship purchase', 3);

insert into public.pipeline_stages (pipeline, key, label, position)
select p, k, l, row_number() over (partition by p order by o) - 1
from (values
  ('memberships', 'waitlist', 'Waitlist', 1),
  ('memberships', 'invited', 'Invited to apply', 2),
  ('memberships', 'applied', 'Applied', 3),
  ('memberships', 'screening', 'Screening', 4),
  ('memberships', 'approved', 'Approved', 5),
  ('memberships', 'active', 'Paid & active', 6),
  ('estate', 'lead', 'Lead', 1),
  ('estate', 'qualified', 'Qualified', 2),
  ('estate', 'visit', 'Site visit', 3),
  ('estate', 'offer', 'Offer', 4),
  ('estate', 'reserved', 'Reserved', 5),
  ('estate', 'contract', 'Contract', 6),
  ('estate', 'closed', 'Closed', 7),
  ('stewardship_application', 'lead', 'Lead', 1),
  ('stewardship_application', 'applying', 'Applying', 2),
  ('stewardship_application', 'call_booked', 'Call booked', 3),
  ('stewardship_application', 'visit_planning', 'Visit planning', 4),
  ('stewardship_application', 'visited', 'Visited', 5),
  ('stewardship_application', 'lot_chosen', 'Lot chosen', 6),
  ('stewardship_purchase', 'marat_intro', 'Marat intro', 1),
  ('stewardship_purchase', 'marat_review', 'Marat review', 2),
  ('stewardship_purchase', 'kyc', 'KYC', 3),
  ('stewardship_purchase', 'agreements_out', 'Agreements out', 4),
  ('stewardship_purchase', 'due_diligence', 'Due diligence', 5)
) as t (p, k, l, o);

-- The hardcoded lists give way to foreign keys.
alter table public.contact_stages drop constraint contact_stages_pipeline_check;
alter table public.contact_stages drop constraint contact_stages_check;
alter table public.pipeline_assignments drop constraint pipeline_assignments_pipeline_check;

alter table public.contact_stages add constraint contact_stages_stage_fkey
  foreign key (pipeline, stage) references public.pipeline_stages (pipeline, key)
  on update cascade on delete restrict;
alter table public.contact_stages add constraint contact_stages_pipeline_fkey
  foreign key (pipeline) references public.pipelines (key) on delete cascade;
alter table public.pipeline_assignments add constraint pipeline_assignments_pipeline_fkey
  foreign key (pipeline) references public.pipelines (key) on delete cascade;

alter table public.pipelines enable row level security;
alter table public.pipeline_stages enable row level security;

create policy "Staff read pipelines" on public.pipelines
  for select to authenticated using (public.staff_role() is not null);
create policy "Admins write pipelines" on public.pipelines
  for all to authenticated
  using (public.has_role('admin')) with check (public.has_role('admin'));
create policy "Staff read pipeline stages" on public.pipeline_stages
  for select to authenticated using (public.staff_role() is not null);
create policy "Admins write pipeline stages" on public.pipeline_stages
  for all to authenticated
  using (public.has_role('admin')) with check (public.has_role('admin'));

-- Lot Chosen still hands the person to the first Purchase stage, if both exist.
create or replace function public.stewardship_lot_chosen()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare first_stage text;
begin
  if new.pipeline = 'stewardship_application' and new.stage = 'lot_chosen' then
    select key into first_stage from public.pipeline_stages
      where pipeline = 'stewardship_purchase' order by position limit 1;
    if first_stage is not null then
      insert into public.contact_stages (contact_id, pipeline, stage)
      values (new.contact_id, 'stewardship_purchase', first_stage)
      on conflict (contact_id, pipeline) do nothing;
    end if;
  end if;
  return new;
end;
$$;

-- Save a pipeline and its stages in one go (admins only). p_stages is an
-- ordered array of {key, label}; keys of new stages are made by the caller. Stages left out
-- are deleted, and anyone in them moves to the first remaining stage (or off
-- the pipeline if none remain). Returns how many people moved or were dropped.
create or replace function public.save_pipeline(
  p_key text,
  p_name text,
  p_stages jsonb
)
returns int
language plpgsql
security definer
set search_path = ''
as $$
declare
  s jsonb;
  i int := 0;
  k text;
  kept text[] := '{}';
  first_key text;
  moved int := 0;
begin
  if not public.has_role('admin') then
    raise exception 'Only admins can edit pipelines.';
  end if;
  if length(trim(coalesce(p_name, ''))) = 0 then
    raise exception 'Give the pipeline a name.';
  end if;
  if jsonb_array_length(p_stages) = 0 then
    raise exception 'A pipeline needs at least one stage.';
  end if;

  insert into public.pipelines (key, name, position)
  values (p_key, trim(p_name),
          (select coalesce(max(position) + 1, 0) from public.pipelines))
  on conflict (key) do update set name = excluded.name;

  -- Park positions so reordering never collides, then upsert in order.
  for s in select * from jsonb_array_elements(p_stages) loop
    k := s ->> 'key';
    if length(trim(coalesce(s ->> 'label', ''))) = 0 then
      raise exception 'Every stage needs a name.';
    end if;
    insert into public.pipeline_stages (pipeline, key, label, position)
    values (p_key, k, trim(s ->> 'label'), i)
    on conflict (pipeline, key) do update
      set label = excluded.label, position = excluded.position;
    kept := kept || k;
    if i = 0 then first_key := k; end if;
    i := i + 1;
  end loop;

  -- People in removed stages move to the first remaining stage.
  with moved_rows as (
    update public.contact_stages
      set stage = first_key
      where pipeline = p_key and stage <> all (kept)
      returning 1
  )
  select count(*) into moved from moved_rows;

  delete from public.pipeline_stages
    where pipeline = p_key and key <> all (kept);

  return moved;
end;
$$;

revoke all on function public.save_pipeline(text, text, jsonb) from public, anon;
grant execute on function public.save_pipeline(text, text, jsonb) to authenticated;
