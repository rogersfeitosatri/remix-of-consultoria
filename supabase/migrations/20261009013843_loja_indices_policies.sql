-- Keep role checks constant per statement and cover composite foreign keys.
create index store_orders_file_product on public.store_orders(file_id, product_id);
drop index public.store_orders_file;
create index store_products_current_file on public.store_products(current_file_id, id);

alter policy store_catalog on public.store_products to anon;
alter policy store_products_admin_read on public.store_products
  using ((status = 'published' and deleted_at is null) or (select public.has_role((select auth.uid()), 'admin')));
alter policy store_products_admin_insert on public.store_products
  with check ((select public.has_role((select auth.uid()), 'admin')));
alter policy store_products_admin_update on public.store_products
  using ((select public.has_role((select auth.uid()), 'admin')))
  with check ((select public.has_role((select auth.uid()), 'admin')));
alter policy store_files_admin_read on public.store_product_files
  using ((select public.has_role((select auth.uid()), 'admin')));
alter policy store_files_admin_insert on public.store_product_files
  with check ((select public.has_role((select auth.uid()), 'admin')));
alter policy store_orders_owner_read on public.store_orders
  using (user_id = (select auth.uid()) or (select public.has_role((select auth.uid()), 'admin')));
alter policy store_events_admin_read on public.store_payment_events
  using ((select public.has_role((select auth.uid()), 'admin')));
alter policy store_downloads_admin_read on public.store_downloads
  using ((select public.has_role((select auth.uid()), 'admin')));

alter policy store_assets_admin_insert on storage.objects
  with check (bucket_id in ('store-originals','store-covers') and (select public.has_role((select auth.uid()), 'admin')));
alter policy store_assets_admin_select on storage.objects
  using (bucket_id in ('store-originals','store-covers') and (select public.has_role((select auth.uid()), 'admin')));
alter policy store_originals_read_boundary on storage.objects
  using (bucket_id <> 'store-originals' or (select public.has_role((select auth.uid()), 'admin')));
alter policy store_assets_insert_boundary on storage.objects
  with check (bucket_id not in ('store-originals','store-covers') or (select public.has_role((select auth.uid()), 'admin')));
