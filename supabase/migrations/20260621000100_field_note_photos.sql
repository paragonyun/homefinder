insert into storage.buckets (
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types
)
values (
  'field-note-photos',
  'field-note-photos',
  false,
  8388608,
  array[
    'image/jpeg',
    'image/png',
    'image/webp',
    'image/heic',
    'image/heif'
  ]
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

create table if not exists public.field_note_photos (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references public.users(id) on delete cascade,
  apartment_id uuid not null references public.apartments(id) on delete cascade,
  field_note_id uuid not null references public.field_notes(id) on delete cascade,
  storage_bucket text not null default 'field-note-photos',
  storage_path text not null,
  original_file_name text,
  content_type text,
  file_size_bytes integer check (file_size_bytes is null or file_size_bytes >= 0),
  sort_order integer not null default 0,
  caption text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (storage_bucket, storage_path)
);

create index if not exists field_note_photos_user_id_idx on public.field_note_photos(user_id);
create index if not exists field_note_photos_apartment_id_idx on public.field_note_photos(apartment_id);
create index if not exists field_note_photos_field_note_id_idx on public.field_note_photos(field_note_id);

drop trigger if exists set_field_note_photos_updated_at on public.field_note_photos;
create trigger set_field_note_photos_updated_at
before update on public.field_note_photos
for each row execute function public.set_updated_at();

alter table public.field_note_photos enable row level security;

drop policy if exists "users can manage own field note photos" on public.field_note_photos;
create policy "users can manage own field note photos"
on public.field_note_photos for all
using (user_id = auth.uid())
with check (user_id = auth.uid());

drop policy if exists "users can read own field note photo objects" on storage.objects;
create policy "users can read own field note photo objects"
on storage.objects for select
using (
  bucket_id = 'field-note-photos'
  and auth.uid()::text = (storage.foldername(name))[1]
);

drop policy if exists "users can upload own field note photo objects" on storage.objects;
create policy "users can upload own field note photo objects"
on storage.objects for insert
with check (
  bucket_id = 'field-note-photos'
  and auth.uid()::text = (storage.foldername(name))[1]
);

drop policy if exists "users can update own field note photo objects" on storage.objects;
create policy "users can update own field note photo objects"
on storage.objects for update
using (
  bucket_id = 'field-note-photos'
  and auth.uid()::text = (storage.foldername(name))[1]
)
with check (
  bucket_id = 'field-note-photos'
  and auth.uid()::text = (storage.foldername(name))[1]
);

drop policy if exists "users can delete own field note photo objects" on storage.objects;
create policy "users can delete own field note photo objects"
on storage.objects for delete
using (
  bucket_id = 'field-note-photos'
  and auth.uid()::text = (storage.foldername(name))[1]
);
