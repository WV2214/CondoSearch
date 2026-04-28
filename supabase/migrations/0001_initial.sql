-- Condo Search initial schema
-- Run this in Supabase SQL Editor → New query.
-- After running, also create the property-photos storage bucket and apply the policies at the bottom of this file.

create type tour_status as enum (
  'not_toured', 'scheduled', 'toured', 'rejected', 'top_pick'
);

create table public.properties (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references auth.users(id) on delete cascade,
  listing_url     text not null,
  address         text not null,
  latitude        double precision not null,
  longitude       double precision not null,
  price           integer,
  beds            smallint,
  baths           numeric(2,1),
  square_feet     integer,
  photo_path      text,
  tour_status     tour_status not null default 'not_toured',
  star_rating     smallint check (star_rating between 1 and 5),
  notes           text not null default '',
  pros            text[] not null default '{}',
  cons            text[] not null default '{}',
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index properties_user_id_idx on public.properties(user_id);

alter table public.properties enable row level security;

create policy "user owns properties select"
  on public.properties for select
  using (auth.uid() = user_id);

create policy "user owns properties insert"
  on public.properties for insert
  with check (auth.uid() = user_id);

create policy "user owns properties update"
  on public.properties for update
  using (auth.uid() = user_id);

create policy "user owns properties delete"
  on public.properties for delete
  using (auth.uid() = user_id);

create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger properties_updated_at
  before update on public.properties
  for each row execute function public.set_updated_at();


-- ----------------------------------------------------------------
-- STORAGE: property-photos bucket
-- ----------------------------------------------------------------
-- Step 1 (in Supabase dashboard): Storage → New bucket
--   Name: property-photos
--   Public bucket: yes
--
-- Step 2: run the SQL below in the SQL Editor to apply the access policies.

create policy "user can upload to own folder"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'property-photos'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "user can update own files"
  on storage.objects for update
  to authenticated
  using (
    bucket_id = 'property-photos'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "user can delete own files"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'property-photos'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "anyone can read property photos"
  on storage.objects for select
  using (bucket_id = 'property-photos');
