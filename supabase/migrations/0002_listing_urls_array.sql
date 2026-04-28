alter table properties
  add column listing_urls text[] not null default '{}';

update properties
  set listing_urls = case
    when listing_url is not null and listing_url <> '' then array[listing_url]
    else '{}'::text[]
  end;

alter table properties
  drop column listing_url;
