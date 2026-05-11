import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { User, Target, Save, Loader2, Trash2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useAthleteProfile } from '@/hooks/useUserRole';
import { useQueryClient } from '@tanstack/react-query';
import { ChangePasswordForm } from './ChangePasswordForm';

interface AthleteProfileSectionProps {
  clientId: string;
  clientName: string;
}

export function AthleteProfileSection({ clientId, clientName }: AthleteProfileSectionProps) {
  const { data: profile, isLoading } = useAthleteProfile(clientId);
  const queryClient = useQueryClient();
  
  const [targetRace, setTargetRace] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (profile?.target_race) {
      setTargetRace(profile.target_race);
    }
  }, [profile?.target_race]);

  const handleSaveTargetRace = async () => {
    setSaving(true);
    try {
      const { error } = await supabase
        .from('athlete_profiles')
        .update({ target_race: targetRace })
        .eq('client_id', clientId);

      if (error) throw error;

      toast.success('Prova alvo atualizada com sucesso!');
      queryClient.invalidateQueries({ queryKey: ['athlete_profile', clientId] });
    } catch (error: any) {
      console.error('Error saving target race:', error);
      toast.error('Erro ao salvar prova alvo');
    } finally {
      setSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Profile Info */}
      <Card className="bg-gray-900 border-gray-800">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-white">
            <User className="h-5 w-5 text-[hsl(43,74%,49%)]" />
            Meu Perfil
          </CardTitle>
          <CardDescription className="text-gray-400">
            Suas informações pessoais
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label className="text-gray-400">Nome</Label>
            <div className="p-3 rounded-lg bg-gray-800 border border-gray-700">
              <p className="text-white font-medium">{clientName}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Target Race */}
      <Card className="bg-gray-900 border-gray-800">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-white">
            <Target className="h-5 w-5 text-[hsl(43,74%,49%)]" />
            Prova Alvo
          </CardTitle>
          <CardDescription className="text-gray-400">
            Qual é sua próxima prova ou objetivo?
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="targetRace" className="text-gray-400">Nome da prova / evento</Label>
            <Input
              id="targetRace"
              value={targetRace}
              onChange={(e) => setTargetRace(e.target.value)}
              placeholder="Ex: Maratona de São Paulo 2026"
              className="bg-gray-800 border-gray-700 text-white placeholder:text-gray-500"
            />
          </div>
          <Button 
            onClick={handleSaveTargetRace} 
            disabled={saving}
            className="bg-[hsl(43,74%,49%)] hover:bg-[hsl(43,74%,40%)] text-primary-foreground"
          >
            {saving ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Salvando...
              </>
            ) : (
              <>
                <Save className="h-4 w-4 mr-2" />
                Salvar Prova Alvo
              </>
            )}
          </Button>
        </CardContent>
      </Card>

      {/* Change Password */}
      <div className="[&_*]:text-white [&_.card]:bg-gray-900 [&_.card]:border-gray-800 [&_input]:bg-gray-800 [&_input]:border-gray-700 [&_input]:text-white [&_input]:placeholder:text-gray-500 [&_button[type='submit']]:bg-[hsl(43,74%,49%)] [&_button[type='submit']]:hover:bg-[hsl(43,74%,40%)] [&_button[type='submit']]:text-primary-foreground">
        <ChangePasswordForm />
      </div>
    </div>
  );
}
