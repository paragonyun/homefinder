create table if not exists public.apartment_transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references public.users(id) on delete cascade,
  apartment_id uuid not null references public.apartments(id) on delete cascade,
  raw_api_response_id uuid references public.raw_api_responses(id) on delete set null,
  source_name text not null,
  source_ref text,
  source_hash text not null,
  deal_year integer not null,
  deal_month integer not null,
  deal_day integer not null,
  deal_date date not null,
  exclusive_area_m2 numeric not null,
  floor integer,
  deal_amount_krw bigint not null,
  deal_amount_manwon integer not null,
  apartment_name_from_source text,
  address_from_source text,
  cancel_yn text,
  cancel_date date,
  confidence_level public.confidence_level not null default 'high',
  fetched_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (apartment_id, source_name, source_hash)
);

create table if not exists public.apartment_price_snapshots (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references public.users(id) on delete cascade,
  apartment_id uuid not null references public.apartments(id) on delete cascade,
  area_bucket text not null,
  exclusive_area_min_m2 numeric,
  exclusive_area_max_m2 numeric,
  snapshot_date date not null,
  avg_price_krw bigint,
  min_price_krw bigint,
  max_price_krw bigint,
  median_price_krw bigint,
  transaction_count integer not null default 0,
  source_name text not null,
  calculated_at timestamptz not null default now(),
  unique (apartment_id, area_bucket, snapshot_date)
);

create index if not exists apartment_transactions_apartment_date_idx
on public.apartment_transactions(apartment_id, deal_date desc);

create index if not exists apartment_transactions_deal_date_idx
on public.apartment_transactions(deal_date desc);

create index if not exists apartment_price_snapshots_apartment_date_idx
on public.apartment_price_snapshots(apartment_id, snapshot_date desc);

create or replace function public.owns_apartment(target_apartment_id uuid)
returns boolean
language sql
stable
as $$
  select exists (
    select 1
    from public.apartments
    where id = target_apartment_id
      and user_id = auth.uid()
  );
$$;

revoke all on function public.owns_apartment(uuid) from public;
grant execute on function public.owns_apartment(uuid) to authenticated;

drop trigger if exists set_apartment_transactions_updated_at
on public.apartment_transactions;
create trigger set_apartment_transactions_updated_at
before update on public.apartment_transactions
for each row execute function public.set_updated_at();

alter table public.apartment_transactions enable row level security;
alter table public.apartment_price_snapshots enable row level security;

drop policy if exists "users can read own apartment transactions"
on public.apartment_transactions;
drop policy if exists "admins can insert own apartment transactions"
on public.apartment_transactions;
drop policy if exists "admins can update own apartment transactions"
on public.apartment_transactions;
drop policy if exists "admins can delete own apartment transactions"
on public.apartment_transactions;

create policy "users can read own apartment transactions"
on public.apartment_transactions for select
using (user_id = auth.uid() and public.owns_apartment(apartment_id));

create policy "admins can insert own apartment transactions"
on public.apartment_transactions for insert
with check (
  user_id = auth.uid()
  and public.is_homescope_admin()
  and public.owns_apartment(apartment_id)
);

create policy "admins can update own apartment transactions"
on public.apartment_transactions for update
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

create policy "admins can delete own apartment transactions"
on public.apartment_transactions for delete
using (
  user_id = auth.uid()
  and public.is_homescope_admin()
  and public.owns_apartment(apartment_id)
);

drop policy if exists "users can read own apartment price snapshots"
on public.apartment_price_snapshots;
drop policy if exists "admins can insert own apartment price snapshots"
on public.apartment_price_snapshots;
drop policy if exists "admins can update own apartment price snapshots"
on public.apartment_price_snapshots;
drop policy if exists "admins can delete own apartment price snapshots"
on public.apartment_price_snapshots;

create policy "users can read own apartment price snapshots"
on public.apartment_price_snapshots for select
using (user_id = auth.uid() and public.owns_apartment(apartment_id));

create policy "admins can insert own apartment price snapshots"
on public.apartment_price_snapshots for insert
with check (
  user_id = auth.uid()
  and public.is_homescope_admin()
  and public.owns_apartment(apartment_id)
);

create policy "admins can update own apartment price snapshots"
on public.apartment_price_snapshots for update
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

create policy "admins can delete own apartment price snapshots"
on public.apartment_price_snapshots for delete
using (
  user_id = auth.uid()
  and public.is_homescope_admin()
  and public.owns_apartment(apartment_id)
);
