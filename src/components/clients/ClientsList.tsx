import { Client } from '@/hooks/useClients';
import { format, parseISO, differenceInDays } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Edit2, Trash2, Phone, Mail, Calendar, DollarSign, Brain, History, BadgeCheck, Zap } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useNavigate } from 'react-router-dom';

const SERVICE_LABELS = {
  nutrition: 'Nutrição',
  training: 'Treino',
  both: 'Ambos',
};

const PLAN_LABELS = {
  consultoria: 'Consultoria',
  premium: 'Premium',
};

const CHECKIN_LABELS = {
  daily: 'Diário',
  weekly: 'Semanal',
  biweekly: 'Quinzenal',
  monthly: 'Mensal',
  bimonthly: 'Bimestral',
  quarterly: 'Trimestral',
};

interface ClientsListProps {
  clients: Client[];
  onEdit: (client: Client) => void;
  onDelete: (id: string) => void;
}

export function ClientsList({ clients, onEdit, onDelete }: ClientsListProps) {
  const navigate = useNavigate();

  if (clients.length === 0) {
    return (
      <div className="glass-card rounded-xl p-12 text-center">
        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-muted">
          <span className="text-3xl">🏋️</span>
        </div>
        <h3 className="text-lg font-semibold text-card-foreground">Nenhum atleta cadastrado</h3>
        <p className="mt-2 text-sm text-muted-foreground">
          Comece adicionando seu primeiro atleta
        </p>
      </div>
    );
  }

  return (
    <div className="grid gap-4">
      {clients.map((client) => {
        const daysUntilExpiry = differenceInDays(parseISO(client.end_date), new Date());
        const isExpiring = daysUntilExpiry <= 30 && daysUntilExpiry >= 0;
        const isExpired = daysUntilExpiry < 0;

        return (
          <div
            key={client.id}
            className={cn(
              'glass-card rounded-xl p-5 transition-all hover:shadow-lg',
              !client.is_active && 'opacity-60'
            )}
          >
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              {/* Client Info */}
              <div className="flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="text-lg font-semibold text-card-foreground">{client.name}</h3>
                  {!client.is_active && (
                    <span className="alert-badge bg-muted text-muted-foreground">Inativo</span>
                  )}
                  {isExpired && client.is_active && (
                    <span className="alert-badge bg-destructive/10 text-destructive">Vencido</span>
                  )}
                  {isExpiring && client.is_active && (
                    <span className="alert-badge bg-warning/10 text-warning">
                      {daysUntilExpiry} dias restantes
                    </span>
                  )}
                </div>

                <div className="mt-2 flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
                  {client.email && (
                    <span className="inline-flex items-center gap-1">
                      <Mail className="h-3.5 w-3.5" />
                      {client.email}
                    </span>
                  )}
                  {client.phone && (
                    <span className="inline-flex items-center gap-1">
                      <Phone className="h-3.5 w-3.5" />
                      {client.phone}
                    </span>
                  )}
                </div>

                <div className="mt-3 flex flex-wrap gap-2">
                  <span className="inline-flex items-center rounded-md bg-primary/10 px-2.5 py-1 text-xs font-medium text-primary">
                    {SERVICE_LABELS[client.service_type]}
                  </span>
                  <span className="inline-flex items-center rounded-md bg-secondary px-2.5 py-1 text-xs font-medium text-secondary-foreground">
                    {PLAN_LABELS[client.plan_type]}
                  </span>
                  {client.has_checkin && client.checkin_frequency && (
                    <span className="inline-flex items-center rounded-md bg-success/10 px-2.5 py-1 text-xs font-medium text-success">
                      Check-in {CHECKIN_LABELS[client.checkin_frequency]}
                    </span>
                  )}
                  {/* Registration source badge */}
                  {client.registration_source === 'kiwify' && (
                    <span className="inline-flex items-center gap-1 rounded-md bg-purple-500/10 px-2.5 py-1 text-xs font-medium text-purple-500">
                      <Zap className="h-3 w-3" />
                      Kiwify
                    </span>
                  )}
                </div>
              </div>

              {/* Plan Details */}
              <div className="flex flex-wrap items-center gap-6 text-sm lg:justify-end">
                <div className="text-center">
                  <div className="flex items-center gap-1 text-muted-foreground">
                    <Calendar className="h-4 w-4" />
                    <span>Período</span>
                  </div>
                  <p className="mt-1 font-medium text-card-foreground">
                    {format(parseISO(client.start_date), 'dd/MM/yy', { locale: ptBR })} -{' '}
                    {format(parseISO(client.end_date), 'dd/MM/yy', { locale: ptBR })}
                  </p>
                </div>

                <div className="text-center">
                  <div className="flex items-center gap-1 text-muted-foreground">
                    <DollarSign className="h-4 w-4" />
                    <span>Valor Mensal</span>
                  </div>
                  <p className="mt-1 font-semibold text-card-foreground">
                    R$ {client.monthly_value.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                  </p>
                </div>

                {/* Actions */}
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => navigate(`/clients/${client.id}/history`)}
                    className="h-9 w-9"
                    title="Histórico de Check-ins"
                  >
                    <History className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => navigate(`/clients/${client.id}/analysis`)}
                    className="h-9 w-9"
                    title="Análise IA"
                  >
                    <Brain className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => onEdit(client)}
                    className="h-9 w-9"
                  >
                    <Edit2 className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => onDelete(client.id)}
                    className="h-9 w-9 text-destructive hover:bg-destructive hover:text-destructive-foreground"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
