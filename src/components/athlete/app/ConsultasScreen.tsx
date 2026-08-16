/**
 * ETAPA 5C — Consultas do atleta.
 * Fontes canônicas: appointments (motor real) + consultation_schedules + booking_links.
 * O atleta nunca cria consulta aqui: apenas usa o link canônico de agendamento.
 */
import { CalendarDays, Video, ExternalLink } from 'lucide-react';
import type { useAthleteAreaData } from '@/hooks/useAthleteArea';

const GOLD = 'hsl(43,74%,49%)';
const CARD = 'rounded-2xl bg-[#131417] border border-white/[0.06]';

type Data = NonNullable<ReturnType<typeof useAthleteAreaData>['data']>;

function fmtDate(d?: string | null) {
  if (!d) return '—';
  return new Date(`${d}T12:00:00`).toLocaleDateString('pt-BR');
}

export function ConsultasScreen({ data, blockedReason }: { data?: Data; blockedReason?: string | null }) {
  const next = data?.nextAppointment;
  const upcoming = (data?.upcomingAppointments || []).slice(1);
  const past = data?.pastAppointments || [];
  const bookingUrl = data?.bookingUrl;
  const awaiting = data?.awaitingSchedule;

  return (
    <div className="space-y-5">
      <h1 className="text-xl font-extrabold text-white">Consultas</h1>

      {blockedReason && (
        <div className="rounded-2xl border border-amber-500/30 bg-amber-500/10 p-4">
          <p className="text-sm text-amber-200">{blockedReason}</p>
        </div>
      )}

      {!blockedReason && next && (
        <div className={`${CARD} p-4`} style={{ borderColor: 'rgba(191,150,54,0.35)' }}>
          <div className="flex items-center gap-2 mb-1.5">
            <CalendarDays className="h-4 w-4" style={{ color: GOLD }} />
            <span className="text-[11px] uppercase tracking-wide font-semibold" style={{ color: GOLD }}>
              Próxima consulta
            </span>
          </div>
          <p className="text-white font-bold text-lg">
            {fmtDate(next.date)}
            {next.time ? ` · ${String(next.time).slice(0, 5)}` : ''}
          </p>
          {next.meetLink ? (
            <a
              href={next.meetLink}
              target="_blank"
              rel="noreferrer"
              className="mt-3 inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold text-black"
              style={{ background: GOLD }}
            >
              <Video className="h-4 w-4" /> Entrar na consulta
            </a>
          ) : (
            <p className="text-xs text-gray-500 mt-2">Link em preparação — ele aparece aqui antes do horário.</p>
          )}
        </div>
      )}

      {!blockedReason && !next && awaiting && bookingUrl && (
        <div className={`${CARD} p-4`}>
          <p className="text-white font-bold">Agende sua consulta</p>
          <p className="text-sm text-gray-500 mt-1">
            {awaiting.scheduled_date ? `Período previsto: ${fmtDate(awaiting.scheduled_date)}.` : 'Escolha o melhor horário.'}
          </p>
          <a
            href={bookingUrl}
            target="_blank"
            rel="noreferrer"
            className="mt-3 inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold text-black"
            style={{ background: GOLD }}
          >
            Escolher horário <ExternalLink className="h-3.5 w-3.5" />
          </a>
        </div>
      )}

      {!blockedReason && !next && !(awaiting && bookingUrl) && (
        <div className={`${CARD} p-4`}>
          <p className="text-white font-semibold">Nenhuma consulta agendada</p>
          <p className="text-sm text-gray-500 mt-1">
            Quando o agendamento for liberado, o link aparece aqui e chega no seu WhatsApp.
          </p>
        </div>
      )}

      {upcoming.length > 0 && (
        <section className="space-y-2.5">
          <h2 className="text-sm font-semibold text-gray-400 px-1">Também agendadas</h2>
          {upcoming.map((a) => (
            <div key={a.id} className={`${CARD} px-4 py-3`}>
              <p className="text-sm text-white">
                {fmtDate(a.date)}
                {a.time ? ` · ${String(a.time).slice(0, 5)}` : ''}
              </p>
            </div>
          ))}
        </section>
      )}

      <section className="space-y-2.5">
        <h2 className="text-sm font-semibold text-gray-400 px-1">Histórico</h2>
        {past.length === 0 ? (
          <div className={`${CARD} p-4`}>
            <p className="text-sm text-gray-500">Sem consultas anteriores.</p>
          </div>
        ) : (
          past.slice(0, 10).map((a) => (
            <div key={a.id} className={`${CARD} px-4 py-3 flex items-center justify-between`}>
              <p className="text-sm text-white">
                {fmtDate(a.date)}
                {a.time ? ` · ${String(a.time).slice(0, 5)}` : ''}
              </p>
              <span className="text-[11px] text-gray-500">{a.status === 'completed' ? 'Realizada' : a.status}</span>
            </div>
          ))
        )}
      </section>
    </div>
  );
}
