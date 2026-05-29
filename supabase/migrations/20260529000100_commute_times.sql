create table if not exists public.commute_times (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references public.users(id) on delete cascade,
  apartment_id uuid not null references public.apartments(id) on delete cascade,
  destination_key text not null check (
    destination_key in ('yeouido_station', 'gangnam_station')
  ),
  destination_name text not null,
  destination_lat numeric,
  destination_lng numeric,
  transport_type text not null default 'transit' check (
    transport_type in ('transit', 'walking', 'driving')
  ),
  duration_minutes integer check (
    duration_minutes is null or (duration_minutes > 0 and duration_minutes <= 300)
  ),
  transfer_count integer check (
    transfer_count is null or (transfer_count >= 0 and transfer_count <= 10)
  ),
  source_name text not null default 'manual',
  source_ref text,
  query_datetime timestamptz,
  confidence_level public.confidence_level not null default 'manual',
  fetched_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (apartment_id, destination_key, transport_type)
);

create index if not exists commute_times_user_id_idx
on public.commute_times(user_id);

create index if not exists commute_times_apartment_destination_idx
on public.commute_times(apartment_id, destination_key);

drop trigger if exists set_commute_times_updated_at
on public.commute_times;
create trigger set_commute_times_updated_at
before update on public.commute_times
for each row execute function public.set_updated_at();

alter table public.commute_times enable row level security;

drop policy if exists "users can read own commute times"
on public.commute_times;
drop policy if exists "admins can insert own commute times"
on public.commute_times;
drop policy if exists "admins can update own commute times"
on public.commute_times;
drop policy if exists "admins can delete own commute times"
on public.commute_times;

create policy "users can read own commute times"
on public.commute_times for select
using (user_id = auth.uid() and public.owns_apartment(apartment_id));

create policy "admins can insert own commute times"
on public.commute_times for insert
with check (
  user_id = auth.uid()
  and public.is_homescope_admin()
  and public.owns_apartment(apartment_id)
);

create policy "admins can update own commute times"
on public.commute_times for update
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

create policy "admins can delete own commute times"
on public.commute_times for delete
using (
  user_id = auth.uid()
  and public.is_homescope_admin()
  and public.owns_apartment(apartment_id)
);
