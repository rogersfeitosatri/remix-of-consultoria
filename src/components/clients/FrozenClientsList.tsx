import { Client } from '@/hooks/useClients';
import { useFreezePlan } from '@/hooks/useFreezePlan';
import { format, parseISO, differenceInCalendarDays } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Snowflake, Calendar, Clock, Play, Phone, Mail, DollarSign } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useNavigate } from 'react-router-dom';

const PLAN_LABELS: Record<string, string> = {
  consultoria: 'Consultoria',
  premium: 'Premium',
};

const SERVICE_LABELS: Record<string, string> = {
  nutrition: 'Nutrição',
  training: 'Treino',
  both: 'Ambos',
};

interface FrozenClientsListProps {
  clients: Client[];
  onEdit: (client: Client) => void;
  onDelete: (id: string) => void;
}

export function FrozenClientsList({ clients, onEdit, onDelete }: FrozenClientsListProps) {
  const navigate = useNavigate();
  const { unfreezeMutation } = useFreezePlan();

  const handleUnfreeze = (e: React.MouseEvent, client: Client) => {
    e.stopPropagation();
    if (!client.frozen_at) return;
    if (!confirm(`Deseja reativar o plano de ${client.name}?`)) return;
    unfreezeMutation.mutate({
      clientId: client.id,
      frozenAt: client.frozen_at,
      currentEndDate: client.end_date,
    });
  };

  if (clients.length === 0) {
    return (
      <div className="glass-card rounded-xl p-12 text-center">
        <Snowflake className="h-16 w-16 mx-auto mb-4 text-muted-foreground opacity-50" />
        <h3 className="text-lg font-semibold text-card-foreground">Nenhum atleta congelado</h3>
        <p className="mt-2 text-sm text-muted-foreground">
          Planos congelados aparecerão aqui
        </p>
      </div>
    );
  }

  return (
    <div className="grid gap-4">
      {clients.map((client) => {
        const frozenAt = client.frozen_at ? parseISO(client.frozen_at) : null;
        const daysFrozenNow = frozenAt
          ? differenceInCalendarDays(new Date(), frozenAt)
          : 0;
        const totalFrozenDays = (client.total_frozen_days || 0) + daysFrozenNow;

        return (
          <div
            key={client.id}
            className="glass-card rounded-xl p-5 transition-all hover:shadow-lg cursor-pointer border-l-4 border-l-blue-400/70"
            onClick={() => navigate(`/clients/${client.id}`)}
          >
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
              {/* Info */}
              <div className="flex-1 space-y-3">
                <div className="flex flex-wrap items-center gap-2">
                  <Snowflake className="h-4 w-4 text-blue-400" />
                  <h3 className="text-lg font-semibold text-card-foreground">{client.name}</h3>
                  <Badge variant="secondary" className="bg-blue-500/10 text-blue-500 border-blue-500/30">
                    Congelado
                  </Badge>
                </div>

                <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
                  {client.email && (
                    <span className="inline-flex items-center gap-1">
                      <Mail className="h-3.5 w-3.5" /> {client.email}
                    </span>
                  )}
                  {client.phone && (
                    <span className="inline-flex items-center gap-1">
                      <Phone className="h-3.5 w-3.5" /> {client.phone}
                    </span>
                  )}
                </div>

                <div className="flex flex-wrap gap-2">
                  <span className="inline-flex items-center rounded-md bg-primary/10 px-2.5 py-1 text-xs font-medium text-primary">
                    {SERVICE_LABELS[client.service_type]}
                  </span>
                  <span className="inline-flex items-center rounded-md bg-secondary px-2.5 py-1 text-xs font-medium text-secondary-foreground">
                    {PLAN_LABELS[client.plan_type]}
                  </span>
                </div>
              </div>

              {/* Freeze details */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm">
                <div className="text-center">
                  <div className="flex items-center justify-center gap-1 text-muted-foreground mb-1">
                    <Snowflake className="h-3.5 w-3.5" />
                    <span className="text-xs">Congelado em</span>
                  </div>
                  <p className="font-semibold text-card-foreground">
                    {frozenAt ? format(frozenAt, 'dd/MM/yy', { locale: ptBR }) : '—'}
                  </p>
                </div>

                <div className="text-center">
                  <div className="flex items-center justify-center gap-1 text-muted-foreground mb-1">
                    <Clock className="h-3.5 w-3.5" />
                    <span className="text-xs">Dias congelado</span>
                  </div>
                  <p className="font-semibold text-blue-500 text-lg">
                    {daysFrozenNow}
                  </p>
                </div>

                <div className="text-center">
                  <div className="flex items-center justify-center gap-1 text-muted-foreground mb-1">
                    <Calendar className="h-3.5 w-3.5" />
                    <span className="text-xs">Término atual</span>
                  </div>
                  <p className="font-medium text-card-foreground">
                    {format(parseISO(client.end_date), 'dd/MM/yy', { locale: ptBR })}
                  </p>
                </div>

                <div className="text-center">
                  <div className="flex items-center justify-center gap-1 text-muted-foreground mb-1">
                    <DollarSign className="h-3.5 w-3.5" />
                    <span className="text-xs">Total congelado</span>
                  </div>
                  <p className="font-medium text-muted-foreground">
                    {totalFrozenDays} dias
                  </p>
                </div>
              </div>

              {/* Freeze reason */}
              {(client as any).freeze_reason && (
                <div className="text-sm text-muted-foreground bg-muted/50 rounded-md px-3 py-2 mt-1">
                  <span className="font-medium text-card-foreground">Motivo:</span> {(client as any).freeze_reason}
                </div>
              )}
              {/* Unfreeze action */}
              <div className="flex items-center" onClick={(e) => e.stopPropagation()}>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={(e) => handleUnfreeze(e, client)}
                  disabled={unfreezeMutation.isPending}
                  className="gap-1.5 text-xs border-green-500/30 text-green-600 hover:bg-green-500/10 hover:text-green-600"
                >
                  <Play className="h-3.5 w-3.5" />
                  {unfreezeMutation.isPending ? 'Reativando...' : 'Reativar'}
                </Button>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
