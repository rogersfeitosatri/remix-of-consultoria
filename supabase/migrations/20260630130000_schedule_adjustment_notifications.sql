-- Agenda a notificação de ajustes (push) toda SEGUNDA às 07:00 via pg_cron + pg_net.
-- Chama a edge function send-adjustment-notifications, que calcula os atletas que fecham
-- o bloco mensal no dia e envia o push (FCM). A chave usada é a anon (pública); a função
-- está com verify_jwt = false. Idempotente e resiliente (não quebra o deploy se pg_cron
-- não estiver disponível — nesse caso, habilite pg_cron/pg_net em Database → Extensions).

do $$
begin
  -- Extensões necessárias
  begin
    create extension if not exists pg_cron;
  exception when others then
    raise notice 'pg_cron indisponível: %', sqlerrm;
  end;

  begin
    create extension if not exists pg_net;
  exception when others then
    raise notice 'pg_net indisponível: %', sqlerrm;
  end;

  -- Agendamento (remove anterior se existir, depois recria)
  begin
    if exists (select 1 from cron.job where jobname = 'ajustes-mensais') then
      perform cron.unschedule('ajustes-mensais');
    end if;

    perform cron.schedule(
      'ajustes-mensais',
      '0 7 * * 1',
      $cron$
      select net.http_post(
        url := 'https://vhzxnatgwravidvbehwi.supabase.co/functions/v1/send-adjustment-notifications',
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZoenhuYXRnd3JhdmlkdmJlaHdpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njc3MTQ3NjMsImV4cCI6MjA4MzI5MDc2M30.yfr0oLbb7IRYPmt-x0rcwh5AfMWeaLjmwwj0EMRzS-8'
        ),
        body := '{}'::jsonb
      );
      $cron$
    );
    raise notice 'Cron ajustes-mensais agendado (segunda 07:00).';
  exception when others then
    raise notice 'Não foi possível agendar ajustes-mensais: %', sqlerrm;
  end;
end $$;
