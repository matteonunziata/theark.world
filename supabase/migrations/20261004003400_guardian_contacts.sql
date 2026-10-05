-- Arkadia family members can be linked to a CRM contact. School staff can
-- search contacts (name, email, phone only) and add a family member who is
-- either an existing contact or a new one, without wider CRM access.

alter table public.student_guardians
  add column contact_id uuid references public.contacts (id) on delete set null;
create index student_guardians_contact_idx on public.student_guardians (contact_id);

create or replace function public.school_contact_search(q text)
returns table (id uuid, name text, email text, phone text)
language sql
stable
security definer
set search_path = ''
as $$
  select c.id, c.name, c.email::text, c.phone
  from public.contacts c
  where public.is_school_staff()
    and length(trim(q)) >= 2
    and (c.name ilike '%' || trim(q) || '%'
      or c.email::text ilike '%' || trim(q) || '%'
      or c.phone ilike '%' || trim(q) || '%')
  order by c.name
  limit 8;
$$;

-- Add a family member. With p_contact_id, link that contact; otherwise
-- reuse a contact with the same email, or create one in the CRM.
create or replace function public.school_add_guardian(
  p_student_id uuid,
  p_contact_id uuid,
  p_name text,
  p_relation text,
  p_email text,
  p_phone text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  cid uuid := p_contact_id;
  gid uuid;
  c record;
begin
  if not public.is_school_staff() then
    raise exception 'You don’t have access to Arkadia.';
  end if;
  if cid is not null then
    select name, email::text as email, phone into c from public.contacts where id = cid;
    if not found then raise exception 'That contact no longer exists.'; end if;
    p_name := coalesce(nullif(trim(p_name), ''), c.name);
    p_email := coalesce(nullif(trim(p_email), ''), c.email);
    p_phone := coalesce(nullif(trim(p_phone), ''), c.phone);
  else
    if coalesce(trim(p_name), '') = '' then raise exception 'Enter a name.'; end if;
    if nullif(trim(p_email), '') is not null then
      select id into cid from public.contacts where email = trim(p_email)::extensions.citext limit 1;
    end if;
    if cid is null then
      insert into public.contacts (name, email, phone, source, created_by, show_in_directory, open_to_connect)
      values (trim(p_name), nullif(trim(p_email), ''), nullif(trim(p_phone), ''), 'Arkadia family',
        public.current_staff_id(), false, false)
      returning id into cid;
    end if;
  end if;
  insert into public.student_guardians (student_id, contact_id, name, relation, email, phone)
  values (p_student_id, cid, trim(p_name), nullif(trim(p_relation), ''),
    nullif(trim(p_email), ''), nullif(trim(p_phone), ''))
  returning id into gid;
  return gid;
end;
$$;

revoke all on function public.school_contact_search(text) from public, anon;
revoke all on function public.school_add_guardian(uuid, uuid, text, text, text, text) from public, anon;
grant execute on function public.school_contact_search(text) to authenticated;
grant execute on function public.school_add_guardian(uuid, uuid, text, text, text, text) to authenticated;
