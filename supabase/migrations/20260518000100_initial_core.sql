create extension if not exists pgcrypto;

do $$
begin
  create type public.apartment_status as enum (
    'candidate',
    'interested',
    'visit_planned',
    'visited',
    'on_hold',
    'excluded'
  );
exception
  when duplicate_object then null;
end $$;

do $$
begin
  create type public.confidence_level as enum (
    'high',
    'medium',
    'low',
    'manual',
    'unknown'
  );
exception
  when duplicate_object then null;
end $$;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create table if not exists public.users (
  id uuid primary key references auth.users(id) on delete cascade,
  email text unique,
  name text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

insert into public.users (id, email)
select id, email
from auth.users
on conflict (id) do nothing;

create table if not exists public.neighborhoods (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references public.users(id) on delete cascade,
  name text not null,
  description text,
  city text,
  district text,
  dong text,
  center_lat numeric,
  center_lng numeric,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.apartments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references public.users(id) on delete cascade,
  neighborhood_id uuid references public.neighborhoods(id) on delete set null,
  name text not null,
  display_name text,
  address text,
  road_address text,
  lat numeric,
  lng numeric,
  lawd_cd text,
  kapt_code text,
  kb_url text,
  naver_land_url text,
  status public.apartment_status not null default 'candidate',
  memo text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.field_notes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references public.users(id) on delete cascade,
  apartment_id uuid not null references public.apartments(id) on delete cascade,
  visit_date date,
  visit_time text,
  weather text,
  station_walk_rating integer check (station_walk_rating between 1 and 5),
  slope_rating integer check (slope_rating between 1 and 5),
  complex_condition_rating integer check (complex_condition_rating between 1 and 5),
  parking_rating integer check (parking_rating between 1 and 5),
  noise_rating integer check (noise_rating between 1 and 5),
  night_mood_rating integer check (night_mood_rating between 1 and 5),
  school_route_rating integer check (school_route_rating between 1 and 5),
  commercial_area_rating integer check (commercial_area_rating between 1 and 5),
  overall_rating integer check (overall_rating between 1 and 5),
  good_points text,
  bad_points text,
  parking_note text,
  noise_note text,
  slope_note text,
  overall_memo text,
  revisit_intention text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.raw_api_responses (
  id uuid primary key default gen_random_uuid(),
  provider text not null,
  endpoint text,
  request_hash text,
  request_params jsonb,
  response_body jsonb,
  fetched_at timestamptz not null default now(),
  apartment_id uuid references public.apartments(id) on delete set null,
  user_id uuid not null default auth.uid() references public.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

create index if not exists neighborhoods_user_id_idx on public.neighborhoods(user_id);
create index if not exists apartments_user_id_idx on public.apartments(user_id);
create index if not exists apartments_neighborhood_id_idx on public.apartments(neighborhood_id);
create index if not exists apartments_status_idx on public.apartments(status);
create index if not exists field_notes_user_id_idx on public.field_notes(user_id);
create index if not exists field_notes_apartment_id_idx on public.field_notes(apartment_id);
create index if not exists raw_api_responses_apartment_id_idx on public.raw_api_responses(apartment_id);
create index if not exists raw_api_responses_provider_idx on public.raw_api_responses(provider);

drop trigger if exists set_users_updated_at on public.users;
create trigger set_users_updated_at
before update on public.users
for each row execute function public.set_updated_at();

drop trigger if exists set_neighborhoods_updated_at on public.neighborhoods;
create trigger set_neighborhoods_updated_at
before update on public.neighborhoods
for each row execute function public.set_updated_at();

drop trigger if exists set_apartments_updated_at on public.apartments;
create trigger set_apartments_updated_at
before update on public.apartments
for each row execute function public.set_updated_at();

drop trigger if exists set_field_notes_updated_at on public.field_notes;
create trigger set_field_notes_updated_at
before update on public.field_notes
for each row execute function public.set_updated_at();

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.users (id, email, name)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'name', new.raw_user_meta_data->>'full_name')
  )
  on conflict (id) do update set
    email = excluded.email,
    updated_at = now();

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

alter table public.users enable row level security;
alter table public.neighborhoods enable row level security;
alter table public.apartments enable row level security;
alter table public.field_notes enable row level security;
alter table public.raw_api_responses enable row level security;

drop policy if exists "users can read own profile" on public.users;
create policy "users can read own profile"
on public.users for select
using (id = auth.uid());

drop policy if exists "users can update own profile" on public.users;
create policy "users can update own profile"
on public.users for update
using (id = auth.uid())
with check (id = auth.uid());

drop policy if exists "users can manage own neighborhoods" on public.neighborhoods;
create policy "users can manage own neighborhoods"
on public.neighborhoods for all
using (user_id = auth.uid())
with check (user_id = auth.uid());

drop policy if exists "users can manage own apartments" on public.apartments;
create policy "users can manage own apartments"
on public.apartments for all
using (user_id = auth.uid())
with check (user_id = auth.uid());

drop policy if exists "users can manage own field notes" on public.field_notes;
create policy "users can manage own field notes"
on public.field_notes for all
using (user_id = auth.uid())
with check (user_id = auth.uid());

drop policy if exists "users can manage own raw responses" on public.raw_api_responses;
create policy "users can manage own raw responses"
on public.raw_api_responses for all
using (user_id = auth.uid())
with check (user_id = auth.uid());
