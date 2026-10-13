-- Two stewardship pipelines: Application (lead to lot chosen) and Purchase
-- (Marat intro to due diligence). Choosing a lot moves the person into Purchase.

alter table public.contacts
  add column tags text[] not null default '{}',
  add column visit_date date,
  add column tafo_choice text;

alter table public.contact_stages drop constraint contact_stages_pipeline_check;
alter table public.contact_stages drop constraint contact_stages_check;
alter table public.pipeline_assignments drop constraint pipeline_assignments_pipeline_check;

alter table public.contact_stages add constraint contact_stages_check check (
  (pipeline = 'memberships' and stage in (
    'waitlist', 'invited', 'applied', 'screening', 'approved', 'active'
  ))
  or (pipeline = 'estate' and stage in (
    'lead', 'qualified', 'visit', 'offer', 'reserved', 'contract', 'closed'
  ))
  or (pipeline = 'stewardship_application' and stage in (
    'lead', 'applying', 'call_booked', 'visit_planning', 'visited', 'lot_chosen'
  ))
  or (pipeline = 'stewardship_purchase' and stage in (
    'marat_intro', 'marat_review', 'kyc', 'agreements_out', 'due_diligence'
  ))
);
alter table public.contact_stages add constraint contact_stages_pipeline_check
  check (pipeline in ('memberships', 'estate', 'stewardship_application', 'stewardship_purchase'));
alter table public.pipeline_assignments add constraint pipeline_assignments_pipeline_check
  check (pipeline in ('memberships', 'estate', 'stewardship_application', 'stewardship_purchase'));

-- Lot Chosen hands the person to the Purchase pipeline (never moves them back).
create or replace function public.stewardship_lot_chosen()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.pipeline = 'stewardship_application' and new.stage = 'lot_chosen' then
    insert into public.contact_stages (contact_id, pipeline, stage)
    values (new.contact_id, 'stewardship_purchase', 'marat_intro')
    on conflict (contact_id, pipeline) do nothing;
  end if;
  return new;
end;
$$;
create trigger contact_stages_lot_chosen
  after insert or update of stage on public.contact_stages
  for each row execute function public.stewardship_lot_chosen();
