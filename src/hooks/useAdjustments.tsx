import { useMemo } from 'react';
import { useClients, type Client } from './useClients';
import { useScheduledCheckins } from './useScheduledCheckins';
import {
  computeClientAdjustments,
  isAdjustmentTarget,
  type ClientAdjustment,
  type CheckinPoint,
} from '@/lib/adjustments';

export interface AdjustmentClient {
  client: Client;
  info: ClientAdjustment;
}

/**
 * Reúne os atletas-alvo de ajustes (consultoria, 0 ou 1 consulta) com o cálculo
 * das datas de ajuste a partir dos checkins programados.
 */
export function useAdjustments(fromDate: Date = new Date()) {
  const { data: clients = [], isLoading: clientsLoading } = useClients();
  const { data: checkins = [], isLoading: checkinsLoading } = useScheduledCheckins();

  const checkinsByClient = useMemo(() => {
    const map = new Map<string, CheckinPoint[]>();
    for (const ch of checkins) {
      const arr = map.get(ch.client_id) || [];
      arr.push({
        date: ch.scheduled_send_date,
        sent: ch.status === 'sent' || ch.status === 'completed',
      });
      map.set(ch.client_id, arr);
    }
    return map;
  }, [checkins]);

  const targets: AdjustmentClient[] = useMemo(() => {
    return clients
      .filter((c) => isAdjustmentTarget(c))
      .map((c) => ({
        client: c,
        info: computeClientAdjustments(checkinsByClient.get(c.id) || [], c.checkin_frequency, fromDate),
      }))
      .sort((a, b) => {
        // ordena por próxima data de ajuste (nulls por último)
        const an = a.info.nextAdjustment || '9999';
        const bn = b.info.nextAdjustment || '9999';
        if (an !== bn) return an < bn ? -1 : 1;
        return a.client.name.localeCompare(b.client.name);
      });
  }, [clients, checkinsByClient, fromDate]);

  /** Atletas cujo ajuste cai exatamente numa segunda (yyyy-MM-dd). */
  const dueOn = (mondayStr: string): AdjustmentClient[] =>
    targets.filter((t) => t.info.adjustmentDates.includes(mondayStr));

  return {
    targets,
    dueOn,
    isLoading: clientsLoading || checkinsLoading,
  };
}
