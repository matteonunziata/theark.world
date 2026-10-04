-- Sample feed posts are written "as" sample members. Admins can't post as
-- real members; this only accepts authors that are tracked sample contacts.
create or replace function public.insert_sample_posts(p_posts jsonb)
returns setof uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  p jsonb;
  new_id uuid;
begin
  if not public.has_role('admin') then
    raise exception 'Admins only.' using errcode = '42501';
  end if;
  for p in select * from jsonb_array_elements(p_posts) loop
    if (p ->> 'author_contact_id') is not null and not exists (
      select 1 from public.sample_records
      where table_name = 'contacts' and record_id = p ->> 'author_contact_id'
    ) then
      raise exception 'Sample posts can only come from sample members.' using errcode = '42501';
    end if;
    insert into public.posts (author_contact_id, author_staff_id, city_id, body)
    values (
      (p ->> 'author_contact_id')::uuid,
      case when p ->> 'author_contact_id' is null then public.current_staff_id() end,
      (p ->> 'city_id')::uuid,
      p ->> 'body'
    )
    returning id into new_id;
    insert into public.sample_records values ('posts', new_id::text);
    return next new_id;
  end loop;
end;
$$;
revoke execute on function public.insert_sample_posts(jsonb) from anon, public;
grant execute on function public.insert_sample_posts(jsonb) to authenticated;
