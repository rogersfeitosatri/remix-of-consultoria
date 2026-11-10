-- Personalised copies only. Buyers receive a 120-second signed HTTPS URL after
-- store-download checks authenticated ownership and the authoritative payment.
insert into storage.buckets (id,name,public,file_size_limit,allowed_mime_types)
values ('store-deliveries','store-deliveries',false,52428800,array['application/pdf']);

-- Keep copies inaccessible to direct client reads/writes, even if a permissive
-- policy is added elsewhere later. Only the server's service role can use them.
create policy store_deliveries_server_only on storage.objects
as restrictive for all to anon,authenticated
using (bucket_id <> 'store-deliveries')
with check (bucket_id <> 'store-deliveries');
