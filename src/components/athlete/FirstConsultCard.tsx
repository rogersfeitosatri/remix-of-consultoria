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
    <Card className="relative overflow-hidden bg-gradient-to-br from-[hsl(43,74%,49%)] via-[hsl(43,74%,45%)] to-[hsl(43,74%,35%)] border-0 mb-6 shadow-lg animate-pulse-glow">
      {/* Efeito de brilho */}
      <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent -translate-x-full animate-shimmer" />
      
      <CardContent className="relative py-6 px-6">
        <div className="flex flex-col gap-5">
          {/* Badge de destaque */}
          <div className="flex items-center gap-2">
            <Badge className="bg-black/20 text-white border-0 backdrop-blur-sm font-bold animate-bounce-subtle">
              ⭐ AÇÃO NECESSÁRIA
            </Badge>
          </div>
          
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="flex items-start gap-4">
              <div className="rounded-full bg-black/20 p-4 backdrop-blur-sm">
                <CalendarCheck className="h-8 w-8 text-white" />
              </div>
              <div>
                <h3 className="text-xl font-bold text-primary-foreground mb-1">
                  🎉 Agende sua 1ª Consulta!
                </h3>
                <p className="text-primary-foreground/80 text-sm max-w-md">
                  Sua anamnese foi recebida! Agora é hora de agendar sua primeira consulta para iniciarmos seu acompanhamento.
                </p>
              </div>
            </div>
            
            <Button
              asChild
              size="lg"
              className="bg-black hover:bg-gray-900 text-[hsl(43,74%,49%)] font-bold whitespace-nowrap shadow-xl hover:scale-105 transition-transform"
            >
              <a href={bookingUrl}>
                <Calendar className="h-5 w-5 mr-2" />
                Agendar Agora
                <ExternalLink className="h-4 w-4 ml-2" />
              </a>
            </Button>
          </div>

          {!status.isCalendarConnected && (
            <div className="mt-2 pt-4 border-t border-primary-foreground/20 flex items-center gap-2 text-primary-foreground/80 text-sm">
              <AlertTriangle className="h-4 w-4" />
              <span>Aguardando configuração do calendário pelo assessor.</span>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
