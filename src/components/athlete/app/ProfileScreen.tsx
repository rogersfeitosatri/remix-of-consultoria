import { LogOut, Scale, Ruler, Target, BadgeCheck, Mail, User as UserIcon, Bell, BellRing, Loader2 } from 'lucide-react';
import { usePushNotifications } from '@/hooks/usePushNotifications';

const GOLD = 'hsl(43,74%,49%)';

const SERVICE_LABEL: Record<string, string> = {
  nutrition: 'Nutrição',
  training: 'Treinamento',
  both: 'Nutrição + Treinamento',
};

function Row({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="flex items-center gap-3 px-4 py-3.5">
      <span className="text-gray-400">{icon}</span>
      <span className="text-sm text-gray-400 flex-1">{label}</span>
      <span className="text-sm text-white font-medium text-right">{value}</span>
    </div>
  );
}

export function ProfileScreen({
  client,
  profile,
  email,
  weightKg,
  readOnly,
  onSignOut,
}: {
  client: any;
  profile: any;
  email: string;
  weightKg?: number | null;
  readOnly?: boolean;
  onSignOut: () => void;
}) {
  const push = usePushNotifications();
  const initials = (client?.name || '?')
    .split(' ')
    .slice(0, 2)
    .map((s: string) => s[0])
    .join('')
    .toUpperCase();

  const height = profile?.height_cm ?? profile?.height ?? client?.height_cm;
  const objective = client?.goal ?? profile?.objective ?? profile?.goal;
  const plan = SERVICE_LABEL[client?.service_type] || '—';
  const planType = client?.plan_type === 'premium' ? 'Premium' : client?.plan_type === 'consultoria' ? 'Consultoria' : client?.plan_type;

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-col items-center pt-2">
        <div
          className="h-24 w-24 rounded-full flex items-center justify-center text-3xl font-extrabold text-black"
          style={{ background: `linear-gradient(135deg, ${GOLD}, #8a6d20)` }}
        >
          {initials}
        </div>
        <h1 className="text-xl font-extrabold text-white mt-3">{client?.name}</h1>
        <p className="text-sm text-gray-400">{email}</p>
        {planType && (
          <span className="mt-2 inline-flex items-center gap-1 rounded-full px-3 py-1 text-[11px] font-semibold" style={{ background: 'rgba(191,150,54,0.15)', color: GOLD }}>
            <BadgeCheck className="h-3.5 w-3.5" /> {planType}
          </span>
        )}
      </div>

      {/* Metrics */}
      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-3xl bg-[#131417] border border-gray-800 p-4 text-center">
          <Scale className="h-5 w-5 mx-auto text-purple-400 mb-1.5" />
          <p className="text-xl font-extrabold text-white">{weightKg ? `${weightKg}` : '—'}</p>
          <p className="text-[11px] text-gray-500">kg (peso atual)</p>
        </div>
        <div className="rounded-3xl bg-[#131417] border border-gray-800 p-4 text-center">
          <Ruler className="h-5 w-5 mx-auto text-blue-400 mb-1.5" />
          <p className="text-xl font-extrabold text-white">{height ? `${height}` : '—'}</p>
          <p className="text-[11px] text-gray-500">cm (altura)</p>
        </div>
      </div>

      {/* Details */}
      <div className="rounded-3xl bg-[#131417] border border-gray-800 divide-y divide-gray-800/60 overflow-hidden">
        <Row icon={<UserIcon className="h-4 w-4" />} label="Nome" value={client?.name || '—'} />
        <Row icon={<Mail className="h-4 w-4" />} label="E-mail" value={email || '—'} />
        <Row icon={<Target className="h-4 w-4" />} label="Objetivo" value={objective || '—'} />
        <Row icon={<BadgeCheck className="h-4 w-4" />} label="Plano contratado" value={plan} />
      </div>

      {/* Push notifications */}
      {!readOnly && (
        <div className="rounded-3xl bg-[#131417] border border-gray-800 p-4">
          <div className="flex items-start gap-3">
            <div className="h-10 w-10 rounded-2xl flex items-center justify-center shrink-0" style={{ background: 'rgba(191,150,54,0.15)', color: GOLD }}>
              {push.enabled ? <BellRing className="h-5 w-5" /> : <Bell className="h-5 w-5" />}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-white">Notificações push</p>
              <p className="text-xs text-gray-400 mt-0.5">
                {push.enabled
                  ? 'Ativas neste dispositivo. Você receberá lembretes de check-in, plano e mensagens do seu nutri.'
                  : 'Ative para receber lembretes de check-in, plano alimentar e avisos importantes.'}
              </p>
              {!push.supported && (
                <p className="text-[11px] text-yellow-500/80 mt-1">Este navegador/dispositivo não suporta notificações push.</p>
              )}
              {push.error && <p className="text-[11px] text-red-400 mt-1">{push.error}</p>}
            </div>
          </div>
          <button
            onClick={push.enable}
            disabled={push.status === 'loading' || !push.supported || push.enabled}
            className="mt-3 w-full h-11 rounded-2xl font-semibold flex items-center justify-center gap-2 active:scale-[0.98] transition-transform disabled:opacity-60"
            style={{
              background: push.enabled ? 'rgba(34,197,94,0.15)' : `linear-gradient(135deg, ${GOLD}, #8a6d20)`,
              color: push.enabled ? '#22c55e' : '#000',
            }}
          >
            {push.status === 'loading' ? (
              <><Loader2 className="h-4 w-4 animate-spin" /> Ativando...</>
            ) : push.enabled ? (
              <><BellRing className="h-4 w-4" /> Notificações ativas</>
            ) : (
              <><Bell className="h-4 w-4" /> Ativar notificações</>
            )}
          </button>
        </div>
      )}

      {!readOnly && (
        <button
          onClick={onSignOut}
          className="w-full h-12 rounded-2xl border border-red-500/30 bg-red-500/10 text-red-400 font-semibold flex items-center justify-center gap-2 active:scale-[0.98] transition-transform"
        >
          <LogOut className="h-5 w-5" /> Sair da conta
        </button>
      )}
    </div>
  );
}
