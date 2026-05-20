create table if not exists public.apartment_aliases (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references public.users(id) on delete cascade,
  apartment_id uuid not null references public.apartments(id) on delete cascade,
  alias text not null check (length(trim(alias)) > 0),
  source text,
  created_at timestamptz not null default now(),
  unique (apartment_id, source, alias)
);

create index if not exists apartment_aliases_user_id_idx
on public.apartment_aliases(user_id);

create index if not exists apartment_aliases_apartment_id_idx
on public.apartment_aliases(apartment_id);

alter table public.apartment_aliases enable row level security;

drop policy if exists "users can read own apartment aliases"
on public.apartment_aliases;

create policy "users can read own apartment aliases"
on public.apartment_aliases for select
using (user_id = auth.uid());

drop policy if exists "admins can insert own apartment aliases"
on public.apartment_aliases;

create policy "admins can insert own apartment aliases"
on public.apartment_aliases for insert
with check (user_id = auth.uid() and public.is_homescope_admin());

drop policy if exists "admins can update own apartment aliases"
on public.apartment_aliases;

create policy "admins can update own apartment aliases"
on public.apartment_aliases for update
using (user_id = auth.uid() and public.is_homescope_admin())
with check (user_id = auth.uid() and public.is_homescope_admin());

drop policy if exists "admins can delete own apartment aliases"
on public.apartment_aliases;

create policy "admins can delete own apartment aliases"
on public.apartment_aliases for delete
using (user_id = auth.uid() and public.is_homescope_admin());
