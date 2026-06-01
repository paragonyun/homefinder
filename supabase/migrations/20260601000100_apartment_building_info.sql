create table if not exists public.apartment_building_info (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references public.users(id) on delete cascade,
  apartment_id uuid not null references public.apartments(id) on delete cascade,
  raw_api_response_id uuid references public.raw_api_responses(id) on delete set null,
  source_name text not null,
  source_ref text,
  legal_address_from_source text,
  road_address_from_source text,
  land_area_m2 numeric,
  building_area_m2 numeric,
  gross_floor_area_m2 numeric,
  floor_area_ratio numeric,
  building_coverage_ratio numeric,
  main_use text,
  highest_floor integer,
  lowest_floor integer,
  structure_type text,
  confidence_level public.confidence_level not null default 'manual',
  fetched_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (apartment_id, source_name)
);

create index if not exists apartment_building_info_user_id_idx
on public.apartment_building_info(user_id);

create index if not exists apartment_building_info_apartment_id_idx
on public.apartment_building_info(apartment_id);

drop trigger if exists set_apartment_building_info_updated_at
on public.apartment_building_info;
create trigger set_apartment_building_info_updated_at
before update on public.apartment_building_info
for each row execute function public.set_updated_at();

alter table public.apartment_building_info enable row level security;

drop policy if exists "users can read own apartment building info"
on public.apartment_building_info;
drop policy if exists "admins can insert own apartment building info"
on public.apartment_building_info;
drop policy if exists "admins can update own apartment building info"
on public.apartment_building_info;
drop policy if exists "admins can delete own apartment building info"
on public.apartment_building_info;

create policy "users can read own apartment building info"
on public.apartment_building_info for select
using (user_id = auth.uid() and public.owns_apartment(apartment_id));

create policy "admins can insert own apartment building info"
on public.apartment_building_info for insert
with check (
  user_id = auth.uid()
  and public.is_homescope_admin()
  and public.owns_apartment(apartment_id)
);

create policy "admins can update own apartment building info"
on public.apartment_building_info for update
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

create policy "admins can delete own apartment building info"
on public.apartment_building_info for delete
using (
  user_id = auth.uid()
  and public.is_homescope_admin()
  and public.owns_apartment(apartment_id)
);
