alter table public.properties
  add column property_type text not null default 'condo'
    check (property_type in ('condo', 'apartment'));
