import { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { useTemperaturaPacientes, Temperatura } from '@/hooks/useTemperaturaPacientes';
import { useNavigate } from 'react-router-dom';
import { Phone, Calendar, RefreshCw, Thermometer } from 'lucide-react';

const TEMP_DOT: Record<Temperatura, string> = {
  frio:   'bg-red-500',
  morno:  'bg-yellow-400',
  quente: 'bg-green-500',
};

const TEMP_LABEL: Record<Temperatura, string> = {
  frio:   'Frios',
  morno:  'Mornos',
  quente: 'Quentes',
};

const ACAO_LABEL: Record<string, string> = {
  mensagem: 'Mensagem',
  agendar:  'Agendar',
  renovar:  'Renovar',
};

function openWhatsApp(phone: string) {
  const digits = phone.replace(/\D/g, '');
  const withDDI = digits.startsWith('55') ? digits : `55${digits}`;
  window.open(`https://wa.me/${withDDI}`, '_blank');
}

export function BlocoTemperatura() {
  const navigate = useNavigate();
  const { data: pacientes = [], isLoading } = useTemperaturaPacientes();
  const [filtroTemp, setFiltroTemp] = useState<Temperatura | null>(null);

  const frios   = pacientes.filter(p => p.temperatura === 'frio');
  const mornos  = pacientes.filter(p => p.temperatura === 'morno');
  const quentes = pacientes.filter(p => p.temperatura === 'quente');

  const listagem = pacientes.filter(p =>
    p.temperatura !== 'quente' &&
    (filtroTemp === null || p.temperatura === filtroTemp)
  );

  if (isLoading) return <Skeleton className="h-48 w-full rounded-xl" />;

  return (
    <TooltipProvider>
      <div className="space-y-4">
        {/* Header */}
        <div>
          <h2 className="text-base font-semibold text-foreground flex items-center gap-2">
            <Thermometer className="h-4 w-4 text-primary" />
            Temperatura da Consultoria
          </h2>
          <p className="text-xs text-muted-foreground">Radar de retenção — classifica pacientes pelo pior sinal ativo</p>
        </div>

        {/* Legend */}
        <p className="text-[10px] text-muted-foreground">
          <span className="text-green-500 font-medium">● em dia</span>
          {'  '}
          <span className="text-yellow-400 font-medium">● atenção</span>
          {'  '}
          <span className="text-red-500 font-medium">● risco</span>
        </p>

        {/* Counter row */}
        <div className="flex gap-3 flex-wrap">
          {(
            [
              { temp: 'frio' as Temperatura, list: frios, emoji: '🔴' },
              { temp: 'morno' as Temperatura, list: mornos, emoji: '🟡' },
              { temp: 'quente' as Temperatura, list: quentes, emoji: '🟢' },
            ] as const
          ).map(({ temp, list, emoji }) => (
            <button
              key={temp}
              onClick={() => setFiltroTemp(prev => prev === temp ? null : temp)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border transition-colors text-sm ${
                filtroTemp === temp
                  ? temp === 'frio'
                    ? 'bg-red-500/10 border-red-500/40 text-red-400'
                    : temp === 'morno'
                    ? 'bg-yellow-400/10 border-yellow-400/40 text-yellow-400'
                    : 'bg-green-500/10 border-green-500/40 text-green-400'
                  : 'bg-muted/30 border-border/50 text-muted-foreground hover:bg-muted/50'
              }`}
            >
              <span>{emoji}</span>
              <span className="font-semibold">{list.length}</span>
              <span className="text-xs">{TEMP_LABEL[temp].toLowerCase()}</span>
            </button>
          ))}
        </div>

        {/* Action list */}
        {listagem.length === 0 ? (
          <Card className="border-green-500/20 bg-green-500/5">
            <CardContent className="p-5 text-center">
              <p className="text-sm font-medium text-green-400">Todos os pacientes em dia 🟢</p>
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardContent className="p-0">
              <div className="divide-y divide-border/50 max-h-[400px] overflow-y-auto">
                {listagem.map(p => (
                  <div
                    key={p.client_id}
                    className="flex items-center gap-3 px-4 py-3 hover:bg-muted/20 transition-colors"
                  >
                    {/* Temperature dot */}
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <div className={`h-2.5 w-2.5 rounded-full flex-shrink-0 cursor-default ${TEMP_DOT[p.temperatura]}`} />
                      </TooltipTrigger>
                      <TooltipContent side="right">
                        <p className="text-xs">{p.motivo}</p>
                      </TooltipContent>
                    </Tooltip>

                    {/* Name + reason */}
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold text-foreground truncate">{p.nome}</p>
                      <p className="text-[10px] text-muted-foreground truncate">{p.motivo}</p>
                    </div>

                    {/* Action button */}
                    <div className="flex items-center gap-1 flex-shrink-0">
                      {p.phone && p.acao === 'mensagem' && (
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7 px-2 text-xs gap-1"
                          onClick={() => openWhatsApp(p.phone!)}
                        >
                          <Phone className="h-3 w-3" />
                          Mensagem
                        </Button>
                      )}
                      {p.acao === 'agendar' && (
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7 px-2 text-xs gap-1"
                          onClick={() => navigate(`/clients/${p.client_id}?tab=pipeline`)}
                        >
                          <Calendar className="h-3 w-3" />
                          Agendar
                        </Button>
                      )}
                      {p.acao === 'renovar' && (
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7 px-2 text-xs gap-1"
                          onClick={() => navigate(`/clients/${p.client_id}`)}
                        >
                          <RefreshCw className="h-3 w-3" />
                          Renovar
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </TooltipProvider>
  );
}
