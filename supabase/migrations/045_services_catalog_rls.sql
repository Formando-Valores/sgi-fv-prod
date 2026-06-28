-- RLS policies for services_catalog admin CRUD

-- Admins can insert services
DROP POLICY IF EXISTS "Admins can insert services" ON public.services_catalog;
CREATE POLICY "Admins can insert services"
  ON public.services_catalog FOR INSERT
  WITH CHECK (
    exists (
      select 1 from public.org_members om
      join public.organizations o on o.id = om.org_id
      where om.user_id = auth.uid()
        and om.role in ('admin', 'owner')
        and o.slug = 'default'
    )
  );

-- Admins can update services
DROP POLICY IF EXISTS "Admins can update services" ON public.services_catalog;
CREATE POLICY "Admins can update services"
  ON public.services_catalog FOR UPDATE
  USING (
    exists (
      select 1 from public.org_members om
      join public.organizations o on o.id = om.org_id
      where om.user_id = auth.uid()
        and om.role in ('admin', 'owner')
        and o.slug = 'default'
    )
  );

-- Admins can delete services
DROP POLICY IF EXISTS "Admins can delete services" ON public.services_catalog;
CREATE POLICY "Admins can delete services"
  ON public.services_catalog FOR DELETE
  USING (
    exists (
      select 1 from public.org_members om
      join public.organizations o on o.id = om.org_id
      where om.user_id = auth.uid()
        and om.role in ('admin', 'owner')
        and o.slug = 'default'
    )
  );