import { Calendar, CalendarCheck, ExternalLink, AlertTriangle } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useAthleteFirstConsultStatus } from '@/hooks/useAthleteFirstConsult';

interface FirstConsultCardProps {
  clientId: string;
}

export function FirstConsultCard({ clientId }: FirstConsultCardProps) {
  const { data: status, isLoading } = useAthleteFirstConsultStatus(clientId);

  if (isLoading) return null;
  if (!status?.showCard) return null;

  const bookingUrl = `/booking/${status.bookingToken}`;

  return (
    <Card className="bg-gradient-to-r from-[hsl(43,74%,49%)]/20 to-[hsl(43,74%,49%)]/5 border-[hsl(43,74%,49%)]/50 mb-6">
      <CardContent className="py-5">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="rounded-full bg-[hsl(43,74%,49%)]/20 p-3">
              <CalendarCheck className="h-6 w-6 text-[hsl(43,74%,49%)]" />
            </div>
            <div>
              <div className="flex items-center gap-2 mb-1">
                <h3 className="text-lg font-semibold text-white">
                  Agende sua 1ª consulta
                </h3>
                <Badge className="bg-[hsl(43,74%,49%)]/20 text-[hsl(43,74%,49%)] border-[hsl(43,74%,49%)]/30">
                  Novo plano
                </Badge>
              </div>
              <p className="text-gray-400 text-sm">
                Sua primeira consulta do plano atual está disponível para agendamento.
              </p>
            </div>
          </div>
          
          <Button
            asChild
            className="bg-[hsl(43,74%,49%)] hover:bg-[hsl(43,74%,40%)] text-black font-semibold whitespace-nowrap"
          >
            <a href={bookingUrl}>
              <Calendar className="h-4 w-4 mr-2" />
              Agendar agora
            </a>
          </Button>
        </div>

        {!status.isCalendarConnected && (
          <div className="mt-4 pt-4 border-t border-[hsl(43,74%,49%)]/20 flex items-center gap-2 text-amber-400 text-sm">
            <AlertTriangle className="h-4 w-4" />
            <span>Configuração pendente: seu assessor precisa conectar o Google Calendar.</span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
