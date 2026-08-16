revoke execute on function public.publish_checkin_form_version(uuid, text) from anon;
revoke execute on function public.publish_anamnese_form_version(uuid, text) from anon;
revoke execute on function public.archive_checkin_form(uuid, boolean) from anon;
revoke execute on function public.archive_anamnese_form(uuid, boolean) from anon;
revoke execute on function public.resolve_checkin_form_for_client(uuid) from anon;
grant execute on function public.get_checkin_dispatch_version(text) to anon, authenticated;