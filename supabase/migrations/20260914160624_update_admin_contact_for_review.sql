INSERT INTO public.checkin_configuration_changes(reason,table_name,row_id,before_config)
SELECT 'Admin contact updated for manual review','admin_settings',id,to_jsonb(a)
FROM public.admin_settings a WHERE user_id='c05878bf-0f7a-4d7f-8f96-7ca33c2d5a9b'
AND admin_whatsapp_number IS DISTINCT FROM '+5599984817697';
UPDATE public.admin_settings SET admin_whatsapp_number='+5599984817697',updated_at=now()
WHERE user_id='c05878bf-0f7a-4d7f-8f96-7ca33c2d5a9b' AND admin_whatsapp_number IS DISTINCT FROM '+5599984817697';
