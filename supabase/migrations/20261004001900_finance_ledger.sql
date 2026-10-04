-- Finance ledger: business lines, every income and expense line (with its
-- receipt or invoice attached), and what's owed in either direction.
-- Admin only, enforced here.

create table public.business_lines (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(trim(name)) > 0),
  color text not null default 'slate'
    check (color in ('leaf', 'sea', 'sun', 'clay', 'plum', 'slate')),
  position int not null default 0,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

insert into public.business_lines (name, color, position) values
  ('Memberships', 'leaf', 0),
  ('Events & experiences', 'sun', 1),
  ('Farm shop', 'clay', 2),
  ('Arkadia', 'plum', 3),
  ('Food & beverage', 'sea', 4),
  ('Real estate', 'slate', 5),
  ('Other', 'slate', 6);

create table public.finance_entries (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('income', 'expense')),
  entry_date date not null default public.org_today(),
  business_line_id uuid references public.business_lines (id) on delete set null,
  category text,
  party text,                 -- customer or vendor
  description text,
  amount numeric(14, 2) not null check (amount > 0),
  currency text not null default 'CRC' check (currency in ('CRC', 'USD')),
  method text check (method in ('cash', 'card', 'transfer', 'sinpe', 'other')),
  reference text,             -- invoice or receipt number
  status text not null default 'paid' check (status in ('paid', 'unpaid')),
  due_date date,
  paid_on date,
  doc_kind text check (doc_kind in ('receipt', 'invoice', 'bill')),
  file_path text,             -- in the private finance bucket
  file_name text,
  created_by uuid references public.team_members (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index finance_entries_date_idx on public.finance_entries (entry_date desc);
create index finance_entries_open_idx on public.finance_entries (kind, due_date)
  where status = 'unpaid';

create or replace function public.finance_entries_before_write()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  if new.status = 'paid' and new.paid_on is null then
    new.paid_on = coalesce(
      case when tg_op = 'UPDATE' and old.status = 'unpaid' then public.org_today() end,
      new.entry_date
    );
  elsif new.status = 'unpaid' then
    new.paid_on = null;
  end if;
  return new;
end;
$$;
create trigger finance_entries_before_write
  before insert or update on public.finance_entries
  for each row execute function public.finance_entries_before_write();

alter table public.business_lines enable row level security;
alter table public.finance_entries enable row level security;

create policy "Admins only" on public.business_lines
  for all to authenticated
  using (public.has_role('admin')) with check (public.has_role('admin'));
create policy "Admins only" on public.finance_entries
  for all to authenticated
  using (public.has_role('admin')) with check (public.has_role('admin'));

-- Receipts and invoices: private, admins only (read included).
insert into storage.buckets (id, name, public)
values ('finance', 'finance', false)
on conflict (id) do nothing;

create policy "Admins read finance files" on storage.objects
  for select to authenticated
  using (bucket_id = 'finance' and public.has_role('admin'));
create policy "Admins upload finance files" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'finance' and public.has_role('admin'));
create policy "Admins replace finance files" on storage.objects
  for update to authenticated
  using (bucket_id = 'finance' and public.has_role('admin'));
create policy "Admins delete finance files" on storage.objects
  for delete to authenticated
  using (bucket_id = 'finance' and public.has_role('admin'));
