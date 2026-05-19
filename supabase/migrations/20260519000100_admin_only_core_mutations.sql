create or replace function public.is_homescope_admin()
returns boolean
language sql
stable
as $$
  select coalesce(auth.jwt() -> 'app_metadata' ->> 'role', '') = 'admin';
$$;

revoke all on function public.is_homescope_admin() from public;
grant execute on function public.is_homescope_admin() to authenticated;

drop policy if exists "users can manage own neighborhoods" on public.neighborhoods;
drop policy if exists "users can read own neighborhoods" on public.neighborhoods;
drop policy if exists "admins can insert own neighborhoods" on public.neighborhoods;
drop policy if exists "admins can update own neighborhoods" on public.neighborhoods;
drop policy if exists "admins can delete own neighborhoods" on public.neighborhoods;

create policy "users can read own neighborhoods"
on public.neighborhoods for select
using (user_id = auth.uid());

create policy "admins can insert own neighborhoods"
on public.neighborhoods for insert
with check (user_id = auth.uid() and public.is_homescope_admin());

create policy "admins can update own neighborhoods"
on public.neighborhoods for update
using (user_id = auth.uid() and public.is_homescope_admin())
with check (user_id = auth.uid() and public.is_homescope_admin());

create policy "admins can delete own neighborhoods"
on public.neighborhoods for delete
using (user_id = auth.uid() and public.is_homescope_admin());

drop policy if exists "users can manage own apartments" on public.apartments;
drop policy if exists "users can read own apartments" on public.apartments;
drop policy if exists "admins can insert own apartments" on public.apartments;
drop policy if exists "admins can update own apartments" on public.apartments;
drop policy if exists "admins can delete own apartments" on public.apartments;

create policy "users can read own apartments"
on public.apartments for select
using (user_id = auth.uid());

create policy "admins can insert own apartments"
on public.apartments for insert
with check (user_id = auth.uid() and public.is_homescope_admin());

create policy "admins can update own apartments"
on public.apartments for update
using (user_id = auth.uid() and public.is_homescope_admin())
with check (user_id = auth.uid() and public.is_homescope_admin());

create policy "admins can delete own apartments"
on public.apartments for delete
using (user_id = auth.uid() and public.is_homescope_admin());
