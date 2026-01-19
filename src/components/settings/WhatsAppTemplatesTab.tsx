import { useState } from 'react';
import { WhatsAppTemplate, useSaveWhatsAppTemplate, DEFAULT_WHATSAPP_TEMPLATES, renderTemplate } from '@/hooks/useWhatsAppTemplates';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Save, RotateCcw, Variable, Eye } from 'lucide-react';

interface WhatsAppTemplatesTabProps {
  templates: WhatsAppTemplate[];
}

export function WhatsAppTemplatesTab({ templates }: WhatsAppTemplatesTabProps) {
  const [editedTemplates, setEditedTemplates] = useState<Record<string, { 
    title: string; 
    body: string; 
    is_active: boolean 
  }>>({});
  const [showPreview, setShowPreview] = useState<Record<string, boolean>>({});
  const saveTemplate = useSaveWhatsAppTemplate();

  const getTemplateData = (template: WhatsAppTemplate) => {
    return editedTemplates[template.id] || { 
      title: template.title || '', 
      body: template.body || '', 
      is_active: template.is_active 
    };
  };

  const hasChanges = (template: WhatsAppTemplate) => {
    const edited = editedTemplates[template.id];
    if (!edited) return false;
    return edited.title !== (template.title || '') || 
           edited.body !== template.body || 
           edited.is_active !== template.is_active;
  };

  const handleChange = (templateId: string, field: 'title' | 'body' | 'is_active', value: string | boolean) => {
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
      title: data.title,
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
          title: defaultTemplate.title || '',
          body: defaultTemplate.body,
          is_active: true,
        },
      }));
    }
  };

  const togglePreview = (templateId: string) => {
    setShowPreview(prev => ({
      ...prev,
      [templateId]: !prev[templateId],
    }));
  };

  const getPreviewVariables = (template: WhatsAppTemplate): Record<string, string> => {
    const vars: Record<string, string> = {};
    for (const v of template.variables || []) {
      switch (v) {
        case 'nome': vars[v] = 'João'; break;
        case 'data': vars[v] = '20/01/2026'; break;
        case 'hora': vars[v] = '14:30'; break;
        case 'link': vars[v] = 'https://meet.google.com/abc-defg-hij'; break;
        case 'meet_link': vars[v] = 'https://meet.google.com/abc-defg-hij'; break;
        case 'booking_link': vars[v] = 'https://rogersfeitosa.com.br/booking/abc123'; break;
        case 'link_checkin': vars[v] = 'https://rogersfeitosa.com.br/checkin/form123'; break;
        default: vars[v] = `[${v}]`;
      }
    }
    return vars;
  };

  // Filter out deprecated booking_invite template (replaced by weekly_booking_link)
  const visibleTemplates = templates.filter(t => t.template_key !== 'booking_invite');

  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-blue-200 bg-blue-50 p-4 dark:border-blue-900 dark:bg-blue-950">
        <p className="text-sm text-blue-800 dark:text-blue-200">
          <strong>💡 Dica:</strong> Edite o <strong>título</strong> e o <strong>corpo</strong> das mensagens. 
          Use variáveis como <code className="bg-blue-100 dark:bg-blue-900 px-1 rounded">{'{nome}'}</code> que serão substituídas automaticamente.
          Mensagens programadas usarão sempre a versão mais recente do template!
        </p>
      </div>

      {visibleTemplates.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">
            Nenhum template encontrado. Os templates serão criados automaticamente.
          </CardContent>
        </Card>
      ) : (
        <Accordion type="multiple" className="space-y-2">
          {visibleTemplates.map((template) => {
            const data = getTemplateData(template);
            const changed = hasChanges(template);
            const previewVars = getPreviewVariables(template);
            const preview = renderTemplate({ title: data.title, body: data.body }, previewVars);

            return (
              <AccordionItem key={template.id} value={template.id} className="border rounded-lg">
                <AccordionTrigger className="px-4 hover:no-underline">
                  <div className="flex items-center gap-3 flex-wrap">
                    <span className="font-medium">{template.template_name}</span>
                    <Badge variant={data.is_active ? 'default' : 'secondary'}>
                      {data.is_active ? 'Ativo' : 'Inativo'}
                    </Badge>
                    {changed && (
                      <Badge variant="outline" className="text-orange-600 border-orange-300">
                        Alterado
                      </Badge>
                    )}
                    {template.default_timing && (
                      <span className="text-xs text-muted-foreground">
                        📅 {template.default_timing}
                      </span>
                    )}
                  </div>
                </AccordionTrigger>
                <AccordionContent className="px-4 pb-4">
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
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
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => togglePreview(template.id)}
                      >
                        <Eye className="h-4 w-4 mr-1" />
                        {showPreview[template.id] ? 'Ocultar' : 'Ver'} Preview
                      </Button>
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

                    <div className="space-y-2">
                      <Label htmlFor={`title-${template.id}`}>Título da mensagem</Label>
                      <Input
                        id={`title-${template.id}`}
                        value={data.title}
                        onChange={(e) => handleChange(template.id, 'title', e.target.value)}
                        placeholder="Ex: ⏰ Lembrete de Consulta"
                        className="font-medium"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor={`body-${template.id}`}>Corpo da mensagem</Label>
                      <Textarea
                        id={`body-${template.id}`}
                        value={data.body}
                        onChange={(e) => handleChange(template.id, 'body', e.target.value)}
                        rows={10}
                        className="font-mono text-sm"
                      />
                    </div>

                    {showPreview[template.id] && (
                      <div className="rounded-lg border bg-muted/50 p-4 space-y-2">
                        <p className="text-sm font-medium text-muted-foreground">Preview da mensagem:</p>
                        <div className="bg-green-50 dark:bg-green-950 rounded-lg p-3 border border-green-200 dark:border-green-800">
                          {preview.title && (
                            <p className="font-bold text-green-900 dark:text-green-100 mb-2">{preview.title}</p>
                          )}
                          <pre className="whitespace-pre-wrap text-sm text-green-800 dark:text-green-200 font-sans">
                            {preview.body}
                          </pre>
                        </div>
                      </div>
                    )}

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