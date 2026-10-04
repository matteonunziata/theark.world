-- Members see bookings made for them by staff, not only ones they made.
drop policy "Read registrations" on public.registrations;
create policy "Read registrations" on public.registrations
  for select to authenticated using (
    public.has_role('admin', 'lead', 'sales')
    or public.is_facilitator_of(offering_id)
    or (public.has_role('security') and session_date = public.org_today())
    or user_id = (select auth.uid())
    or (contact_id is not null and contact_id = public.current_member_contact_id())
  );
