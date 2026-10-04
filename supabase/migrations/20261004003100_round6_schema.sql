-- Round 6: security as a team type, call steps in workflows, and lot
-- details for the real inventory (estates, fractional shares, views).

alter table public.team_members drop constraint team_members_type_check;
alter table public.team_members add constraint team_members_type_check
  check (type in ('team', 'facilitator', 'crew', 'contractor', 'security'));

alter table public.sequence_steps drop constraint sequence_steps_channel_check;
alter table public.sequence_steps add constraint sequence_steps_channel_check
  check (channel in ('email', 'whatsapp', 'call'));

alter table public.lots
  add column kind text not null default 'lot'
    check (kind in ('lot', 'estate', 'fractional')),
  -- "Valley & Mountain View", "Resort Estate Share ($24.9k/share)"
  add column features text,
  -- Lots sold together as one estate point at the estate's main lot.
  add column estate_lot_id uuid references public.lots (id) on delete set null,
  add constraint lots_estate_not_self check (estate_lot_id is null or estate_lot_id <> id);

create index lots_estate_idx on public.lots (estate_lot_id);
