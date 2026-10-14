-- Integration checks in one transaction. All synthetic identities, products,
-- orders and storage metadata are rolled back; no mail or payment is sent.
begin;
create temporary table store_test_ids as select gen_random_uuid() as buyer, gen_random_uuid() as other_buyer,
  gen_random_uuid() as administrator, gen_random_uuid() as published, gen_random_uuid() as draft,
  gen_random_uuid() as file_id, gen_random_uuid() as order_id, gen_random_uuid() as coupon_id;
grant select on store_test_ids to anon, authenticated, service_role;
insert into auth.users(id,email,aud,role) select buyer,'store-qa-buyer@example.invalid','authenticated','authenticated' from store_test_ids
  union all select other_buyer,'store-qa-other@example.invalid','authenticated','authenticated' from store_test_ids
  union all select administrator,'store-qa-admin@example.invalid','authenticated','authenticated' from store_test_ids;
insert into public.store_admins(user_id) select administrator from store_test_ids;
insert into public.store_products(id,slug,title,price_cents,status)
  select published,'qa-'||published,'QA published book',1990,'draft' from store_test_ids
  union all select draft,'qa-'||draft,'QA draft book',1990,'draft' from store_test_ids;
insert into public.store_product_files(id,product_id,storage_path,original_name,size_bytes,page_count)
  select file_id,published,published||'/'||file_id||'.pdf','qa.pdf',100,2 from store_test_ids;
update public.store_products set current_file_id=i.file_id,status='published' from store_test_ids i where id=i.published;
insert into public.store_coupons(id,code,discount_type,discount_value,product_id)
  select coupon_id,'QA'||upper(substr(replace(coupon_id::text,'-',''),1,28)),'fixed',500,published from store_test_ids;
insert into public.store_orders(id,user_id,product_id,file_id,buyer_email,product_title,price_cents,is_live,coupon_id,coupon_code,subtotal_cents,discount_cents)
  select order_id,buyer,published,file_id,'store-qa-buyer@example.invalid','QA published book',1990,false,coupon_id,'QA'||upper(substr(replace(coupon_id::text,'-',''),1,28)),2490,500 from store_test_ids;
insert into storage.objects(bucket_id,name) select 'store-originals',published||'/'||file_id||'.pdf' from store_test_ids;

set local role anon;
do $$ begin
  if (select count(*) from public.store_products where id in (select published from store_test_ids union all select draft from store_test_ids)) <> 1 then raise exception 'anonymous_catalog_isolation_failed'; end if;
  if (select count(*) from storage.objects where bucket_id='store-originals') <> 0 then raise exception 'anonymous_original_exposed'; end if;
  if has_table_privilege('anon','public.store_coupons','select') then raise exception 'anonymous_coupon_catalog_exposed'; end if;
  if has_table_privilege('anon','public.store_orders','select') then raise exception 'anonymous_order_privilege'; end if;
  if has_function_privilege('anon','public.store_record_payment(text,text,uuid,text,text,integer,text,boolean)','execute') then raise exception 'anonymous_payment_rpc_exposed'; end if;
end $$;
reset role;
select set_config('request.jwt.claims',json_build_object('sub',buyer,'role','authenticated','user_metadata',json_build_object('role','admin'))::text,true) from store_test_ids;
set local role authenticated;
do $$ declare updated integer; begin
  if (select count(*) from public.store_orders where id=(select order_id from store_test_ids)) <> 1 then raise exception 'buyer_cannot_read_own_order'; end if;
  if (select count(*) from public.store_product_files where id=(select file_id from store_test_ids)) <> 0 then raise exception 'buyer_original_metadata_exposed'; end if;
  if (select count(*) from storage.objects where bucket_id='store-originals') <> 0 then raise exception 'buyer_original_exposed'; end if;
  update public.store_products set price_cents=100 where id=(select published from store_test_ids);
  get diagnostics updated = row_count;
  if updated <> 0 then raise exception 'buyer_can_change_price'; end if;
  update public.store_products set sale_price_cents=100 where id=(select published from store_test_ids);
  get diagnostics updated = row_count;
  if updated <> 0 then raise exception 'buyer_can_change_sale_price'; end if;
  if exists(select 1 from public.store_coupons) then raise exception 'buyer_coupon_catalog_exposed'; end if;
  update public.store_coupons set discount_value=1 where id=(select coupon_id from store_test_ids);
  get diagnostics updated = row_count;
  if updated <> 0 then raise exception 'buyer_can_edit_coupons'; end if;
  begin
    insert into public.store_coupons(code,discount_type,discount_value) values('MALICIOUS','percent',90);
    raise exception 'buyer_can_create_coupon';
  exception when insufficient_privilege then null; end;
  if exists(select 1 from public.store_admins) then raise exception 'buyer_has_admin_membership'; end if;
  if has_table_privilege('authenticated','public.store_admins','insert') or has_table_privilege('authenticated','public.store_admins','update') then raise exception 'buyer_can_promote_self'; end if;
  if has_table_privilege('authenticated','public.store_orders','update') then raise exception 'buyer_can_change_payment'; end if;
  if has_table_privilege('authenticated','public.store_orders','insert') then raise exception 'buyer_can_create_paid_order'; end if;
  if has_function_privilege('authenticated','public.store_record_payment(text,text,uuid,text,text,integer,text,boolean)','execute') then raise exception 'buyer_can_call_payment_rpc'; end if;
  begin
    insert into public.store_products(slug,title,price_cents) values('qa-unauthorised','Malicious book',100);
    raise exception 'buyer_can_create_product';
  exception when insufficient_privilege then null; end;
end $$;
reset role;
select set_config('request.jwt.claims',json_build_object('sub',other_buyer,'role','authenticated')::text,true) from store_test_ids;
set local role authenticated;
do $$ begin
  if (select count(*) from public.store_orders where id=(select order_id from store_test_ids)) <> 0 then raise exception 'another_buyer_order_exposed'; end if;
end $$;
reset role;
select set_config('request.jwt.claims',json_build_object('sub',administrator,'role','authenticated')::text,true) from store_test_ids;
set local role authenticated;
do $$ begin
  if not exists(select 1 from public.store_coupons where id=(select coupon_id from store_test_ids)) then raise exception 'admin_cannot_read_coupons'; end if;
  update public.store_coupons set discount_value=300, active=false, deleted_at=now() where id=(select coupon_id from store_test_ids);
  if (select discount_value from public.store_coupons where id=(select coupon_id from store_test_ids)) <> 300 then raise exception 'admin_cannot_edit_coupon'; end if;
  begin
    insert into public.store_coupons(code,discount_type,discount_value) values('BADPERCENT','percent',100);
    raise exception 'invalid_coupon_accepted';
  exception when check_violation then null; end;
  begin
    insert into public.store_coupons(code,discount_type,discount_value) values('BADFIXED','fixed',0);
    raise exception 'zero_coupon_accepted';
  exception when check_violation then null; end;
  update public.store_products set sale_price_cents=1490 where id=(select published from store_test_ids);
  if (select sale_price_cents from public.store_products where id=(select published from store_test_ids)) <> 1490 then raise exception 'admin_cannot_set_sale_price'; end if;
  begin
    update public.store_products set sale_price_cents=1990 where id=(select published from store_test_ids);
    raise exception 'sale_price_must_be_lower';
  exception when check_violation then null; end;
  begin
    update public.store_products set sale_price_cents=0 where id=(select published from store_test_ids);
    raise exception 'sale_price_must_be_positive';
  exception when check_violation then null; end;
  begin
    update public.store_products set price_cents=1000 where id=(select published from store_test_ids);
    raise exception 'original_price_cannot_be_lower_than_sale';
  exception when check_violation then null; end;
  update public.store_products set sale_price_cents=null where id=(select published from store_test_ids);
  if (select sale_price_cents from public.store_products where id=(select published from store_test_ids)) is not null then raise exception 'admin_cannot_remove_sale_price'; end if;
  if (select count(*) from public.store_products where id in (select published from store_test_ids union all select draft from store_test_ids)) <> 2 then raise exception 'admin_cannot_read_drafts'; end if;
  if (select count(*) from public.store_product_files where id=(select file_id from store_test_ids)) <> 1 then raise exception 'admin_cannot_read_file_metadata'; end if;
  if (select count(*) from storage.objects where bucket_id='store-originals' and name=(select published||'/'||file_id||'.pdf' from store_test_ids)) <> 1 then raise exception 'admin_cannot_read_original'; end if;
end $$;
reset role;
select set_config('request.jwt.claims','{"role":"service_role"}',true);
set local role service_role;
do $$ begin
  if (select discount_cents from public.store_orders where id=(select order_id from store_test_ids)) <> 500 then raise exception 'coupon_edit_changed_order_snapshot'; end if;
  begin
    update public.store_orders set subtotal_cents=100 where id=(select order_id from store_test_ids);
    raise exception 'invalid_discount_total_accepted';
  exception when check_violation then null; end;
end $$;
do $$ declare oid uuid; result text; begin
  select order_id into oid from store_test_ids;
  begin
    perform public.store_record_payment('qa-wrong-amount','checkout.session.completed',oid,'pi_qa','paid',100,'brl',false);
    raise exception 'wrong_amount_accepted';
  exception when raise_exception then
    if sqlerrm <> 'payment_amount_mismatch' then raise; end if;
  end;
  result := public.store_record_payment('qa-paid','checkout.session.completed',oid,'pi_qa','paid',1990,'brl',false);
  if result <> 'paid' then raise exception 'payment_not_applied'; end if;
  result := public.store_record_payment('qa-paid','checkout.session.completed',oid,'pi_qa','paid',1990,'brl',false);
  if result <> 'duplicate' then raise exception 'payment_not_idempotent'; end if;
  result := public.store_record_payment('qa-different','checkout.session.completed',oid,'pi_other','paid',1990,'brl',false);
  if result <> 'different_payment_ignored' then raise exception 'different_payment_overwrote_order'; end if;
  result := public.store_record_payment('qa-refund','charge.refunded',oid,'pi_qa','refunded',1990,'brl',false);
  if result <> 'refunded' then raise exception 'refund_not_applied'; end if;
  result := public.store_record_payment('qa-late-paid','checkout.session.completed',oid,'pi_qa','paid',1990,'brl',false);
  if result <> 'refunded' then raise exception 'late_success_reopened_refund'; end if;
end $$;
reset role;
rollback;
select 'PASS: catalog, ownership, admin, private originals, server-only payment changes, amount, idempotency and refund revocation' as result;
