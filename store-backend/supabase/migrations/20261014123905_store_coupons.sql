create table public.store_coupons (
  id uuid primary key default gen_random_uuid(),
  code text not null unique check (code ~ '^[A-Z0-9][A-Z0-9_-]{2,31}$'),
  discount_type text not null check (discount_type in ('percent','fixed')),
  discount_value integer not null,
  product_id uuid references public.store_products(id) on delete restrict,
  expires_at timestamptz,
  active boolean not null default true,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check ((discount_type='percent' and discount_value between 1 and 99)
    or (discount_type='fixed' and discount_value between 100 and 9999999))
);
create index store_coupons_product on public.store_coupons(product_id);
alter table public.store_coupons enable row level security;
revoke all on public.store_coupons from public, anon, authenticated;
grant select, insert, update on public.store_coupons to authenticated;
grant all on public.store_coupons to service_role;
create policy store_coupons_admin_read on public.store_coupons for select to authenticated
  using ((select store_private.is_admin()));
create policy store_coupons_admin_insert on public.store_coupons for insert to authenticated
  with check ((select store_private.is_admin()));
create policy store_coupons_admin_update on public.store_coupons for update to authenticated
  using ((select store_private.is_admin())) with check ((select store_private.is_admin()));

alter table public.store_orders
  add column coupon_id uuid references public.store_coupons(id) on delete restrict,
  add column coupon_code text,
  add column subtotal_cents integer,
  add column discount_cents integer not null default 0,
  add constraint store_orders_discount_check check (
    discount_cents >= 0 and
    (subtotal_cents is null or (subtotal_cents between 100 and 9999999 and subtotal_cents = price_cents + discount_cents)) and
    (coupon_id is null or (coupon_code is not null and subtotal_cents is not null and discount_cents > 0))
  );
create index store_orders_coupon on public.store_orders(coupon_id);
comment on column public.store_orders.subtotal_cents is 'Price before coupon, after any catalog promotion. NULL for legacy orders.';
comment on column public.store_orders.coupon_code is 'Coupon code snapshot at checkout; retained when the administrator edits or disables the coupon.';
notify pgrst, 'reload schema';
