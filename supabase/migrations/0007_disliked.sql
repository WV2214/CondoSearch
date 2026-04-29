alter table public.properties
  add column is_disliked boolean not null default false;

create index properties_is_disliked_idx
  on public.properties(user_id, is_disliked)
  where is_disliked;
