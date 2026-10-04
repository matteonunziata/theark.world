-- Members can't read contacts directly, so the "may I message them" check
-- runs as a definer function.
create or replace function public.can_message(recipient uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.current_member_contact_id() is not null
    and recipient <> public.current_member_contact_id()
    and exists (
      select 1 from public.contacts r
      where r.id = recipient and r.tier is not null
        and r.membership_status = 'active'
        and (r.open_to_connect or exists (
          select 1 from public.messages m
          where m.sender_id = recipient
            and m.recipient_id = public.current_member_contact_id()
        ))
    );
$$;
revoke execute on function public.can_message(uuid) from anon, public;
grant execute on function public.can_message(uuid) to authenticated;

drop policy "Members message members who are open to it" on public.messages;
create policy "Members message members who are open to it" on public.messages
  for insert to authenticated with check (
    sender_id = public.current_member_contact_id()
    and read_at is null
    and public.can_message(recipient_id)
  );

-- Names for the people in my conversations (members only see members).
create or replace function public.member_names(ids uuid[])
returns table (id uuid, name text, tier text)
language sql
stable
security definer
set search_path = ''
as $$
  select c.id, c.name, c.tier from public.contacts c
  where c.id = any (ids) and c.tier is not null
    and (public.is_member() or public.is_staff());
$$;
revoke execute on function public.member_names(uuid[]) from anon, public;
grant execute on function public.member_names(uuid[]) to authenticated;
