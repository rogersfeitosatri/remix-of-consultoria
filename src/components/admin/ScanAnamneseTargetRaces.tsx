import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2, Search, Flag, CheckCircle2, ArrowRight } from 'lucide-react';
import { scanAndFillTargetRaces } from '@/lib/extractTargetRace';
import { toast } from 'sonner';
import { useQueryClient } from '@tanstack/react-query';

interface ScanResult {
  scanned: number;
  updated: number;
  details: { clientId: string; clientName: string; raceName: string }[];
}

export function ScanAnamneseTargetRaces() {
  const [scanning, setScanning] = useState(false);
  const [result, setResult] = useState<ScanResult | null>(null);
  const queryClient = useQueryClient();

  const handleScan = async () => {
    setScanning(true);
    setResult(null);
    try {
      const scanResult = await scanAndFillTargetRaces();
      setResult(scanResult);
      if (scanResult.updated > 0) {
        toast.success(`${scanResult.updated} atleta(s) atualizado(s) com prova alvo!`);
        queryClient.invalidateQueries({ queryKey: ['target-race-alert'] });
        queryClient.invalidateQueries({ queryKey: ['athletes-target-race-alerts'] });
      } else {
        toast.info('Nenhum atleta novo identificado com prova alvo na anamnese.');
      }
    } catch (error) {
      console.error('Scan error:', error);
      toast.error('Erro ao escanear anamneses.');
    } finally {
      setScanning(false);
    }
  };

  return (
    <Card className="border-primary/20">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <Search className="h-5 w-5 text-primary" />
          Varredura de Prova Alvo nas Anamneses
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground">
          Escaneia todas as anamneses preenchidas e identifica atletas que informaram uma prova alvo ou meta específica.
          Preenche automaticamente o campo "Prova Alvo" para quem ainda não tem configurado.
        </p>

        <Button onClick={handleScan} disabled={scanning} className="w-full">
          {scanning ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Escaneando anamneses...
            </>
          ) : (
            <>
              <Search className="h-4 w-4 mr-2" />
              Escanear Anamneses
            </>
          )}
        </Button>

        {result && (
          <div className="space-y-3">
            <div className="flex gap-3 text-sm">
              <Badge variant="outline">{result.scanned} atletas verificados</Badge>
              <Badge className="bg-primary/10 text-primary border-primary/20">
                {result.updated} atualizados
              </Badge>
            </div>

            {result.updated > 0 ? (
              <div className="space-y-2">
                <p className="text-sm font-medium">Atletas atualizados:</p>
                {result.details.map((d) => (
                  <Alert key={d.clientId} className="py-2">
                    <CheckCircle2 className="h-4 w-4 text-green-500" />
                    <AlertDescription className="flex items-center gap-2 text-sm">
                      <span className="font-medium">{d.clientName}</span>
                      <ArrowRight className="h-3 w-3 text-muted-foreground" />
                      <span className="flex items-center gap-1">
                        <Flag className="h-3 w-3 text-primary" />
                        {d.raceName}
                      </span>
                    </AlertDescription>
                  </Alert>
                ))}
              </div>
            ) : (
              <Alert>
                <AlertDescription className="text-sm text-muted-foreground">
                  Todos os atletas com prova alvo identificada na anamnese já estão configurados,
                  ou nenhuma anamnese contém informação de prova alvo.
                </AlertDescription>
              </Alert>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
