/**
 * ETAPA 5C — Check-ins do atleta.
 * Fontes canônicas: checkin_dispatches (evidência de envio), checkin_responses (resposta)
 * e checkin_feedbacks (apenas publication_status = 'published').
 */
import { useEffect } from 'react';
import { ClipboardCheck, ExternalLink, MessageSquareText, Clock } from 'lucide-react';
import { markSeen } from '@/hooks/useAthleteArea';
import type { useAthleteAreaData } from '@/hooks/useAthleteArea';

const GOLD = 'hsl(43,74%,49%)';
const CARD = 'rounded-2xl bg-[#131417] border border-white/[0.06]';

type Data = NonNullable<ReturnType<typeof useAthleteAreaData>['data']>;

function fmt(d?: string | null) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('pt-BR');
}

export function CheckinsScreen({
  data,
  clientId,
  blockedReason,
}: {
  data?: Data;
  clientId?: string | null;
  blockedReason?: string | null;
}) {
  useEffect(() => {
    markSeen(clientId, 'feedback');
  }, [clientId]);

  const pending = data?.pendingCheckin;
  const feedbacks = data?.feedbacks || [];
  const history = (data?.checkinHistory || []).filter((d: any) => d.status === 'sent' || d.status === 'answered');

  return (
    <div className="space-y-5">
      <h1 className="text-xl font-extrabold text-white">Check-ins</h1>

      {blockedReason && (
        <div className="rounded-2xl border border-amber-500/30 bg-amber-500/10 p-4">
          <p className="text-sm text-amber-200">{blockedReason}</p>
        </div>
      )}

      {!blockedReason && pending && (
        <div className={`${CARD} p-4`} style={{ borderColor: 'rgba(191,150,54,0.35)' }}>
          <div className="flex items-center gap-2 mb-1.5">
            <ClipboardCheck className="h-4 w-4" style={{ color: GOLD }} />
            <span className="text-[11px] uppercase tracking-wide font-semibold" style={{ color: GOLD }}>
              {pending.isLate ? 'Check-in atrasado' : 'Check-in disponível'}
            </span>
          </div>
          <p className="text-white font-bold">
            {pending.occurrenceDate ? `Ciclo de ${fmt(pending.occurrenceDate)}` : 'Responda seu check-in'}
          </p>
          {pending.dueAt && (
            <p className="text-xs text-gray-400 mt-1 flex items-center gap-1.5">
              <Clock className="h-3 w-3" /> Prazo: {fmt(pending.dueAt)}
            </p>
          )}
          {pending.link ? (
            <a
              href={pending.link}
              target="_blank"
              rel="noreferrer"
              className="mt-3 inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold text-black"
              style={{ background: GOLD }}
            >
              Responder agora <ExternalLink className="h-3.5 w-3.5" />
            </a>
          ) : (
            <p className="text-xs text-gray-500 mt-2">Link em preparação. Você será avisado pelo WhatsApp.</p>
          )}
        </div>
      )}

      {!blockedReason && !pending && (
        <div className={`${CARD} p-4`}>
          <p className="text-white font-semibold">Nenhum check-in pendente</p>
          <p className="text-sm text-gray-500 mt-1">Você receberá o próximo no prazo combinado.</p>
        </div>
      )}

      <section className="space-y-2.5">
        <h2 className="text-sm font-semibold text-gray-400 px-1">Feedbacks do nutricionista</h2>
        {feedbacks.length === 0 ? (
          <div className={`${CARD} p-4`}>
            <p className="text-sm text-gray-500">Ainda sem feedback publicado.</p>
          </div>
        ) : (
          feedbacks.map((f) => (
            <div key={f.id} className={`${CARD} p-4`}>
              <div className="flex items-center gap-2 mb-2 text-gray-400">
                <MessageSquareText className="h-4 w-4" style={{ color: GOLD }} />
                <span className="text-xs">{fmt(f.publishedAt)}</span>
              </div>
              <p className="text-sm text-gray-100 whitespace-pre-wrap leading-relaxed">{f.text}</p>
            </div>
          ))
        )}
      </section>

      <section className="space-y-2.5">
        <h2 className="text-sm font-semibold text-gray-400 px-1">Histórico de envios</h2>
        {history.length === 0 ? (
          <div className={`${CARD} p-4`}>
            <p className="text-sm text-gray-500">Nenhum check-in enviado ainda.</p>
          </div>
        ) : (
          history.map((d: any) => (
            <div key={d.id} className={`${CARD} px-4 py-3 flex items-center justify-between`}>
              <div>
                <p className="text-sm text-white">{fmt(d.occurrence_date || d.sent_at)}</p>
                <p className="text-[11px] text-gray-500">
                  {d.status === 'answered' ? 'Respondido' : 'Enviado'}
                </p>
              </div>
            </div>
          ))
        )}
      </section>
    </div>
  );
}
