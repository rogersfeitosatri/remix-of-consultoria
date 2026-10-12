alter table public.store_products
  add column sale_price_cents integer,
  add constraint store_products_sale_price_check
    check (sale_price_cents is null or (sale_price_cents >= 100 and sale_price_cents < price_cents));
comment on column public.store_products.sale_price_cents is
  'Optional promotional price in cents. NULL uses the original price.';
notify pgrst, 'reload schema';
