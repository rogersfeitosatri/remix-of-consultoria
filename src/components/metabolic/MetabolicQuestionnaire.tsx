import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { metabolicCategories, scoreLabels } from '@/data/metabolicScreeningQuestions';
import { cn } from '@/lib/utils';
import { Send, RotateCcw } from 'lucide-react';

interface Props {
  onSubmit: (responses: Record<string, number>, notes: string) => void;
  isSubmitting: boolean;
}

export function MetabolicQuestionnaire({ onSubmit, isSubmitting }: Props) {
  const [responses, setResponses] = useState<Record<string, number>>({});
  const [notes, setNotes] = useState('');
  const [activeCategoryIdx, setActiveCategoryIdx] = useState(0);

  const handleScore = (questionId: string, score: number) => {
    setResponses(prev => ({ ...prev, [questionId]: score }));
  };

  const currentCat = metabolicCategories[activeCategoryIdx];
  const answeredInCat = currentCat.questions.filter(q => responses[q.id] !== undefined).length;
  const totalAnswered = Object.keys(responses).length;
  const totalQuestions = metabolicCategories.reduce((s, c) => s + c.questions.length, 0);
  const allAnswered = totalAnswered === totalQuestions;

  const handleSubmit = () => {
    if (!allAnswered) return;
    onSubmit(responses, notes);
  };

  const handleReset = () => {
    setResponses({});
    setNotes('');
    setActiveCategoryIdx(0);
  };

  return (
    <div className="space-y-4">
      {/* Category navigation */}
      <div className="flex flex-wrap gap-2">
        {metabolicCategories.map((cat, idx) => {
          const answered = cat.questions.filter(q => responses[q.id] !== undefined).length;
          const complete = answered === cat.questions.length;
          return (
            <button
              key={cat.key}
              onClick={() => setActiveCategoryIdx(idx)}
              className={cn(
                'px-3 py-1.5 rounded-lg text-xs font-medium transition-all border',
                idx === activeCategoryIdx
                  ? 'bg-primary text-primary-foreground border-primary'
                  : complete
                  ? 'bg-accent/50 text-accent-foreground border-border'
                  : 'bg-card text-muted-foreground border-border hover:bg-accent/30'
              )}
            >
              {cat.shortLabel}
              <span className="ml-1 opacity-70">{answered}/{cat.questions.length}</span>
            </button>
          );
        })}
      </div>

      {/* Questions for active category */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <span style={{ color: currentCat.color }}>●</span>
            {currentCat.label}
            <Badge variant="outline" className="ml-auto text-xs">{answeredInCat}/{currentCat.questions.length}</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {currentCat.questions.map((q) => (
            <div key={q.id} className="space-y-1.5">
              <p className="text-sm text-foreground">{q.text}</p>
              <div className="flex gap-1">
                {scoreLabels.map((sl) => (
                  <button
                    key={sl.value}
                    onClick={() => handleScore(q.id, sl.value)}
                    title={sl.label}
                    className={cn(
                      'flex-1 py-1.5 text-xs rounded-md border transition-all font-medium',
                      responses[q.id] === sl.value
                        ? 'bg-primary text-primary-foreground border-primary'
                        : 'bg-card text-muted-foreground border-border hover:bg-accent/30'
                    )}
                  >
                    {sl.value}
                  </button>
                ))}
              </div>
            </div>
          ))}

          {/* Navigation buttons */}
          <div className="flex gap-2 pt-3">
            {activeCategoryIdx > 0 && (
              <Button variant="outline" size="sm" onClick={() => setActiveCategoryIdx(activeCategoryIdx - 1)}>
                ← Anterior
              </Button>
            )}
            {activeCategoryIdx < metabolicCategories.length - 1 && (
              <Button variant="outline" size="sm" className="ml-auto" onClick={() => setActiveCategoryIdx(activeCategoryIdx + 1)}>
                Próxima →
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Notes & Submit */}
      <Card>
        <CardContent className="pt-4 space-y-3">
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1 block">Observações (opcional)</label>
            <Textarea value={notes} onChange={e => setNotes(e.target.value)} placeholder="Observações adicionais..." rows={2} />
          </div>
          <div className="flex items-center gap-2">
            <p className="text-xs text-muted-foreground">{totalAnswered}/{totalQuestions} respondidas</p>
            <Button variant="ghost" size="sm" onClick={handleReset} className="ml-auto gap-1">
              <RotateCcw className="h-3.5 w-3.5" /> Limpar
            </Button>
            <Button size="sm" onClick={handleSubmit} disabled={!allAnswered || isSubmitting} className="gap-1">
              <Send className="h-3.5 w-3.5" /> Finalizar
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
