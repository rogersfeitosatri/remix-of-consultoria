import { useState } from 'react';
import { WhatsAppTemplate, useSaveWhatsAppTemplate, DEFAULT_WHATSAPP_TEMPLATES } from '@/hooks/useWhatsAppTemplates';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Save, RotateCcw, Variable } from 'lucide-react';

interface WhatsAppTemplatesTabProps {
  templates: WhatsAppTemplate[];
}

export function WhatsAppTemplatesTab({ templates }: WhatsAppTemplatesTabProps) {
  const [editedTemplates, setEditedTemplates] = useState<Record<string, { body: string; is_active: boolean }>>({});
  const saveTemplate = useSaveWhatsAppTemplate();

  const getTemplateData = (template: WhatsAppTemplate) => {
    return editedTemplates[template.id] || { body: template.body, is_active: template.is_active };
  };

  const hasChanges = (template: WhatsAppTemplate) => {
    const edited = editedTemplates[template.id];
    if (!edited) return false;
    return edited.body !== template.body || edited.is_active !== template.is_active;
  };

  const handleChange = (templateId: string, field: 'body' | 'is_active', value: string | boolean) => {
    setEditedTemplates(prev => ({
      ...prev,
      [templateId]: {
        ...prev[templateId],
        [field]: value,
      },
    }));
  };

  const handleSave = (template: WhatsAppTemplate) => {
    const data = getTemplateData(template);
    saveTemplate.mutate({
      id: template.id,
      body: data.body,
      is_active: data.is_active,
    });
  };

  const handleReset = (template: WhatsAppTemplate) => {
    const defaultTemplate = DEFAULT_WHATSAPP_TEMPLATES.find(t => t.template_key === template.template_key);
    if (defaultTemplate) {
      setEditedTemplates(prev => ({
        ...prev,
        [template.id]: {
          body: defaultTemplate.body,
          is_active: true,
        },
      }));
    }
  };

  const getTemplateLabel = (key: string) => {
    switch (key) {
      case 'reminder_15m': return 'Lembrete 15 min antes';
      case 'booking_invite': return 'Convite de Agendamento';
      case 'booking_confirmed': return 'Confirmação de Agendamento';
      default: return key;
    }
  };

  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-blue-200 bg-blue-50 p-4 dark:border-blue-900 dark:bg-blue-950">
        <p className="text-sm text-blue-800 dark:text-blue-200">
          <strong>💡 Dica:</strong> Os templates usam variáveis entre chaves como <code className="bg-blue-100 dark:bg-blue-900 px-1 rounded">{'{nome}'}</code>. 
          Quando a mensagem for enviada, elas serão substituídas pelos valores reais.
        </p>
      </div>

      {templates.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">
            Nenhum template encontrado. Os templates serão criados automaticamente.
          </CardContent>
        </Card>
      ) : (
        <Accordion type="multiple" className="space-y-2">
          {templates.map((template) => {
            const data = getTemplateData(template);
            const changed = hasChanges(template);

            return (
              <AccordionItem key={template.id} value={template.id} className="border rounded-lg">
                <AccordionTrigger className="px-4 hover:no-underline">
                  <div className="flex items-center gap-3">
                    <span className="font-medium">{template.template_name}</span>
                    <Badge variant={data.is_active ? 'default' : 'secondary'}>
                      {data.is_active ? 'Ativo' : 'Inativo'}
                    </Badge>
                    {changed && (
                      <Badge variant="outline" className="text-orange-600 border-orange-300">
                        Alterado
                      </Badge>
                    )}
                  </div>
                </AccordionTrigger>
                <AccordionContent className="px-4 pb-4">
                  <div className="space-y-4">
                    <div className="flex items-center gap-2">
                      <Switch
                        id={`active-${template.id}`}
                        checked={data.is_active}
                        onCheckedChange={(checked) => handleChange(template.id, 'is_active', checked)}
                      />
                      <Label htmlFor={`active-${template.id}`}>
                        {data.is_active ? 'Template ativo' : 'Template desativado'}
                      </Label>
                    </div>

                    {template.variables && template.variables.length > 0 && (
                      <div className="flex items-center gap-2 flex-wrap">
                        <Variable className="h-4 w-4 text-muted-foreground" />
                        <span className="text-sm text-muted-foreground">Variáveis:</span>
                        {template.variables.map((v) => (
                          <Badge key={v} variant="outline" className="font-mono text-xs">
                            {`{${v}}`}
                          </Badge>
                        ))}
                      </div>
                    )}

                    <Textarea
                      value={data.body}
                      onChange={(e) => handleChange(template.id, 'body', e.target.value)}
                      rows={10}
                      className="font-mono text-sm"
                    />

                    <div className="flex gap-2">
                      <Button
                        onClick={() => handleSave(template)}
                        disabled={saveTemplate.isPending || !changed}
                        size="sm"
                      >
                        <Save className="h-4 w-4 mr-1" />
                        Salvar
                      </Button>
                      <Button
                        onClick={() => handleReset(template)}
                        variant="outline"
                        size="sm"
                      >
                        <RotateCcw className="h-4 w-4 mr-1" />
                        Restaurar Padrão
                      </Button>
                    </div>
                  </div>
                </AccordionContent>
              </AccordionItem>
            );
          })}
        </Accordion>
      )}
    </div>
  );
}
