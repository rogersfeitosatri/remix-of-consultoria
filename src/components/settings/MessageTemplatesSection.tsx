import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2, Save, RotateCcw, MessageSquare, Info } from 'lucide-react';
import { toast } from 'sonner';
import {
  useMessageTemplates,
  useSaveMessageTemplate,
  useInitializeDefaultTemplates,
  DEFAULT_TEMPLATES,
  getTemplateContent,
} from '@/hooks/useMessageTemplates';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';

export function MessageTemplatesSection() {
  const { data: templates, isLoading } = useMessageTemplates();
  const saveTemplate = useSaveMessageTemplate();
  const initializeTemplates = useInitializeDefaultTemplates();
  const [editedTemplates, setEditedTemplates] = useState<Record<string, string>>({});
  const [hasChanges, setHasChanges] = useState<Record<string, boolean>>({});

  // Initialize templates if user has none
  useEffect(() => {
    if (templates && templates.length === 0) {
      initializeTemplates.mutate();
    }
  }, [templates]);

  // Load template content into state
  useEffect(() => {
    if (templates) {
      const contentMap: Record<string, string> = {};
      DEFAULT_TEMPLATES.forEach(dt => {
        contentMap[dt.template_key] = getTemplateContent(templates, dt.template_key);
      });
      setEditedTemplates(contentMap);
      setHasChanges({});
    }
  }, [templates]);

  const handleChange = (key: string, value: string) => {
    setEditedTemplates(prev => ({ ...prev, [key]: value }));
    
    // Check if content differs from saved
    const originalContent = getTemplateContent(templates, key);
    setHasChanges(prev => ({ ...prev, [key]: value !== originalContent }));
  };

  const handleSave = async (key: string) => {
    const defaultTemplate = DEFAULT_TEMPLATES.find(t => t.template_key === key);
    if (!defaultTemplate) return;

    try {
      await saveTemplate.mutateAsync({
        template_key: key,
        template_name: defaultTemplate.template_name,
        template_content: editedTemplates[key] || defaultTemplate.template_content,
        description: defaultTemplate.description,
        available_variables: defaultTemplate.available_variables,
      });
      
      setHasChanges(prev => ({ ...prev, [key]: false }));
      toast.success('Mensagem salva com sucesso!');
    } catch (error) {
      toast.error('Erro ao salvar mensagem');
      console.error(error);
    }
  };

  const handleReset = (key: string) => {
    const defaultTemplate = DEFAULT_TEMPLATES.find(t => t.template_key === key);
    if (defaultTemplate) {
      setEditedTemplates(prev => ({
        ...prev,
        [key]: defaultTemplate.template_content,
      }));
      setHasChanges(prev => ({
        ...prev,
        [key]: getTemplateContent(templates, key) !== defaultTemplate.template_content,
      }));
    }
  };

  if (isLoading || initializeTemplates.isPending) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
        <span className="ml-2">Carregando mensagens...</span>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <Alert className="border-primary/30 bg-primary/5">
        <Info className="h-4 w-4 text-primary" />
        <AlertDescription>
          Personalize as mensagens enviadas aos seus atletas via WhatsApp. 
          Use as variáveis disponíveis (ex: {'{nome}'}) para inserir dados dinâmicos.
        </AlertDescription>
      </Alert>

      <Accordion type="single" collapsible className="space-y-2">
        {DEFAULT_TEMPLATES.map((defaultTemplate) => (
          <AccordionItem 
            key={defaultTemplate.template_key} 
            value={defaultTemplate.template_key}
            className="border rounded-lg bg-background"
          >
            <AccordionTrigger className="px-4 hover:no-underline">
              <div className="flex items-center gap-3 text-left">
                <MessageSquare className="h-4 w-4 text-primary shrink-0" />
                <div>
                  <div className="font-medium flex items-center gap-2">
                    {defaultTemplate.template_name}
                    {hasChanges[defaultTemplate.template_key] && (
                      <Badge variant="secondary" className="text-xs">
                        Não salvo
                      </Badge>
                    )}
                  </div>
                  <div className="text-sm text-muted-foreground font-normal">
                    {defaultTemplate.description}
                  </div>
                </div>
              </div>
            </AccordionTrigger>
            <AccordionContent className="px-4 pb-4">
              <div className="space-y-4">
                <div>
                  <Label htmlFor={`template-${defaultTemplate.template_key}`}>
                    Conteúdo da mensagem
                  </Label>
                  <Textarea
                    id={`template-${defaultTemplate.template_key}`}
                    value={editedTemplates[defaultTemplate.template_key] || ''}
                    onChange={(e) => handleChange(defaultTemplate.template_key, e.target.value)}
                    className="mt-2 min-h-[150px] font-mono text-sm"
                    placeholder="Digite o conteúdo da mensagem..."
                  />
                </div>

                {defaultTemplate.available_variables && defaultTemplate.available_variables.length > 0 && (
                  <div>
                    <Label className="text-sm text-muted-foreground">
                      Variáveis disponíveis:
                    </Label>
                    <div className="flex flex-wrap gap-2 mt-2">
                      {defaultTemplate.available_variables.map((variable) => (
                        <Badge
                          key={variable}
                          variant="outline"
                          className="cursor-pointer hover:bg-primary/10"
                          onClick={() => {
                            const textarea = document.getElementById(
                              `template-${defaultTemplate.template_key}`
                            ) as HTMLTextAreaElement;
                            if (textarea) {
                              const start = textarea.selectionStart;
                              const end = textarea.selectionEnd;
                              const text = editedTemplates[defaultTemplate.template_key] || '';
                              const newText = text.substring(0, start) + variable + text.substring(end);
                              handleChange(defaultTemplate.template_key, newText);
                              // Restore cursor position after the inserted variable
                              setTimeout(() => {
                                textarea.focus();
                                textarea.setSelectionRange(start + variable.length, start + variable.length);
                              }, 0);
                            }
                          }}
                        >
                          {variable}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}

                <div className="flex flex-col sm:flex-row gap-2 pt-2">
                  <Button
                    onClick={() => handleSave(defaultTemplate.template_key)}
                    disabled={saveTemplate.isPending || !hasChanges[defaultTemplate.template_key]}
                    className="gap-2"
                  >
                    {saveTemplate.isPending ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Save className="h-4 w-4" />
                    )}
                    Salvar
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => handleReset(defaultTemplate.template_key)}
                    className="gap-2"
                  >
                    <RotateCcw className="h-4 w-4" />
                    Restaurar Padrão
                  </Button>
                </div>
              </div>
            </AccordionContent>
          </AccordionItem>
        ))}
      </Accordion>
    </div>
  );
}
