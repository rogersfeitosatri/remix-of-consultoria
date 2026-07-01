// Tipos de notificação que o nutricionista pode ativar/desativar.
// As chaves são compartilhadas com as edge functions que enviam o push.

export interface NotificationType {
  key: string;
  label: string;
  description: string;
}

export const NOTIFICATION_TYPES: NotificationType[] = [
  {
    key: 'anamnese_submitted',
    label: 'Anamnese preenchida',
    description: 'Quando um atleta envia (ou atualiza) a anamnese.',
  },
  {
    key: 'checkin_submitted',
    label: 'Check-in preenchido',
    description: 'Quando um atleta responde um check-in.',
  },
  {
    key: 'adjustment_due',
    label: 'Ajustes do mês',
    description: 'Toda segunda, atletas que fecham o bloco mensal e precisam de ajuste no plano.',
  },
  {
    key: 'new_booking',
    label: 'Novo agendamento',
    description: 'Quando um atleta agenda uma consulta ou call.',
  },
  {
    key: 'payment_due',
    label: 'Pagamentos a vencer/vencidos',
    description: 'Lembretes de planos vencendo ou pagamentos em atraso.',
  },
  {
    key: 'plan_expiring',
    label: 'Planos expirando',
    description: 'Quando um plano de atleta está próximo do fim.',
  },
];

export type NotificationPreferences = Record<string, boolean>;

/** Preferências padrão: tudo ativado. */
export function defaultNotificationPreferences(): NotificationPreferences {
  return NOTIFICATION_TYPES.reduce((acc, t) => {
    acc[t.key] = true;
    return acc;
  }, {} as NotificationPreferences);
}

/** Mescla o que está salvo com os padrões (chaves novas entram como ativadas). */
export function mergeNotificationPreferences(saved: Partial<NotificationPreferences> | null | undefined): NotificationPreferences {
  const base = defaultNotificationPreferences();
  if (saved) {
    for (const k of Object.keys(base)) {
      if (typeof saved[k] === 'boolean') base[k] = saved[k] as boolean;
    }
  }
  return base;
}
