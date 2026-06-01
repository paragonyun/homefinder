create table if not exists public.schools (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references public.users(id) on delete cascade,
  source_name text not null,
  source_ref text,
  school_code text not null,
  office_code text,
  office_name text,
  school_name text not null,
  school_type text not null check (school_type in ('elementary', 'middle', 'high', 'unknown')),
  school_kind_name text,
  region_name text,
  district_office_name text,
  address text,
  road_address text,
  homepage_url text,
  phone text,
  coeducation_type text,
  founded_date date,
  lat numeric,
  lng numeric,
  confidence_level public.confidence_level not null default 'high',
  fetched_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, source_name, school_code)
);

create table if not exists public.apartment_school_access (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references public.users(id) on delete cascade,
  apartment_id uuid not null references public.apartments(id) on delete cascade,
  school_id uuid not null references public.schools(id) on delete cascade,
  school_type text not null check (school_type in ('elementary', 'middle', 'high', 'unknown')),
  distance_meters integer,
  walk_minutes integer,
  is_nearest_by_type boolean not null default false,
  source_name text not null,
  source_ref text,
  confidence_level public.confidence_level not null default 'high',
  fetched_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (apartment_id, school_id, source_name)
);

create index if not exists schools_user_id_idx
on public.schools(user_id);

create index if not exists schools_school_type_idx
on public.schools(user_id, school_type);

create index if not exists schools_region_name_idx
on public.schools(region_name);

create index if not exists apartment_school_access_apartment_id_idx
on public.apartment_school_access(apartment_id);

create index if not exists apartment_school_access_nearest_idx
on public.apartment_school_access(apartment_id, school_type, is_nearest_by_type);

drop trigger if exists set_schools_updated_at
on public.schools;
create trigger set_schools_updated_at
before update on public.schools
for each row execute function public.set_updated_at();

drop trigger if exists set_apartment_school_access_updated_at
on public.apartment_school_access;
create trigger set_apartment_school_access_updated_at
before update on public.apartment_school_access
for each row execute function public.set_updated_at();

alter table public.schools enable row level security;
alter table public.apartment_school_access enable row level security;

drop policy if exists "users can read own schools"
on public.schools;
drop policy if exists "admins can insert own schools"
on public.schools;
drop policy if exists "admins can update own schools"
on public.schools;
drop policy if exists "admins can delete own schools"
on public.schools;

create policy "users can read own schools"
on public.schools for select
using (user_id = auth.uid());

create policy "admins can insert own schools"
on public.schools for insert
with check (user_id = auth.uid() and public.is_homescope_admin());

create policy "admins can update own schools"
on public.schools for update
using (user_id = auth.uid() and public.is_homescope_admin())
with check (user_id = auth.uid() and public.is_homescope_admin());

create policy "admins can delete own schools"
on public.schools for delete
using (user_id = auth.uid() and public.is_homescope_admin());

drop policy if exists "users can read own apartment school access"
on public.apartment_school_access;
drop policy if exists "admins can insert own apartment school access"
on public.apartment_school_access;
drop policy if exists "admins can update own apartment school access"
on public.apartment_school_access;
drop policy if exists "admins can delete own apartment school access"
on public.apartment_school_access;

create policy "users can read own apartment school access"
on public.apartment_school_access for select
using (user_id = auth.uid() and public.owns_apartment(apartment_id));

create policy "admins can insert own apartment school access"
on public.apartment_school_access for insert
with check (
  user_id = auth.uid()
  and public.is_homescope_admin()
  and public.owns_apartment(apartment_id)
);

create policy "admins can update own apartment school access"
on public.apartment_school_access for update
using (
  user_id = auth.uid()
  and public.is_homescope_admin()
  and public.owns_apartment(apartment_id)
)
with check (
  user_id = auth.uid()
  and public.is_homescope_admin()
  and public.owns_apartment(apartment_id)
);

create policy "admins can delete own apartment school access"
on public.apartment_school_access for delete
using (
  user_id = auth.uid()
  and public.is_homescope_admin()
  and public.owns_apartment(apartment_id)
);
