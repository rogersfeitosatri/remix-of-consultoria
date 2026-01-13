import { useNavigate } from 'react-router-dom';
import { ClipboardCheck, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';

interface AnamnesePendingBannerProps {
  anamneseCompleted: boolean;
}

export function AnamnesePendingBanner({ anamneseCompleted }: AnamnesePendingBannerProps) {
  const navigate = useNavigate();

  if (anamneseCompleted) {
    return (
      <Alert className="mb-6 bg-green-500/10 border-green-500/30">
        <ClipboardCheck className="h-4 w-4 text-green-500" />
        <AlertDescription className="text-green-400 flex items-center justify-between">
          <span>Anamnese concluída ✅</span>
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <Alert className="mb-6 bg-[hsl(43,74%,49%)]/10 border-[hsl(43,74%,49%)]/30">
      <AlertCircle className="h-4 w-4 text-[hsl(43,74%,49%)]" />
      <AlertDescription className="text-[hsl(43,74%,49%)] flex items-center justify-between flex-wrap gap-2">
        <span>Anamnese pendente — complete para liberar o agendamento da 1ª consulta</span>
        <Button
          size="sm"
          onClick={() => navigate('/athlete/anamnese')}
          className="bg-[hsl(43,74%,49%)] hover:bg-[hsl(43,74%,40%)] text-black font-bold"
        >
          <ClipboardCheck className="h-4 w-4 mr-1" />
          Preencher Anamnese
        </Button>
      </AlertDescription>
    </Alert>
  );
}
