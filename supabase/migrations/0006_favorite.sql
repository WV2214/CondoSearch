alter table public.properties
  add column is_favorite boolean not null default false;

create index properties_is_favorite_idx
  on public.properties(user_id, is_favorite)
  where is_favorite;
