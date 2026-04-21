ALTER TABLE public.clients
ADD COLUMN IF NOT EXISTS checkin_response_window_hours integer;

COMMENT ON COLUMN public.clients.checkin_response_window_hours IS 'Prazo (em horas) para o atleta responder o check-in após o envio. NULL = usa padrão de 36h.';