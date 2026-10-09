alter table public.store_products
  add column gallery_urls text[] not null default '{}'::text[],
  add constraint store_products_gallery_urls_check check (
    cardinality(gallery_urls) <= 8
    and coalesce(array_ndims(gallery_urls), 1) = 1
    and array_position(gallery_urls, null) is null
    and array_position(gallery_urls, '') is null
  );
comment on column public.store_products.gallery_urls is
  'Ordered public preview images, shown after cover_url. Updated only by store administrators through existing RLS.';
