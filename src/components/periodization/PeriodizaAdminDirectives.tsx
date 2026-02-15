import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Save, RotateCcw, Settings2, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from '@/hooks/use-toast';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

const PRESETS: Record<string, string> = {
  conservador: `Priorize segurança e progressão gradual. Nunca use jejum estratégico em atletas com EA <35. Prefira micro ajustes a cada consulta. Mantenha CHO moderado mesmo na base.`,
  performance_agressiva: `Priorize performance e treino intestinal agressivo. Maximize train-low na fase de base. Progressão rápida de CHO intra (40→90 g/h). Carb loading 48h em todas as provas. Cafeína ≥3mg/kg obrigatória.`,
  emagrecimento_seguro: `Priorize déficit calórico controlado sem comprometer treinos-chave. EA nunca abaixo de 30. Evite jejum estratégico em mulheres. Mantenha proteína ≥2.0 g/kg. Suporte total nos longões.`,
  personalizado: '',
};

const DEFAULT_INSTRUCTIONS = `Priorize performance e treino intestinal. Para atletas com longão domingo, faça carb-loading 24h no sábado. Prefiro ajustes mensais (micro mudanças) mesmo em planos trimestrais. Se EA <30, corrigir antes de aumentar train-low.`;

export function PeriodizaAdminDirectives() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [instructions, setInstructions] = useState('');
  const [selectedPreset, setSelectedPreset] = useState('personalizado');

  const { data: savedInstructions } = useQuery({
    queryKey: ['periodiza-admin-instructions', user?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from('periodiza_admin_instructions')
        .select('*')
        .eq('user_id', user!.id)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      return data;
    },
    enabled: !!user?.id,
  });

  useEffect(() => {
    if (savedInstructions) {
      setInstructions(savedInstructions.instructions || '');
      setSelectedPreset(savedInstructions.preset_name || 'personalizado');
    }
  }, [savedInstructions]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (savedInstructions?.id) {
        const { error } = await supabase
          .from('periodiza_admin_instructions')
          .update({ instructions, preset_name: selectedPreset, updated_at: new Date().toISOString() })
          .eq('id', savedInstructions.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('periodiza_admin_instructions')
          .insert({ user_id: user!.id, instructions, preset_name: selectedPreset });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['periodiza-admin-instructions'] });
      toast({ title: 'Diretrizes salvas com sucesso' });
    },
    onError: (err: any) => toast({ title: 'Erro', description: err.message, variant: 'destructive' }),
  });

  const handlePresetChange = (preset: string) => {
    setSelectedPreset(preset);
    if (preset !== 'personalizado' && PRESETS[preset]) {
      setInstructions(PRESETS[preset]);
    }
  };

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm flex items-center gap-2">
            <Settings2 className="h-4 w-4" /> Diretrizes do Admin
          </CardTitle>
          <div className="flex items-center gap-2">
            <Select value={selectedPreset} onValueChange={handlePresetChange}>
              <SelectTrigger className="h-7 text-xs w-44">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="conservador">🛡️ Conservador</SelectItem>
                <SelectItem value="performance_agressiva">⚡ Performance Agressiva</SelectItem>
                <SelectItem value="emagrecimento_seguro">🎯 Emagrecimento Seguro</SelectItem>
                <SelectItem value="personalizado">✏️ Personalizado</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <Textarea
          value={instructions}
          onChange={(e) => setInstructions(e.target.value)}
          rows={5}
          className="text-xs"
          placeholder="Insira as instruções que o agente Periodiza deve seguir ao gerar sugestões..."
        />
        <div className="flex gap-2">
          <Button size="sm" onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending} className="gap-1 text-xs h-7">
            {saveMutation.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <Save className="h-3 w-3" />}
            Salvar diretrizes
          </Button>
          <Button variant="outline" size="sm" onClick={() => { setInstructions(DEFAULT_INSTRUCTIONS); setSelectedPreset('personalizado'); }} className="gap-1 text-xs h-7">
            <RotateCcw className="h-3 w-3" /> Restaurar padrão
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
