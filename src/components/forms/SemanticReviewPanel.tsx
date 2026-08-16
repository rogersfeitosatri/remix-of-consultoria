import { useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { AlertTriangle, CheckCircle2, GitBranch, Loader2, ShieldCheck } from 'lucide-react';
import { toast } from 'sonner';
import { LONG_RUN_KEY } from '@/lib/conditionalVisibility';

type Scope = 'checkin' | 'anamnese';

interface ReviewQuestion {
  id: string;
  form_id: string | null;
  question_text: string;
  question_key: string | null;
  conditional_logic: any;
  scope: Scope;
  form_name?: string | null;
}

const OPERATORS = [
  { value: 'equals', label: 'igual a' },
  { value: 'not_equals', label: 'diferente de' },
  { value: 'answered', label: 'foi respondida' },
];

async function fetchPendingSemanticReview(): Promise<ReviewQuestion[]> {
  const [checkin, anamnese] = await Promise.all([
    supabase
      .from('checkin_questions')
      .select('id, form_id, question_text, question_key, conditional_logic')
      .eq('semantic_review_required', true)
      .order('order_index'),
    supabase
      .from('anamnese_questions')
      .select('id, form_id, question_text, question_key, conditional_logic')
      .eq('semantic_review_required', true)
      .order('order_index'),
  ]);

  if (checkin.error) throw checkin.error;
  if (anamnese.error) throw anamnese.error;

  const rows: ReviewQuestion[] = [
    ...(checkin.data ?? []).map((q: any) => ({ ...q, scope: 'checkin' as Scope })),
    ...(anamnese.data ?? []).map((q: any) => ({ ...q, scope: 'anamnese' as Scope })),
  ];

  const checkinFormIds = rows.filter((r) => r.scope === 'checkin' && r.form_id).map((r) => r.form_id!);
  const anamneseFormIds = rows.filter((r) => r.scope === 'anamnese' && r.form_id).map((r) => r.form_id!);

  const names = new Map<string, string>();
  if (checkinFormIds.length) {
    const { data } = await supabase.from('checkin_forms').select('id, name').in('id', checkinFormIds);
    (data ?? []).forEach((f: any) => names.set(f.id, f.name));
  }
  if (anamneseFormIds.length) {
    const { data } = await supabase.from('anamnese_forms').select('id, name').in('id', anamneseFormIds);
    (data ?? []).forEach((f: any) => names.set(f.id, f.name));
  }

  return rows.map((r) => ({ ...r, form_name: r.form_id ? names.get(r.form_id) ?? null : null }));
}

export function SemanticReviewPanel() {
  const queryClient = useQueryClient();
  const { data: questions = [], isLoading } = useQuery({
    queryKey: ['semantic-review-questions'],
    queryFn: fetchPendingSemanticReview,
  });

  const [target, setTarget] = useState<ReviewQuestion | null>(null);
  const [operator, setOperator] = useState<string>('equals');
  const [value, setValue] = useState<string>('Sim');
  const [dependsOn, setDependsOn] = useState<string>(LONG_RUN_KEY);

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['semantic-review-questions'] });
    queryClient.invalidateQueries({ queryKey: ['checkin-questions'] });
    queryClient.invalidateQueries({ queryKey: ['anamnese-questions'] });
  };

  const table = (scope: Scope) => (scope === 'checkin' ? 'checkin_questions' : 'anamnese_questions');

  const applyMutation = useMutation({
    mutationFn: async (args: {
      q: ReviewQuestion;
      patch: Record<string, any>;
      semantics?: { question_key?: string | null; conditional_logic?: any; notes: string } | null;
    }) => {
      const { error } = await supabase
        .from(table(args.q.scope) as any)
        .update({ ...args.patch, semantic_review_required: false })
        .eq('id', args.q.id);
      if (error) throw error;

      if (args.semantics) {
        const { error: semErr } = await supabase.from('form_question_semantics').upsert(
          {
            source_question_id: args.q.id,
            scope: args.q.scope,
            question_key: args.semantics.question_key ?? null,
            conditional_logic: args.semantics.conditional_logic ?? null,
            notes: args.semantics.notes,
          },
          { onConflict: 'source_question_id' },
        );
        if (semErr) throw semErr;
      }
    },
    onSuccess: () => {
      invalidate();
      setTarget(null);
      toast.success('Revisão semântica aplicada');
    },
    onError: (e: any) => toast.error(e?.message ?? 'Falha ao aplicar revisão'),
  });

  const markAsTrigger = (q: ReviewQuestion) =>
    applyMutation.mutate({
      q,
      patch: { question_key: LONG_RUN_KEY, domain: 'training', canonical_type: 'boolean_choice' },
      semantics: {
        question_key: LONG_RUN_KEY,
        conditional_logic: null,
        notes: 'Aprovado manualmente como gatilho de treino longo',
      },
    });

  const dismiss = (q: ReviewQuestion) =>
    applyMutation.mutate({ q, patch: {}, semantics: null });

  const saveConditional = () => {
    if (!target) return;
    const logic: Record<string, any> = { depends_on: dependsOn.trim(), operator };
    if (operator !== 'answered') logic.value = value;
    applyMutation.mutate({
      q: target,
      patch: { conditional_logic: logic },
      semantics: {
        question_key: target.question_key ?? null,
        conditional_logic: logic,
        notes: 'Condicional semântica definida manualmente',
      },
    });
  };

  const count = useMemo(() => questions.length, [questions]);

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-medium flex items-center gap-2">
          <ShieldCheck className="h-4 w-4 text-muted-foreground" />
          Revisão semântica pendente
          <Badge variant={count > 0 ? 'destructive' : 'secondary'} className="text-[10px] px-1.5 h-5">
            {count}
          </Badge>
        </CardTitle>
        <CardDescription className="text-xs">
          Perguntas que ainda dependem do fallback textual. Aprove o gatilho <code>{LONG_RUN_KEY}</code> ou defina uma
          condicional explícita.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {isLoading ? (
          <div className="flex justify-center py-6">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : count === 0 ? (
          <div className="flex items-center gap-2 py-4 text-sm text-muted-foreground">
            <CheckCircle2 className="h-4 w-4 text-primary" />
            Nenhuma pergunta pendente de revisão semântica.
          </div>
        ) : (
          questions.map((q) => (
            <div key={q.id} className="rounded-lg border p-3 space-y-2">
              <div className="flex flex-wrap items-center gap-1.5">
                <Badge variant="outline" className="text-[10px] h-5">
                  {q.scope === 'checkin' ? 'Check-in' : 'Anamnese'}
                </Badge>
                {q.form_name && (
                  <span className="text-[11px] text-muted-foreground truncate">{q.form_name}</span>
                )}
                <AlertTriangle className="h-3.5 w-3.5 text-destructive" />
              </div>
              <p className="text-sm leading-snug">{q.question_text}</p>
              <div className="text-[11px] text-muted-foreground">
                question_key: <code>{q.question_key || '—'}</code> · conditional_logic:{' '}
                <code>{q.conditional_logic ? JSON.stringify(q.conditional_logic) : '—'}</code>
              </div>
              <div className="flex flex-wrap gap-2 pt-1">
                <Button
                  size="sm"
                  variant="default"
                  className="gap-1.5"
                  disabled={applyMutation.isPending}
                  onClick={() => markAsTrigger(q)}
                >
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  Marcar como {LONG_RUN_KEY}
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="gap-1.5"
                  disabled={applyMutation.isPending}
                  onClick={() => {
                    setTarget(q);
                    setDependsOn(LONG_RUN_KEY);
                    setOperator('equals');
                    setValue('Sim');
                  }}
                >
                  <GitBranch className="h-3.5 w-3.5" />
                  Gerar condicional
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  disabled={applyMutation.isPending}
                  onClick={() => dismiss(q)}
                >
                  Dispensar
                </Button>
              </div>
            </div>
          ))
        )}
      </CardContent>

      <Dialog open={!!target} onOpenChange={(o) => !o && setTarget(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Condicional semântica</DialogTitle>
            <DialogDescription className="text-xs">{target?.question_text}</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Depende da pergunta (question_key)</Label>
              <Input value={dependsOn} onChange={(e) => setDependsOn(e.target.value)} placeholder={LONG_RUN_KEY} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Operador</Label>
              <Select value={operator} onValueChange={setOperator}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {OPERATORS.map((op) => (
                    <SelectItem key={op.value} value={op.value}>
                      {op.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {operator !== 'answered' && (
              <div className="space-y-1.5">
                <Label className="text-xs">Valor</Label>
                <Input value={value} onChange={(e) => setValue(e.target.value)} placeholder="Sim" />
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setTarget(null)}>
              Cancelar
            </Button>
            <Button onClick={saveConditional} disabled={!dependsOn.trim() || applyMutation.isPending}>
              {applyMutation.isPending && <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />}
              Aplicar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
