-- Digital book store. Originals are never exposed to shoppers; only the
-- authenticated delivery function can read and personalise a purchased PDF.
create table public.store_products (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  title text not null check (char_length(title) between 1 and 160),
  description text not null default '' check (char_length(description) <= 12000),
  author text not null default 'Rogers Feitosa',
  price_cents integer not null check (price_cents between 100 and 9999999),
  currency text not null default 'brl' check (currency = 'brl'),
  cover_url text check (cover_url is null or cover_url ~ '^https://'),
  payment_link_url text check (payment_link_url is null or payment_link_url ~ '^https://buy\.stripe\.com/[A-Za-z0-9/_-]+$'),
  status text not null default 'draft' check (status in ('draft','published','archived')),
  current_file_id uuid,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (status <> 'published' or (current_file_id is not null and deleted_at is null))
);

create table public.store_product_files (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.store_products(id) on delete restrict,
  storage_path text not null unique check (storage_path ~ '^[a-f0-9-]{36}/[a-f0-9-]{36}\.pdf$'),
  original_name text not null,
  size_bytes integer not null check (size_bytes between 1 and 26214400),
  page_count integer not null check (page_count between 1 and 600),
  created_at timestamptz not null default now(),
  unique (id, product_id)
);
alter table public.store_products add constraint store_product_current_file_fk
  foreign key (current_file_id, id) references public.store_product_files(id, product_id) on delete restrict;

create table public.store_orders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete restrict,
  product_id uuid not null references public.store_products(id) on delete restrict,
  file_id uuid not null,
  buyer_email text not null,
  product_title text not null,
  price_cents integer not null check (price_cents between 100 and 9999999),
  currency text not null default 'brl' check (currency = 'brl'),
  status text not null default 'pending' check (status in ('pending','paid','refunded','disputed','cancelled')),
  provider text not null default 'stripe' check (provider = 'stripe'),
  checkout_id text,
  checkout_url text,
  checkout_expires_at timestamptz,
  provider_payment_id text unique,
  is_live boolean,
  paid_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (file_id, product_id) references public.store_product_files(id, product_id) on delete restrict
);
create unique index store_one_active_order_per_book on public.store_orders(user_id, product_id)
  where status in ('pending','paid');
create index store_orders_buyer_created on public.store_orders(user_id, created_at desc);
create index store_orders_product on public.store_orders(product_id);
create index store_orders_file on public.store_orders(file_id);
create index store_files_product on public.store_product_files(product_id);
create index store_products_catalog on public.store_products(created_at desc) where status = 'published' and deleted_at is null;

create table public.store_payment_events (
  event_id text primary key,
  order_id uuid not null references public.store_orders(id) on delete restrict,
  event_type text not null,
  payment_id text not null,
  received_at timestamptz not null default now()
);
create index store_payment_events_order on public.store_payment_events(order_id);
create table public.store_downloads (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.store_orders(id) on delete restrict,
  user_id uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now()
);
create index store_downloads_rate_limit on public.store_downloads(user_id, created_at desc);
create index store_downloads_order on public.store_downloads(order_id);

alter table public.store_products enable row level security;
alter table public.store_product_files enable row level security;
alter table public.store_orders enable row level security;
alter table public.store_payment_events enable row level security;
alter table public.store_downloads enable row level security;

revoke all on public.store_products, public.store_product_files, public.store_orders, public.store_payment_events, public.store_downloads from anon, authenticated;
grant select on public.store_products to anon, authenticated;
grant insert, update on public.store_products to authenticated;
grant select, insert on public.store_product_files to authenticated;
grant select on public.store_orders, public.store_payment_events, public.store_downloads to authenticated;
grant all on public.store_products, public.store_product_files, public.store_orders, public.store_payment_events, public.store_downloads to service_role;

create policy store_catalog on public.store_products for select to anon, authenticated
  using (status = 'published' and deleted_at is null);
create policy store_products_admin_read on public.store_products for select to authenticated
  using ((select public.has_role(auth.uid(), 'admin')));
create policy store_products_admin_insert on public.store_products for insert to authenticated
  with check ((select public.has_role(auth.uid(), 'admin')));
create policy store_products_admin_update on public.store_products for update to authenticated
  using ((select public.has_role(auth.uid(), 'admin')))
  with check ((select public.has_role(auth.uid(), 'admin')));
create policy store_files_admin_read on public.store_product_files for select to authenticated
  using ((select public.has_role(auth.uid(), 'admin')));
create policy store_files_admin_insert on public.store_product_files for insert to authenticated
  with check ((select public.has_role(auth.uid(), 'admin')));
create policy store_orders_owner_read on public.store_orders for select to authenticated
  using (user_id = (select auth.uid()) or (select public.has_role(auth.uid(), 'admin')));
create policy store_events_admin_read on public.store_payment_events for select to authenticated
  using ((select public.has_role(auth.uid(), 'admin')));
create policy store_downloads_admin_read on public.store_downloads for select to authenticated
  using ((select public.has_role(auth.uid(), 'admin')));

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('store-originals','store-originals',false,26214400,array['application/pdf']),
       ('store-covers','store-covers',true,5242880,array['image/jpeg','image/png','image/webp']);
create policy store_assets_admin_insert on storage.objects for insert to authenticated
  with check (bucket_id in ('store-originals','store-covers') and (select public.has_role(auth.uid(), 'admin')));
create policy store_assets_admin_select on storage.objects for select to authenticated
  using (bucket_id in ('store-originals','store-covers') and (select public.has_role(auth.uid(), 'admin')));
-- No shopper SELECT policy for originals. No overwriting or deleting a sold PDF.
-- Existing permissive policies in a shared bucket schema cannot expose these
-- originals, even if another feature has a broad storage SELECT policy.
create policy store_originals_read_boundary on storage.objects as restrictive for select to anon, authenticated
  using (bucket_id <> 'store-originals' or (select public.has_role(auth.uid(), 'admin')));
create policy store_assets_insert_boundary on storage.objects as restrictive for insert to anon, authenticated
  with check (bucket_id not in ('store-originals','store-covers') or (select public.has_role(auth.uid(), 'admin')));
create policy store_assets_update_boundary on storage.objects as restrictive for update to anon, authenticated
  using (bucket_id not in ('store-originals','store-covers'))
  with check (bucket_id not in ('store-originals','store-covers'));
create policy store_assets_delete_boundary on storage.objects as restrictive for delete to anon, authenticated
  using (bucket_id not in ('store-originals','store-covers'));

-- Only trusted payment handlers call this transaction. Signature, provider
-- account/mode, session association and amount are validated before invocation.
create function public.store_record_payment(
  p_event_id text, p_event_type text, p_order_id uuid, p_payment_id text,
  p_status text, p_amount integer, p_currency text, p_is_live boolean
) returns text language plpgsql security invoker set search_path = '' as $$
declare o public.store_orders; begin
  if p_status not in ('paid','refunded','disputed','cancelled') then raise exception 'invalid_payment_state'; end if;
  select * into o from public.store_orders where id=p_order_id for update;
  if not found then raise exception 'order_not_found'; end if;
  if o.price_cents <> p_amount or o.currency <> lower(p_currency) then raise exception 'payment_amount_mismatch'; end if;
  if o.is_live is not null and o.is_live <> p_is_live then raise exception 'payment_mode_mismatch'; end if;
  if o.provider_payment_id is not null and o.provider_payment_id <> p_payment_id then return 'different_payment_ignored'; end if;
  insert into public.store_payment_events(event_id,order_id,event_type,payment_id)
    values(p_event_id,p_order_id,p_event_type,p_payment_id) on conflict do nothing;
  if not found then return 'duplicate'; end if;
  -- Revocation is terminal for this order; delayed success events cannot reopen it.
  if o.status in ('refunded','disputed') then return o.status; end if;
  if o.status = 'paid' and p_status = 'cancelled' then return o.status; end if;
  update public.store_orders set status=p_status,
    provider_payment_id=p_payment_id, is_live=p_is_live,
    paid_at=case when p_status='paid' then coalesce(paid_at,now()) else paid_at end,
    updated_at=now() where id=p_order_id;
  return p_status;
end; $$;
revoke all on function public.store_record_payment(text,text,uuid,text,text,integer,text,boolean) from public, anon, authenticated;
grant execute on function public.store_record_payment(text,text,uuid,text,text,integer,text,boolean) to service_role;

notify pgrst, 'reload schema';
