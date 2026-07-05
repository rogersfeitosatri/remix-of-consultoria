import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useAthleteClient } from '@/hooks/useUserRole';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { PhoneInput } from '@/components/ui/phone-input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Progress } from '@/components/ui/progress';
import { useToast } from '@/hooks/use-toast';
import { PersonStanding, ArrowLeft, ArrowRight, Check, Loader2, Plus, Trash2, CalendarDays } from 'lucide-react';
import { MealRoutineSection, defaultMealRoutineData } from '@/components/anamnese/MealRoutineSection';
import { TrainingWeekSection, defaultTrainingWeekData, TrainingWeekData } from '@/components/anamnese/TrainingWeekSection';

// Section definitions
const sections = [
  { id: 'dados_pessoais', title: 'Dados Pessoais', icon: '👤' },
  { id: 'rotina_trabalho', title: 'Rotina e Trabalho', icon: '💼' },
  { id: 'historico_corrida', title: 'Histórico de Corrida', icon: '🏃' },
  { id: 'rotina_treino', title: 'Rotina de Treinos', icon: '🏋️' },
  { id: 'objetivo', title: 'Objetivo Principal', icon: '🎯' },
  { id: 'medidas', title: 'Peso, Altura e Histórico', icon: '📏' },
  { id: 'sono_estresse', title: 'Sono e Estresse', icon: '😴' },
  { id: 'historico_dietas', title: 'Histórico de Dietas', icon: '📋' },
  { id: 'suplementacao', title: 'Suplementação Atual', icon: '💊' },
  { id: 'intestinal', title: 'Sensibilidade Intestinal', icon: '🫃' },
  { id: 'restricoes', title: 'Restrições Alimentares', icon: '🚫' },
  { id: 'rotina_alimentar', title: 'Rotina Alimentar Atual', icon: '🍽️' },
];

interface FormData {
  // Dados Pessoais
  nome_completo: string;
  data_nascimento: string;
  genero: string;
  telefone: string;
  cidade_estado: string;

  // Rotina e Trabalho
  profissao: string;
  horario_trabalho: string;
  trabalho_sedentario: string;
  horas_sentado: string;
  nivel_atividade_diaria: string;

  // Rotina de Treino
  rotina_treino: TrainingWeekData;

  // Histórico de Corrida
  pratica_corrida: string;
  tempo_pratica: string;
  frequencia_semanal: string;
  volume_semanal_km: string;
  provas_participadas: string;
  lesoes_historico: string;
  modalidades_treino: Array<{ modalidade: string; dia: string; horario: string }>;

  // Objetivo Principal
  objetivo_principal: string;
  objetivo_secundario: string;
  meta_especifica: string;
  prazo_meta: string;
  tem_prova_alvo: string;
  prova_alvo_nome: string;
  prova_alvo_data: string;

  // Medidas
  peso_atual: string;
  altura: string;
  peso_ideal: string;
  maior_peso: string;
  menor_peso_adulto: string;
  circunferencia_cintura: string;
  circunferencia_quadril: string;

  // Sono e Estresse
  horas_sono: string;
  qualidade_sono: string;
  horario_dormir: string;
  horario_acordar: string;
  nivel_estresse: string;
  causa_estresse: string;

  // Histórico de Dietas
  fez_dieta_antes: string;
  dietas_anteriores: string;
  motivo_parou_dieta: string;
  acompanhamento_nutricional: string;

  // Suplementação
  usa_suplementos: string;
  suplementos_atuais: string;
  ja_usou_suplementos: string;
  suplementos_passados: string;

  // Intestinal
  funcionamento_intestinal: string;
  frequencia_evacuacao: string;
  problemas_intestinais: string[];
  problemas_intestinais_outros: string;

  // Restrições
  alergias_alimentares: string;
  intolerancia_lactose: string;
  intolerancia_gluten: string;
  restricao_religiosa: string;
  alimentos_nao_gosta: string;
  alimentos_favoritos: string;

  // Rotina Alimentar
  rotina_alimentar: typeof defaultMealRoutineData;
}

const defaultFormData: FormData = {
  nome_completo: '',
  data_nascimento: '',
  genero: '',
  telefone: '',
  cidade_estado: '',
  profissao: '',
  horario_trabalho: '',
  trabalho_sedentario: '',
  horas_sentado: '',
  nivel_atividade_diaria: '',
  rotina_treino: defaultTrainingWeekData,
  pratica_corrida: '',
  tempo_pratica: '',
  frequencia_semanal: '',
  volume_semanal_km: '',
  provas_participadas: '',
  lesoes_historico: '',
  modalidades_treino: [],
  objetivo_principal: '',
  objetivo_secundario: '',
  meta_especifica: '',
  prazo_meta: '',
  tem_prova_alvo: '',
  prova_alvo_nome: '',
  prova_alvo_data: '',
  peso_atual: '',
  altura: '',
  peso_ideal: '',
  maior_peso: '',
  menor_peso_adulto: '',
  circunferencia_cintura: '',
  circunferencia_quadril: '',
  horas_sono: '',
  qualidade_sono: '',
  horario_dormir: '',
  horario_acordar: '',
  nivel_estresse: '',
  causa_estresse: '',
  fez_dieta_antes: '',
  dietas_anteriores: '',
  motivo_parou_dieta: '',
  acompanhamento_nutricional: '',
  usa_suplementos: '',
  suplementos_atuais: '',
  ja_usou_suplementos: '',
  suplementos_passados: '',
  funcionamento_intestinal: '',
  frequencia_evacuacao: '',
  problemas_intestinais: [],
  problemas_intestinais_outros: '',
  alergias_alimentares: '',
  intolerancia_lactose: '',
  intolerancia_gluten: '',
  restricao_religiosa: '',
  alimentos_nao_gosta: '',
  alimentos_favoritos: '',
  rotina_alimentar: defaultMealRoutineData,
};

export default function AthleteAnamneseForm() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user } = useAuth();
  const { data: client } = useAthleteClient();

  const [currentSection, setCurrentSection] = useState(0);
  const [formData, setFormData] = useState<FormData>(defaultFormData);
  const [errors, setErrors] = useState<Record<string, any>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Pre-fill with client data
  useEffect(() => {
    if (client) {
      setFormData((prev) => ({
        ...prev,
        nome_completo: client.name || '',
        telefone: client.phone || '',
      }));
    }
  }, [client]);

  const validateSection = (sectionIndex: number): boolean => {
    const newErrors: Record<string, any> = {};

    switch (sections[sectionIndex].id) {
      case 'dados_pessoais':
        if (!formData.nome_completo.trim()) newErrors.nome_completo = 'Campo obrigatório';
        if (!formData.data_nascimento) newErrors.data_nascimento = 'Campo obrigatório';
        if (!formData.genero) newErrors.genero = 'Campo obrigatório';
        break;

      case 'rotina_trabalho':
        if (!formData.profissao.trim()) newErrors.profissao = 'Campo obrigatório';
        if (!formData.trabalho_sedentario) newErrors.trabalho_sedentario = 'Campo obrigatório';
        if (!formData.nivel_atividade_diaria) newErrors.nivel_atividade_diaria = 'Campo obrigatório';
        break;

      case 'rotina_treino':
        // Não obrigatório — atleta pode deixar dias em branco
        break;

      case 'historico_corrida':
        if (!formData.pratica_corrida) newErrors.pratica_corrida = 'Campo obrigatório';
        break;

      case 'objetivo':
        if (!formData.objetivo_principal) newErrors.objetivo_principal = 'Campo obrigatório';
        if (formData.tem_prova_alvo === 'sim') {
          if (!formData.prova_alvo_nome.trim()) newErrors.prova_alvo_nome = 'Informe o nome da prova';
          if (!formData.prova_alvo_data) newErrors.prova_alvo_data = 'Informe a data da prova';
        }
        break;

      case 'medidas':
        if (!formData.peso_atual) newErrors.peso_atual = 'Campo obrigatório';
        if (!formData.altura) newErrors.altura = 'Campo obrigatório';
        break;

      case 'sono_estresse':
        if (!formData.horas_sono) newErrors.horas_sono = 'Campo obrigatório';
        if (!formData.qualidade_sono) newErrors.qualidade_sono = 'Campo obrigatório';
        if (!formData.nivel_estresse) newErrors.nivel_estresse = 'Campo obrigatório';
        break;

      case 'historico_dietas':
        if (!formData.fez_dieta_antes) newErrors.fez_dieta_antes = 'Campo obrigatório';
        break;

      case 'suplementacao':
        if (!formData.usa_suplementos) newErrors.usa_suplementos = 'Campo obrigatório';
        break;

      case 'intestinal':
        if (!formData.funcionamento_intestinal) newErrors.funcionamento_intestinal = 'Campo obrigatório';
        if (!formData.frequencia_evacuacao) newErrors.frequencia_evacuacao = 'Campo obrigatório';
        break;

      case 'restricoes':
        if (!formData.intolerancia_lactose) newErrors.intolerancia_lactose = 'Campo obrigatório';
        if (!formData.intolerancia_gluten) newErrors.intolerancia_gluten = 'Campo obrigatório';
        break;

      case 'rotina_alimentar':
        const mealErrors: Record<string, any> = {};
        const { rotina_alimentar } = formData;

        const validateMeal = (mealData: any): Record<string, string> => {
          const err: Record<string, string> = {};
          if (!mealData.horario) err.horario = 'Campo obrigatório';
          // itens pode ser string[] (formato antigo) ou string[][] (slots com opções)
          const hasItem = (mealData.itens || []).some((slot: any) =>
            Array.isArray(slot) ? slot.some((o: string) => o?.trim()) : String(slot ?? '').trim()
          );
          if (!hasItem) err.itens = 'Adicione ao menos um alimento';
          return err;
        };

        // Validate required meals
        ['cafe_da_manha', 'almoco', 'jantar'].forEach((meal) => {
          const mealData = rotina_alimentar[meal as keyof typeof rotina_alimentar] as any;
          const mealErr = validateMeal(mealData);
          if (Object.keys(mealErr).length > 0) mealErrors[meal] = mealErr;
        });

        // Validate optional meals if enabled
        if (rotina_alimentar.lanche_manha_enabled) {
          const mealErr = validateMeal(rotina_alimentar.lanche_manha);
          if (Object.keys(mealErr).length > 0) mealErrors.lanche_manha = mealErr;
        }

        if (rotina_alimentar.lanche_tarde_enabled) {
          const mealErr = validateMeal(rotina_alimentar.lanche_tarde);
          if (Object.keys(mealErr).length > 0) mealErrors.lanche_tarde = mealErr;
        }

        if (rotina_alimentar.ceia_enabled) {
          const mealErr = validateMeal(rotina_alimentar.ceia);
          if (Object.keys(mealErr).length > 0) mealErrors.ceia = mealErr;
        }

        // Validate weekend question
        if (!rotina_alimentar.muda_fim_de_semana) {
          mealErrors.muda_fim_de_semana = 'Campo obrigatório';
        }
        if (rotina_alimentar.muda_fim_de_semana === 'sim' && !rotina_alimentar.fim_de_semana_descricao?.trim()) {
          mealErrors.fim_de_semana_descricao = 'Campo obrigatório';
        }

        if (Object.keys(mealErrors).length > 0) {
          newErrors.rotina_alimentar = mealErrors;
        }
        break;
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleNext = () => {
    if (validateSection(currentSection)) {
      if (currentSection < sections.length - 1) {
        setCurrentSection((prev) => prev + 1);
        window.scrollTo(0, 0);
      }
    } else {
      toast({
        title: 'Campos obrigatórios',
        description: 'Por favor, preencha todos os campos obrigatórios.',
        variant: 'destructive',
      });
    }
  };

  const handlePrevious = () => {
    if (currentSection > 0) {
      setCurrentSection((prev) => prev - 1);
      window.scrollTo(0, 0);
    }
  };

  const handleSubmit = async () => {
    if (!validateSection(currentSection)) {
      toast({
        title: 'Campos obrigatórios',
        description: 'Por favor, preencha todos os campos obrigatórios.',
        variant: 'destructive',
      });
      return;
    }

    if (!client?.id) {
      toast({
        title: 'Erro',
        description: 'Cliente não encontrado.',
        variant: 'destructive',
      });
      return;
    }

    setIsSubmitting(true);

    try {
      // Get an active anamnese form (the first one available)
      const { data: forms, error: formError } = await supabase
        .from('anamnese_forms')
        .select('id')
        .eq('is_active', true)
        .limit(1);

      let formId = forms?.[0]?.id;

      // If no form exists, we'll save without form_id or handle differently
      if (!formId) {
        toast({
          title: 'Erro',
          description: 'Nenhum formulário de anamnese ativo encontrado. Entre em contato com o administrador.',
          variant: 'destructive',
        });
        setIsSubmitting(false);
        return;
      }

      // Submit the anamnese response (raw data)
      const { error: responseError } = await supabase
        .from('anamnese_responses')
        .insert([{
          form_id: formId,
          client_id: client.id,
          responses: formData as any,
        }]);

      if (responseError) throw responseError;

      // Create/Update structured athlete profile
      const athleteProfileData = {
        client_id: client.id,
        // Dados Pessoais
        full_name: formData.nome_completo,
        birth_date: formData.data_nascimento || null,
        gender: formData.genero,
        phone: formData.telefone,
        city_state: formData.cidade_estado,
        // Rotina e Trabalho
        profession: formData.profissao,
        work_schedule: formData.horario_trabalho,
        sedentary_work: formData.trabalho_sedentario,
        hours_sitting: formData.horas_sentado,
        daily_activity_level: formData.nivel_atividade_diaria,
        training_week: formData.rotina_treino,
        // Histórico de Corrida
        practices_running: formData.pratica_corrida,
        running_time: formData.tempo_pratica,
        weekly_frequency: formData.frequencia_semanal,
        weekly_volume_km: formData.volume_semanal_km ? parseFloat(formData.volume_semanal_km) : null,
        races_participated: formData.provas_participadas,
        injury_history: formData.lesoes_historico,
        // Objetivos
        main_goal: formData.objetivo_principal,
        secondary_goal: formData.objetivo_secundario,
        specific_target: formData.meta_especifica,
        target_deadline: formData.prazo_meta,
        // Medidas
        current_weight: formData.peso_atual ? parseFloat(formData.peso_atual) : null,
        height: formData.altura ? parseFloat(formData.altura) : null,
        ideal_weight: formData.peso_ideal ? parseFloat(formData.peso_ideal) : null,
        max_weight: formData.maior_peso ? parseFloat(formData.maior_peso) : null,
        min_adult_weight: formData.menor_peso_adulto ? parseFloat(formData.menor_peso_adulto) : null,
        waist_circumference: formData.circunferencia_cintura ? parseFloat(formData.circunferencia_cintura) : null,
        hip_circumference: formData.circunferencia_quadril ? parseFloat(formData.circunferencia_quadril) : null,
        // Sono e Estresse
        sleep_hours: formData.horas_sono,
        sleep_quality: formData.qualidade_sono,
        bedtime: formData.horario_dormir,
        wake_time: formData.horario_acordar,
        stress_level: formData.nivel_estresse,
        stress_cause: formData.causa_estresse,
        // Histórico de Dietas
        previous_diets: formData.fez_dieta_antes,
        diet_types: formData.dietas_anteriores,
        diet_stop_reason: formData.motivo_parou_dieta,
        nutritional_followup: formData.acompanhamento_nutricional,
        // Suplementação
        uses_supplements: formData.usa_suplementos,
        current_supplements: formData.suplementos_atuais,
        used_supplements_before: formData.ja_usou_suplementos,
        past_supplements: formData.suplementos_passados,
        // Intestinal
        intestinal_function: formData.funcionamento_intestinal,
        evacuation_frequency: formData.frequencia_evacuacao,
        intestinal_problems: formData.problemas_intestinais,
        intestinal_problems_other: formData.problemas_intestinais_outros,
        // Restrições
        food_allergies: formData.alergias_alimentares,
        lactose_intolerance: formData.intolerancia_lactose,
        gluten_intolerance: formData.intolerancia_gluten,
        religious_restrictions: formData.restricao_religiosa,
        disliked_foods: formData.alimentos_nao_gosta,
        favorite_foods: formData.alimentos_favoritos,
        // Rotina Alimentar Estruturada
        meal_breakfast: formData.rotina_alimentar.cafe_da_manha,
        meal_morning_snack: formData.rotina_alimentar.lanche_manha,
        meal_morning_snack_enabled: formData.rotina_alimentar.lanche_manha_enabled,
        meal_lunch: formData.rotina_alimentar.almoco,
        meal_afternoon_snack: formData.rotina_alimentar.lanche_tarde,
        meal_afternoon_snack_enabled: formData.rotina_alimentar.lanche_tarde_enabled,
        meal_dinner: formData.rotina_alimentar.jantar,
        meal_supper: formData.rotina_alimentar.ceia,
        meal_supper_enabled: formData.rotina_alimentar.ceia_enabled,
        weekend_changes: formData.rotina_alimentar.muda_fim_de_semana,
        weekend_description: formData.rotina_alimentar.fim_de_semana_descricao,
        // Metadados
        anamnese_submitted_at: new Date().toISOString(),
      };

      // Check if profile exists, then upsert
      const { data: existingProfile } = await supabase
        .from('athlete_profiles')
        .select('id')
        .eq('client_id', client.id)
        .maybeSingle();

      if (existingProfile) {
        // Update existing profile
        const { error: profileError } = await supabase
          .from('athlete_profiles')
          .update(athleteProfileData as any)
          .eq('client_id', client.id);

        if (profileError) {
          console.error('Error updating athlete profile:', profileError);
        }
      } else {
        // Insert new profile
        const { error: profileError } = await supabase
          .from('athlete_profiles')
          .insert([athleteProfileData as any]);

        if (profileError) {
          console.error('Error creating athlete profile:', profileError);
        }
      }

      // Update client status to "Pronto para Análise IA"
      const { error: updateError } = await supabase
        .from('clients')
        .update({ athlete_status: 'ready_for_ai_analysis' })
        .eq('id', client.id);

      if (updateError) throw updateError;

      // Auto-fill target_race from meta_especifica if provided
      if (formData.meta_especifica) {
        const { autoFillTargetRace } = await import('@/lib/extractTargetRace');
        await autoFillTargetRace(client.id, formData.meta_especifica, null);
      }

      // Fire-and-forget: push notification para o nutricionista dono
      supabase.functions
        .invoke('notify-anamnese-submitted', { body: { client_id: client.id } })
        .catch((e) => console.warn('notify-anamnese-submitted falhou:', e));

      toast({
        title: 'Anamnese enviada com sucesso!',
        description: 'Seus dados foram salvos. Aguarde a análise.',
      });

      // Redirect to athlete dashboard
      navigate('/athlete');
      
    } catch (error) {
      console.error('Error submitting anamnese:', error);
      toast({
        title: 'Erro ao enviar',
        description: 'Ocorreu um erro ao enviar a anamnese. Tente novamente.',
        variant: 'destructive',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const updateFormData = (field: keyof FormData, value: any) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    // Clear error when field is filled
    if (errors[field]) {
      setErrors((prev) => {
        const newErrors = { ...prev };
        delete newErrors[field];
        return newErrors;
      });
    }
  };

  const progress = ((currentSection + 1) / sections.length) * 100;

  const renderSection = () => {
    const section = sections[currentSection];

    switch (section.id) {
      case 'dados_pessoais':
        return (
          <div className="space-y-6">
            <div className="space-y-2">
              <Label>Nome Completo *</Label>
              <Input
                value={formData.nome_completo}
                onChange={(e) => updateFormData('nome_completo', e.target.value)}
                className={errors.nome_completo ? 'border-destructive' : ''}
              />
              {errors.nome_completo && <p className="text-xs text-destructive">{errors.nome_completo}</p>}
            </div>

            <div className="space-y-2">
              <Label>Data de Nascimento *</Label>
              <Input
                type="date"
                value={formData.data_nascimento}
                onChange={(e) => updateFormData('data_nascimento', e.target.value)}
                className={errors.data_nascimento ? 'border-destructive' : ''}
              />
              {errors.data_nascimento && <p className="text-xs text-destructive">{errors.data_nascimento}</p>}
            </div>

            <div className="space-y-2">
              <Label>Gênero *</Label>
              <Select value={formData.genero} onValueChange={(v) => updateFormData('genero', v)}>
                <SelectTrigger className={errors.genero ? 'border-destructive' : ''}>
                  <SelectValue placeholder="Selecione" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="masculino">Masculino</SelectItem>
                  <SelectItem value="feminino">Feminino</SelectItem>
                  <SelectItem value="outro">Outro</SelectItem>
                  <SelectItem value="prefiro_nao_dizer">Prefiro não dizer</SelectItem>
                </SelectContent>
              </Select>
              {errors.genero && <p className="text-xs text-destructive">{errors.genero}</p>}
            </div>

            <div className="space-y-2">
              <Label>Telefone/WhatsApp</Label>
              <PhoneInput
                value={formData.telefone}
                onChange={(value) => updateFormData('telefone', value)}
              />
            </div>

            <div className="space-y-2">
              <Label>Cidade/Estado</Label>
              <Input
                value={formData.cidade_estado}
                onChange={(e) => updateFormData('cidade_estado', e.target.value)}
                placeholder="Ex: São Paulo/SP"
              />
            </div>
          </div>
        );

      case 'rotina_trabalho':
        return (
          <div className="space-y-6">
            <div className="space-y-2">
              <Label>Profissão *</Label>
              <Input
                value={formData.profissao}
                onChange={(e) => updateFormData('profissao', e.target.value)}
                className={errors.profissao ? 'border-destructive' : ''}
              />
              {errors.profissao && <p className="text-xs text-destructive">{errors.profissao}</p>}
            </div>

            <div className="space-y-2">
              <Label>Horário de Trabalho</Label>
              <Input
                value={formData.horario_trabalho}
                onChange={(e) => updateFormData('horario_trabalho', e.target.value)}
                placeholder="Ex: 8h às 18h"
              />
            </div>

            <div className="space-y-2">
              <Label>Seu trabalho é predominantemente sedentário? *</Label>
              <RadioGroup
                value={formData.trabalho_sedentario}
                onValueChange={(v) => updateFormData('trabalho_sedentario', v)}
              >
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="sim" id="sed-sim" />
                  <Label htmlFor="sed-sim">Sim, fico sentado a maior parte do tempo</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="parcial" id="sed-parcial" />
                  <Label htmlFor="sed-parcial">Parcialmente, alterno entre sentado e em movimento</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="nao" id="sed-nao" />
                  <Label htmlFor="sed-nao">Não, meu trabalho é ativo/físico</Label>
                </div>
              </RadioGroup>
              {errors.trabalho_sedentario && <p className="text-xs text-destructive">{errors.trabalho_sedentario}</p>}
            </div>

            <div className="space-y-2">
              <Label>Quantas horas por dia você fica sentado(a)?</Label>
              <Select value={formData.horas_sentado} onValueChange={(v) => updateFormData('horas_sentado', v)}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="menos_2">Menos de 2 horas</SelectItem>
                  <SelectItem value="2_4">2 a 4 horas</SelectItem>
                  <SelectItem value="4_6">4 a 6 horas</SelectItem>
                  <SelectItem value="6_8">6 a 8 horas</SelectItem>
                  <SelectItem value="mais_8">Mais de 8 horas</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-3">
              <Label className="text-base font-semibold">
                Como costuma ser o seu dia no geral? *
              </Label>
              <p className="text-xs text-muted-foreground">
                Considere sua rotina fora dos treinos — trabalho, deslocamentos, tarefas do dia a dia. Isso ajuda a calcular o quanto você gasta de energia nas 24 horas.
              </p>
              <RadioGroup
                value={formData.nivel_atividade_diaria}
                onValueChange={(v) => updateFormData('nivel_atividade_diaria', v)}
                className="space-y-3"
              >
                <div className="flex items-start space-x-3 rounded-lg border p-3 hover:bg-accent/50 transition-colors cursor-pointer">
                  <RadioGroupItem value="sedentario" id="ativ-sed" className="mt-0.5" />
                  <Label htmlFor="ativ-sed" className="cursor-pointer space-y-0.5">
                    <span className="font-medium">🪑 Sedentário</span>
                    <p className="text-xs text-muted-foreground font-normal">Fico sentado a maior parte do dia (home office, escritório, estudo)</p>
                  </Label>
                </div>
                <div className="flex items-start space-x-3 rounded-lg border p-3 hover:bg-accent/50 transition-colors cursor-pointer">
                  <RadioGroupItem value="pouco_movimento" id="ativ-pouco" className="mt-0.5" />
                  <Label htmlFor="ativ-pouco" className="cursor-pointer space-y-0.5">
                    <span className="font-medium">🚶 Pouco movimento</span>
                    <p className="text-xs text-muted-foreground font-normal">Alterno entre ficar sentado e me movimentar ao longo do dia</p>
                  </Label>
                </div>
                <div className="flex items-start space-x-3 rounded-lg border p-3 hover:bg-accent/50 transition-colors cursor-pointer">
                  <RadioGroupItem value="muito_movimento" id="ativ-muito" className="mt-0.5" />
                  <Label htmlFor="ativ-muito" className="cursor-pointer space-y-0.5">
                    <span className="font-medium">🏃 Muito movimento</span>
                    <p className="text-xs text-muted-foreground font-normal">Fico de pé, andando ou fazendo esforço físico a maior parte do dia (professor, vendedor, obra, etc.)</p>
                  </Label>
                </div>
              </RadioGroup>
              {errors.nivel_atividade_diaria && <p className="text-xs text-destructive">{errors.nivel_atividade_diaria}</p>}
            </div>
          </div>
        );

      case 'rotina_treino':
        return (
          <TrainingWeekSection
            data={formData.rotina_treino}
            onChange={(data) => updateFormData('rotina_treino', data)}
          />
        );

      case 'historico_corrida':
        return (
          <div className="space-y-6">
            <div className="space-y-2">
              <Label>Você pratica corrida atualmente? *</Label>
              <RadioGroup
                value={formData.pratica_corrida}
                onValueChange={(v) => updateFormData('pratica_corrida', v)}
              >
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="sim" id="corrida-sim" />
                  <Label htmlFor="corrida-sim">Sim</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="nao_mas_pretendo" id="corrida-pretendo" />
                  <Label htmlFor="corrida-pretendo">Não, mas pretendo começar</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="nao" id="corrida-nao" />
                  <Label htmlFor="corrida-nao">Não</Label>
                </div>
              </RadioGroup>
              {errors.pratica_corrida && <p className="text-xs text-destructive">{errors.pratica_corrida}</p>}
            </div>

            {formData.pratica_corrida === 'sim' && (
              <>
                <div className="space-y-2">
                  <Label>Há quanto tempo pratica corrida?</Label>
                  <Select value={formData.tempo_pratica} onValueChange={(v) => updateFormData('tempo_pratica', v)}>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="menos_6m">Menos de 6 meses</SelectItem>
                      <SelectItem value="6m_1a">6 meses a 1 ano</SelectItem>
                      <SelectItem value="1_2a">1 a 2 anos</SelectItem>
                      <SelectItem value="2_5a">2 a 5 anos</SelectItem>
                      <SelectItem value="mais_5a">Mais de 5 anos</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Quantas vezes por semana você corre?</Label>
                  <Select value={formData.frequencia_semanal} onValueChange={(v) => updateFormData('frequencia_semanal', v)}>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="1">1 vez</SelectItem>
                      <SelectItem value="2">2 vezes</SelectItem>
                      <SelectItem value="3">3 vezes</SelectItem>
                      <SelectItem value="4">4 vezes</SelectItem>
                      <SelectItem value="5">5 vezes</SelectItem>
                      <SelectItem value="6_mais">6 ou mais</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Volume semanal aproximado (km)</Label>
                  <Input
                    type="number"
                    value={formData.volume_semanal_km}
                    onChange={(e) => updateFormData('volume_semanal_km', e.target.value)}
                    placeholder="Ex: 30"
                  />
                </div>

                <div className="space-y-2">
                  <Label>Já participou de provas? Quais?</Label>
                  <Textarea
                    value={formData.provas_participadas}
                    onChange={(e) => updateFormData('provas_participadas', e.target.value)}
                    placeholder="Ex: 5km, 10km, meia maratona, maratona..."
                    rows={2}
                  />
                </div>
              </>
            )}

            <div className="space-y-2">
              <Label>Histórico de lesões (corrida ou outras atividades)</Label>
              <Textarea
                value={formData.lesoes_historico}
                onChange={(e) => updateFormData('lesoes_historico', e.target.value)}
                placeholder="Descreva lesões anteriores, se houver..."
                rows={3}
              />
            </div>

            {/* Outras modalidades de treino */}
            <Card className="border-primary/30">
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <CalendarDays className="h-4 w-4 text-primary" />
                  Outras modalidades de treino na semana
                </CardTitle>
                <CardDescription>
                  Inclua modalidades além da corrida (musculação, bike, natação, funcional, pilates, yoga...) e o dia/horário que costuma realizar.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {formData.modalidades_treino.length === 0 && (
                  <p className="text-xs text-muted-foreground italic">
                    Nenhuma modalidade adicionada. Clique em "Adicionar modalidade" se realiza outras atividades.
                  </p>
                )}
                {formData.modalidades_treino.map((item, idx) => (
                  <div key={idx} className="grid grid-cols-1 md:grid-cols-12 gap-2 p-3 rounded-md border bg-muted/30">
                    <div className="md:col-span-5 space-y-1">
                      <Label className="text-xs">Modalidade</Label>
                      <Input
                        value={item.modalidade}
                        onChange={(e) => {
                          const next = [...formData.modalidades_treino];
                          next[idx] = { ...next[idx], modalidade: e.target.value };
                          updateFormData('modalidades_treino', next);
                        }}
                        placeholder="Ex: Musculação"
                      />
                    </div>
                    <div className="md:col-span-4 space-y-1">
                      <Label className="text-xs">Dia(s) da semana</Label>
                      <Input
                        value={item.dia}
                        onChange={(e) => {
                          const next = [...formData.modalidades_treino];
                          next[idx] = { ...next[idx], dia: e.target.value };
                          updateFormData('modalidades_treino', next);
                        }}
                        placeholder="Ex: Seg, Qua, Sex"
                      />
                    </div>
                    <div className="md:col-span-2 space-y-1">
                      <Label className="text-xs">Horário</Label>
                      <Input
                        type="time"
                        value={item.horario}
                        onChange={(e) => {
                          const next = [...formData.modalidades_treino];
                          next[idx] = { ...next[idx], horario: e.target.value };
                          updateFormData('modalidades_treino', next);
                        }}
                      />
                    </div>
                    <div className="md:col-span-1 flex md:items-end justify-end">
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => {
                          const next = formData.modalidades_treino.filter((_, i) => i !== idx);
                          updateFormData('modalidades_treino', next);
                        }}
                        aria-label="Remover modalidade"
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </div>
                ))}
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    updateFormData('modalidades_treino', [
                      ...formData.modalidades_treino,
                      { modalidade: '', dia: '', horario: '' },
                    ])
                  }
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Adicionar modalidade
                </Button>
              </CardContent>
            </Card>
          </div>
        );

      case 'objetivo':
        return (
          <div className="space-y-6">
            <div className="space-y-2">
              <Label>Qual seu objetivo principal? *</Label>
              <RadioGroup
                value={formData.objetivo_principal}
                onValueChange={(v) => updateFormData('objetivo_principal', v)}
              >
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="emagrecimento" id="obj-emag" />
                  <Label htmlFor="obj-emag">Emagrecimento / Perda de gordura</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="definicao" id="obj-def" />
                  <Label htmlFor="obj-def">Definição muscular</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="performance" id="obj-perf" />
                  <Label htmlFor="obj-perf">Melhorar performance na corrida</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="saude" id="obj-saude" />
                  <Label htmlFor="obj-saude">Saúde e qualidade de vida</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="massa" id="obj-massa" />
                  <Label htmlFor="obj-massa">Ganho de massa muscular</Label>
                </div>
              </RadioGroup>
              {errors.objetivo_principal && <p className="text-xs text-destructive">{errors.objetivo_principal}</p>}
            </div>

            <div className="space-y-2">
              <Label>Objetivo secundário (opcional)</Label>
              <Input
                value={formData.objetivo_secundario}
                onChange={(e) => updateFormData('objetivo_secundario', e.target.value)}
                placeholder="Ex: melhorar disposição, dormir melhor..."
              />
            </div>

            <div className="space-y-2">
              <Label>Meta específica (se tiver)</Label>
              <Input
                value={formData.meta_especifica}
                onChange={(e) => updateFormData('meta_especifica', e.target.value)}
                placeholder="Ex: perder 5kg, correr 10km em menos de 50min..."
              />
            </div>

            <div className="space-y-2">
              <Label>Em quanto tempo deseja alcançar essa meta?</Label>
              <Select value={formData.prazo_meta} onValueChange={(v) => updateFormData('prazo_meta', v)}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="1m">1 mês</SelectItem>
                  <SelectItem value="3m">3 meses</SelectItem>
                  <SelectItem value="6m">6 meses</SelectItem>
                  <SelectItem value="1a">1 ano</SelectItem>
                  <SelectItem value="sem_prazo">Sem prazo definido</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Prova alvo */}
            <Card className="border-primary/30">
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <CalendarDays className="h-4 w-4 text-primary" />
                  Você tem uma prova alvo?
                </CardTitle>
                <CardDescription>
                  Se tem uma prova específica como meta, informe qual é e a data — calcularemos quantas semanas faltam.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <RadioGroup
                  value={formData.tem_prova_alvo}
                  onValueChange={(v) => updateFormData('tem_prova_alvo', v)}
                >
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="nao" id="prova-nao" />
                    <Label htmlFor="prova-nao">Não, sem prova alvo definida</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="sim" id="prova-sim" />
                    <Label htmlFor="prova-sim">Sim, tenho uma prova alvo</Label>
                  </div>
                </RadioGroup>

                {formData.tem_prova_alvo === 'sim' && (
                  <div className="space-y-4 pt-2">
                    <div className="space-y-2">
                      <Label>Qual é a prova alvo? *</Label>
                      <Input
                        value={formData.prova_alvo_nome}
                        onChange={(e) => updateFormData('prova_alvo_nome', e.target.value)}
                        placeholder="Ex: Maratona do Rio 2026, Meia de São Paulo..."
                        className={errors.prova_alvo_nome ? 'border-destructive' : ''}
                      />
                      {errors.prova_alvo_nome && (
                        <p className="text-xs text-destructive">{errors.prova_alvo_nome}</p>
                      )}
                    </div>
                    <div className="space-y-2">
                      <Label>Data da prova *</Label>
                      <Input
                        type="date"
                        value={formData.prova_alvo_data}
                        onChange={(e) => updateFormData('prova_alvo_data', e.target.value)}
                        className={errors.prova_alvo_data ? 'border-destructive' : ''}
                      />
                      {errors.prova_alvo_data && (
                        <p className="text-xs text-destructive">{errors.prova_alvo_data}</p>
                      )}
                    </div>
                    {formData.prova_alvo_data && (() => {
                      const today = new Date();
                      today.setHours(0, 0, 0, 0);
                      const raceDate = new Date(formData.prova_alvo_data + 'T00:00:00');
                      const diffDays = Math.ceil((raceDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
                      const weeks = Math.floor(diffDays / 7);
                      const remainingDays = diffDays % 7;
                      if (diffDays < 0) {
                        return (
                          <div className="rounded-md bg-destructive/10 border border-destructive/30 p-3 text-sm">
                            ⚠️ A data informada já passou. Confira se está correta.
                          </div>
                        );
                      }
                      return (
                        <div className="rounded-md bg-primary/10 border border-primary/30 p-3 text-sm">
                          📅 Faltam <strong>{weeks} {weeks === 1 ? 'semana' : 'semanas'}</strong>
                          {remainingDays > 0 && <> e <strong>{remainingDays} {remainingDays === 1 ? 'dia' : 'dias'}</strong></>}
                          {' '}até a prova ({diffDays} {diffDays === 1 ? 'dia' : 'dias'} no total).
                        </div>
                      );
                    })()}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        );

      case 'medidas':
        return (
          <div className="space-y-6">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Peso Atual (kg) *</Label>
                <Input
                  type="number"
                  step="0.1"
                  value={formData.peso_atual}
                  onChange={(e) => updateFormData('peso_atual', e.target.value)}
                  className={errors.peso_atual ? 'border-destructive' : ''}
                />
                {errors.peso_atual && <p className="text-xs text-destructive">{errors.peso_atual}</p>}
              </div>

              <div className="space-y-2">
                <Label>Altura (cm) *</Label>
                <Input
                  type="number"
                  value={formData.altura}
                  onChange={(e) => updateFormData('altura', e.target.value)}
                  placeholder="Ex: 175"
                  className={errors.altura ? 'border-destructive' : ''}
                />
                {errors.altura && <p className="text-xs text-destructive">{errors.altura}</p>}
              </div>
            </div>

            <div className="space-y-2">
              <Label>Qual peso você considera ideal para você?</Label>
              <Input
                type="number"
                step="0.1"
                value={formData.peso_ideal}
                onChange={(e) => updateFormData('peso_ideal', e.target.value)}
                placeholder="kg"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Maior peso que já teve</Label>
                <Input
                  type="number"
                  step="0.1"
                  value={formData.maior_peso}
                  onChange={(e) => updateFormData('maior_peso', e.target.value)}
                  placeholder="kg"
                />
              </div>

              <div className="space-y-2">
                <Label>Menor peso na vida adulta</Label>
                <Input
                  type="number"
                  step="0.1"
                  value={formData.menor_peso_adulto}
                  onChange={(e) => updateFormData('menor_peso_adulto', e.target.value)}
                  placeholder="kg"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Circunferência da cintura (cm)</Label>
                <Input
                  type="number"
                  value={formData.circunferencia_cintura}
                  onChange={(e) => updateFormData('circunferencia_cintura', e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label>Circunferência do quadril (cm)</Label>
                <Input
                  type="number"
                  value={formData.circunferencia_quadril}
                  onChange={(e) => updateFormData('circunferencia_quadril', e.target.value)}
                />
              </div>
            </div>
          </div>
        );

      case 'sono_estresse':
        return (
          <div className="space-y-6">
            <div className="space-y-2">
              <Label>Quantas horas você dorme por noite em média? *</Label>
              <Select value={formData.horas_sono} onValueChange={(v) => updateFormData('horas_sono', v)}>
                <SelectTrigger className={errors.horas_sono ? 'border-destructive' : ''}>
                  <SelectValue placeholder="Selecione" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="menos_5">Menos de 5 horas</SelectItem>
                  <SelectItem value="5_6">5 a 6 horas</SelectItem>
                  <SelectItem value="6_7">6 a 7 horas</SelectItem>
                  <SelectItem value="7_8">7 a 8 horas</SelectItem>
                  <SelectItem value="mais_8">Mais de 8 horas</SelectItem>
                </SelectContent>
              </Select>
              {errors.horas_sono && <p className="text-xs text-destructive">{errors.horas_sono}</p>}
            </div>

            <div className="space-y-2">
              <Label>Como você classifica a qualidade do seu sono? *</Label>
              <RadioGroup
                value={formData.qualidade_sono}
                onValueChange={(v) => updateFormData('qualidade_sono', v)}
              >
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="otima" id="sono-otima" />
                  <Label htmlFor="sono-otima">Ótima - acordo descansado(a)</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="boa" id="sono-boa" />
                  <Label htmlFor="sono-boa">Boa - durmo bem na maior parte das noites</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="regular" id="sono-regular" />
                  <Label htmlFor="sono-regular">Regular - tenho algumas dificuldades</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="ruim" id="sono-ruim" />
                  <Label htmlFor="sono-ruim">Ruim - durmo mal frequentemente</Label>
                </div>
              </RadioGroup>
              {errors.qualidade_sono && <p className="text-xs text-destructive">{errors.qualidade_sono}</p>}
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Horário que costuma dormir</Label>
                <Input
                  type="time"
                  value={formData.horario_dormir}
                  onChange={(e) => updateFormData('horario_dormir', e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label>Horário que costuma acordar</Label>
                <Input
                  type="time"
                  value={formData.horario_acordar}
                  onChange={(e) => updateFormData('horario_acordar', e.target.value)}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Como você classifica seu nível de estresse? *</Label>
              <RadioGroup
                value={formData.nivel_estresse}
                onValueChange={(v) => updateFormData('nivel_estresse', v)}
              >
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="baixo" id="stress-baixo" />
                  <Label htmlFor="stress-baixo">Baixo - me sinto tranquilo(a)</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="moderado" id="stress-mod" />
                  <Label htmlFor="stress-mod">Moderado - consigo gerenciar</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="alto" id="stress-alto" />
                  <Label htmlFor="stress-alto">Alto - me afeta frequentemente</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="muito_alto" id="stress-muito" />
                  <Label htmlFor="stress-muito">Muito alto - impacta minha vida</Label>
                </div>
              </RadioGroup>
              {errors.nivel_estresse && <p className="text-xs text-destructive">{errors.nivel_estresse}</p>}
            </div>

            <div className="space-y-2">
              <Label>Principal causa do estresse (se aplicável)</Label>
              <Input
                value={formData.causa_estresse}
                onChange={(e) => updateFormData('causa_estresse', e.target.value)}
                placeholder="Ex: trabalho, família, financeiro..."
              />
            </div>
          </div>
        );

      case 'historico_dietas':
        return (
          <div className="space-y-6">
            <div className="space-y-2">
              <Label>Você já fez dieta antes? *</Label>
              <RadioGroup
                value={formData.fez_dieta_antes}
                onValueChange={(v) => updateFormData('fez_dieta_antes', v)}
              >
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="nao" id="dieta-nao" />
                  <Label htmlFor="dieta-nao">Não, nunca fiz dieta</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="sim_conta" id="dieta-conta" />
                  <Label htmlFor="dieta-conta">Sim, por conta própria</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="sim_nutri" id="dieta-nutri" />
                  <Label htmlFor="dieta-nutri">Sim, com acompanhamento nutricional</Label>
                </div>
              </RadioGroup>
              {errors.fez_dieta_antes && <p className="text-xs text-destructive">{errors.fez_dieta_antes}</p>}
            </div>

            {formData.fez_dieta_antes !== 'nao' && formData.fez_dieta_antes && (
              <>
                <div className="space-y-2">
                  <Label>Quais dietas você já fez?</Label>
                  <Textarea
                    value={formData.dietas_anteriores}
                    onChange={(e) => updateFormData('dietas_anteriores', e.target.value)}
                    placeholder="Ex: low carb, jejum intermitente, contagem de calorias..."
                    rows={2}
                  />
                </div>

                <div className="space-y-2">
                  <Label>Por que parou ou não conseguiu manter?</Label>
                  <Textarea
                    value={formData.motivo_parou_dieta}
                    onChange={(e) => updateFormData('motivo_parou_dieta', e.target.value)}
                    placeholder="Descreva os motivos..."
                    rows={2}
                  />
                </div>
              </>
            )}

            <div className="space-y-2">
              <Label>Já teve acompanhamento nutricional antes?</Label>
              <RadioGroup
                value={formData.acompanhamento_nutricional}
                onValueChange={(v) => updateFormData('acompanhamento_nutricional', v)}
              >
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="nao" id="acomp-nao" />
                  <Label htmlFor="acomp-nao">Não, nunca</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="sim_online" id="acomp-online" />
                  <Label htmlFor="acomp-online">Sim, online</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="sim_presencial" id="acomp-presencial" />
                  <Label htmlFor="acomp-presencial">Sim, presencial</Label>
                </div>
              </RadioGroup>
            </div>
          </div>
        );

      case 'suplementacao':
        return (
          <div className="space-y-6">
            <div className="space-y-2">
              <Label>Você usa suplementos atualmente? *</Label>
              <RadioGroup
                value={formData.usa_suplementos}
                onValueChange={(v) => updateFormData('usa_suplementos', v)}
              >
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="nao" id="sup-nao" />
                  <Label htmlFor="sup-nao">Não uso</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="sim" id="sup-sim" />
                  <Label htmlFor="sup-sim">Sim, uso</Label>
                </div>
              </RadioGroup>
              {errors.usa_suplementos && <p className="text-xs text-destructive">{errors.usa_suplementos}</p>}
            </div>

            {formData.usa_suplementos === 'sim' && (
              <div className="space-y-2">
                <Label>Quais suplementos você usa atualmente?</Label>
                <Textarea
                  value={formData.suplementos_atuais}
                  onChange={(e) => updateFormData('suplementos_atuais', e.target.value)}
                  placeholder="Liste os suplementos, dosagens e horários de uso..."
                  rows={3}
                />
              </div>
            )}

            <div className="space-y-2">
              <Label>Já usou suplementos no passado?</Label>
              <RadioGroup
                value={formData.ja_usou_suplementos}
                onValueChange={(v) => updateFormData('ja_usou_suplementos', v)}
              >
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="nao" id="sup-passado-nao" />
                  <Label htmlFor="sup-passado-nao">Não</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="sim" id="sup-passado-sim" />
                  <Label htmlFor="sup-passado-sim">Sim</Label>
                </div>
              </RadioGroup>
            </div>

            {formData.ja_usou_suplementos === 'sim' && (
              <div className="space-y-2">
                <Label>Quais suplementos já usou?</Label>
                <Textarea
                  value={formData.suplementos_passados}
                  onChange={(e) => updateFormData('suplementos_passados', e.target.value)}
                  placeholder="Liste os suplementos que já usou..."
                  rows={2}
                />
              </div>
            )}
          </div>
        );

      case 'intestinal':
        return (
          <div className="space-y-6">
            <div className="space-y-2">
              <Label>Como é o funcionamento do seu intestino? *</Label>
              <RadioGroup
                value={formData.funcionamento_intestinal}
                onValueChange={(v) => updateFormData('funcionamento_intestinal', v)}
              >
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="regular" id="int-regular" />
                  <Label htmlFor="int-regular">Regular - funciona bem</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="preso" id="int-preso" />
                  <Label htmlFor="int-preso">Tendência a preso/constipação</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="solto" id="int-solto" />
                  <Label htmlFor="int-solto">Tendência a solto/diarreia</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="alternado" id="int-alternado" />
                  <Label htmlFor="int-alternado">Alternado - varia muito</Label>
                </div>
              </RadioGroup>
              {errors.funcionamento_intestinal && <p className="text-xs text-destructive">{errors.funcionamento_intestinal}</p>}
            </div>

            <div className="space-y-2">
              <Label>Com que frequência você evacua? *</Label>
              <Select value={formData.frequencia_evacuacao} onValueChange={(v) => updateFormData('frequencia_evacuacao', v)}>
                <SelectTrigger className={errors.frequencia_evacuacao ? 'border-destructive' : ''}>
                  <SelectValue placeholder="Selecione" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="varias_dia">Várias vezes ao dia</SelectItem>
                  <SelectItem value="1_dia">1 vez ao dia</SelectItem>
                  <SelectItem value="dias_alternados">Dias alternados</SelectItem>
                  <SelectItem value="2_3_semana">2-3 vezes por semana</SelectItem>
                  <SelectItem value="menos">Menos de 2x por semana</SelectItem>
                </SelectContent>
              </Select>
              {errors.frequencia_evacuacao && <p className="text-xs text-destructive">{errors.frequencia_evacuacao}</p>}
            </div>

            <div className="space-y-2">
              <Label>Você apresenta algum desses problemas? (marque todos que se aplicam)</Label>
              <div className="space-y-2">
                {[
                  { value: 'gases', label: 'Gases/flatulência excessiva' },
                  { value: 'distensao', label: 'Distensão abdominal/barriga inchada' },
                  { value: 'refluxo', label: 'Refluxo/azia' },
                  { value: 'nausea', label: 'Náusea frequente' },
                  { value: 'colica', label: 'Cólicas intestinais' },
                  { value: 'nenhum', label: 'Nenhum dos anteriores' },
                ].map((item) => (
                  <div key={item.value} className="flex items-center space-x-2">
                    <Checkbox
                      id={`prob-${item.value}`}
                      checked={formData.problemas_intestinais.includes(item.value)}
                      onCheckedChange={(checked) => {
                        if (checked) {
                          updateFormData('problemas_intestinais', [...formData.problemas_intestinais, item.value]);
                        } else {
                          updateFormData('problemas_intestinais', formData.problemas_intestinais.filter((v) => v !== item.value));
                        }
                      }}
                    />
                    <Label htmlFor={`prob-${item.value}`}>{item.label}</Label>
                  </div>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <Label>Outros problemas intestinais (especifique)</Label>
              <Input
                value={formData.problemas_intestinais_outros}
                onChange={(e) => updateFormData('problemas_intestinais_outros', e.target.value)}
                placeholder="Descreva outros problemas se houver..."
              />
            </div>
          </div>
        );

      case 'restricoes':
        return (
          <div className="space-y-6">
            <div className="space-y-2">
              <Label>Você tem alergia a algum alimento?</Label>
              <Textarea
                value={formData.alergias_alimentares}
                onChange={(e) => updateFormData('alergias_alimentares', e.target.value)}
                placeholder="Liste os alimentos que causam alergia..."
                rows={2}
              />
            </div>

            <div className="space-y-2">
              <Label>Você tem intolerância à lactose? *</Label>
              <RadioGroup
                value={formData.intolerancia_lactose}
                onValueChange={(v) => updateFormData('intolerancia_lactose', v)}
              >
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="nao" id="lactose-nao" />
                  <Label htmlFor="lactose-nao">Não</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="sim_total" id="lactose-total" />
                  <Label htmlFor="lactose-total">Sim, total</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="sim_parcial" id="lactose-parcial" />
                  <Label htmlFor="lactose-parcial">Sim, parcial (tolero pequenas quantidades)</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="nao_sei" id="lactose-naosei" />
                  <Label htmlFor="lactose-naosei">Não sei</Label>
                </div>
              </RadioGroup>
              {errors.intolerancia_lactose && <p className="text-xs text-destructive">{errors.intolerancia_lactose}</p>}
            </div>

            <div className="space-y-2">
              <Label>Você tem intolerância ao glúten? *</Label>
              <RadioGroup
                value={formData.intolerancia_gluten}
                onValueChange={(v) => updateFormData('intolerancia_gluten', v)}
              >
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="nao" id="gluten-nao" />
                  <Label htmlFor="gluten-nao">Não</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="sim_celiaco" id="gluten-celiaco" />
                  <Label htmlFor="gluten-celiaco">Sim, sou celíaco(a)</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="sim_sensibilidade" id="gluten-sensivel" />
                  <Label htmlFor="gluten-sensivel">Sim, tenho sensibilidade</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="nao_sei" id="gluten-naosei" />
                  <Label htmlFor="gluten-naosei">Não sei</Label>
                </div>
              </RadioGroup>
              {errors.intolerancia_gluten && <p className="text-xs text-destructive">{errors.intolerancia_gluten}</p>}
            </div>

            <div className="space-y-2">
              <Label>Possui alguma restrição religiosa ou filosófica?</Label>
              <Input
                value={formData.restricao_religiosa}
                onChange={(e) => updateFormData('restricao_religiosa', e.target.value)}
                placeholder="Ex: vegetariano, vegano, não come carne de porco..."
              />
            </div>

            <div className="space-y-2">
              <Label>Alimentos que você NÃO gosta ou não come</Label>
              <Textarea
                value={formData.alimentos_nao_gosta}
                onChange={(e) => updateFormData('alimentos_nao_gosta', e.target.value)}
                placeholder="Liste os alimentos que você não gosta..."
                rows={2}
              />
            </div>

            <div className="space-y-2">
              <Label>Alimentos favoritos</Label>
              <Textarea
                value={formData.alimentos_favoritos}
                onChange={(e) => updateFormData('alimentos_favoritos', e.target.value)}
                placeholder="Liste seus alimentos favoritos..."
                rows={2}
              />
            </div>
          </div>
        );

      case 'rotina_alimentar':
        return (
          <MealRoutineSection
            data={formData.rotina_alimentar}
            onChange={(data) => updateFormData('rotina_alimentar', data)}
            errors={errors.rotina_alimentar || {}}
          />
        );

      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border bg-card sticky top-0 z-10">
        <div className="max-w-3xl mx-auto px-4 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary">
              <PersonStanding className="h-5 w-5 text-primary-foreground" />
            </div>
            <div>
              <h1 className="text-lg font-bold">Anamnese Inicial</h1>
              <p className="text-xs text-muted-foreground">Preencha todos os campos obrigatórios</p>
            </div>
          </div>
        </div>
      </header>

      {/* Progress */}
      <div className="max-w-3xl mx-auto px-4 py-4">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-medium">
            {sections[currentSection].icon} {sections[currentSection].title}
          </span>
          <span className="text-sm text-muted-foreground">
            {currentSection + 1} de {sections.length}
          </span>
        </div>
        <Progress value={progress} className="h-2" />

        {/* Section Pills */}
        <div className="flex gap-1 mt-4 overflow-x-auto pb-2">
          {sections.map((section, index) => (
            <button
              key={section.id}
              onClick={() => {
                if (index < currentSection) setCurrentSection(index);
              }}
              disabled={index > currentSection}
              className={`
                flex-shrink-0 px-3 py-1 rounded-full text-xs font-medium transition-colors
                ${index === currentSection 
                  ? 'bg-primary text-primary-foreground' 
                  : index < currentSection 
                    ? 'bg-primary/20 text-primary cursor-pointer hover:bg-primary/30' 
                    : 'bg-muted text-muted-foreground cursor-not-allowed'}
              `}
            >
              {section.icon}
            </button>
          ))}
        </div>
      </div>

      {/* Form Content */}
      <main className="max-w-3xl mx-auto px-4 pb-32">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <span className="text-2xl">{sections[currentSection].icon}</span>
              {sections[currentSection].title}
            </CardTitle>
            <CardDescription>
              {currentSection === sections.length - 1
                ? 'Esta é a última seção. Revise suas respostas antes de enviar.'
                : 'Preencha os campos abaixo e clique em Próximo.'}
            </CardDescription>
          </CardHeader>
          <CardContent>{renderSection()}</CardContent>
        </Card>
      </main>

      {/* Navigation */}
      <div className="fixed bottom-0 left-0 right-0 bg-background border-t border-border p-4">
        <div className="max-w-3xl mx-auto flex justify-between gap-4">
          <Button
            variant="outline"
            onClick={handlePrevious}
            disabled={currentSection === 0}
            className="flex-1"
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            Anterior
          </Button>

          {currentSection === sections.length - 1 ? (
            <Button
              onClick={handleSubmit}
              disabled={isSubmitting}
              className="flex-1 bg-green-600 hover:bg-green-700"
            >
              {isSubmitting ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Check className="mr-2 h-4 w-4" />
              )}
              Enviar Anamnese
            </Button>
          ) : (
            <Button onClick={handleNext} className="flex-1">
              Próximo
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
