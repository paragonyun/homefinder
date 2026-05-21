create or replace function public.is_homescope_admin()
returns boolean
language sql
stable
as $$
  select coalesce(auth.jwt() -> 'app_metadata' ->> 'role', '') = 'admin';
$$;

revoke all on function public.is_homescope_admin() from public;
grant execute on function public.is_homescope_admin() to authenticated;

create table if not exists public.kapt_code_directory (
  kapt_code text primary key,
  kapt_name text not null,
  normalized_kapt_name text not null,
  bjd_code text,
  sido text,
  sigungu text,
  eupmyeondong text,
  ri text,
  legal_address text,
  road_address text,
  source text not null default 'AptListService3',
  source_endpoint text,
  last_synced_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists kapt_code_directory_bjd_code_idx
on public.kapt_code_directory(bjd_code);

create index if not exists kapt_code_directory_region_idx
on public.kapt_code_directory(sido, sigungu, eupmyeondong);

create index if not exists kapt_code_directory_normalized_name_idx
on public.kapt_code_directory(normalized_kapt_name);

drop trigger if exists set_kapt_code_directory_updated_at
on public.kapt_code_directory;
create trigger set_kapt_code_directory_updated_at
before update on public.kapt_code_directory
for each row execute function public.set_updated_at();

alter table public.kapt_code_directory enable row level security;

drop policy if exists "authenticated users can read kapt directory"
on public.kapt_code_directory;
drop policy if exists "admins can insert kapt directory"
on public.kapt_code_directory;
drop policy if exists "admins can update kapt directory"
on public.kapt_code_directory;
drop policy if exists "admins can delete kapt directory"
on public.kapt_code_directory;

create policy "authenticated users can read kapt directory"
on public.kapt_code_directory for select
to authenticated
using (true);

create policy "admins can insert kapt directory"
on public.kapt_code_directory for insert
to authenticated
with check (public.is_homescope_admin());

create policy "admins can update kapt directory"
on public.kapt_code_directory for update
to authenticated
using (public.is_homescope_admin())
with check (public.is_homescope_admin());

create policy "admins can delete kapt directory"
on public.kapt_code_directory for delete
to authenticated
using (public.is_homescope_admin());
