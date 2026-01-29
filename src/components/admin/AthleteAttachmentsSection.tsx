import { useState, useRef } from 'react';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Paperclip, Upload, Trash2, FileText, Image, File, ExternalLink, X } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { 
  useAthleteAttachments, 
  useAddAthleteAttachment, 
  useDeleteAthleteAttachment,
  AthleteAttachment 
} from '@/hooks/useAthleteSummary';

const TYPE_TAGS = [
  { value: 'exame', label: 'Exame', color: 'bg-blue-500/10 text-blue-500 border-blue-500/20' },
  { value: 'foto', label: 'Foto', color: 'bg-purple-500/10 text-purple-500 border-purple-500/20' },
  { value: 'documento', label: 'Documento', color: 'bg-gray-500/10 text-gray-500 border-gray-500/20' },
  { value: 'outro', label: 'Outro', color: 'bg-yellow-500/10 text-yellow-500 border-yellow-500/20' },
];

const getFileIcon = (fileType: string | null) => {
  if (fileType?.startsWith('image/')) return <Image className="h-4 w-4" />;
  if (fileType?.includes('pdf')) return <FileText className="h-4 w-4" />;
  return <File className="h-4 w-4" />;
};

const getTagColor = (tag: string) => {
  return TYPE_TAGS.find(t => t.value === tag)?.color || TYPE_TAGS[2].color;
};

const formatFileSize = (bytes: number | null) => {
  if (!bytes) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

interface AthleteAttachmentsSectionProps {
  clientId: string;
}

export function AthleteAttachmentsSection({ clientId }: AthleteAttachmentsSectionProps) {
  const { data: attachments = [], isLoading } = useAthleteAttachments(clientId);
  const addAttachment = useAddAthleteAttachment();
  const deleteAttachment = useDeleteAthleteAttachment();
  
  const [showUploadDialog, setShowUploadDialog] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [typeTag, setTypeTag] = useState('documento');
  const [notes, setNotes] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedFile(file);
      setShowUploadDialog(true);
    }
  };
  
  const handleUpload = async () => {
    if (!selectedFile) return;
    
    await addAttachment.mutateAsync({
      clientId,
      file: selectedFile,
      typeTag,
      notes: notes.trim() || undefined,
    });
    
    setShowUploadDialog(false);
    setSelectedFile(null);
    setTypeTag('documento');
    setNotes('');
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };
  
  const handleDelete = async (attachment: AthleteAttachment) => {
    if (confirm(`Remover arquivo "${attachment.file_name}"?`)) {
      await deleteAttachment.mutateAsync({
        id: attachment.id,
        clientId: attachment.client_id,
        fileUrl: attachment.file_url,
      });
    }
  };
  
  const handleCancelUpload = () => {
    setShowUploadDialog(false);
    setSelectedFile(null);
    setTypeTag('documento');
    setNotes('');
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };
  
  if (isLoading) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <Paperclip className="h-4 w-4 text-primary" />
            Arquivos & Links
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Skeleton className="h-24 w-full" />
        </CardContent>
      </Card>
    );
  }
  
  return (
    <>
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Paperclip className="h-4 w-4 text-primary" />
              Arquivos & Links
            </CardTitle>
            <div>
              <input
                type="file"
                ref={fileInputRef}
                onChange={handleFileSelect}
                className="hidden"
                accept="image/*,.pdf,.doc,.docx,.xls,.xlsx"
              />
              <Button 
                variant="outline" 
                size="sm" 
                className="gap-1"
                onClick={() => fileInputRef.current?.click()}
              >
                <Upload className="h-3 w-3" />
                Upload
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {attachments.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Paperclip className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p className="text-sm">Nenhum arquivo anexado</p>
            </div>
          ) : (
            <div className="space-y-2">
              {attachments.map((attachment) => (
                <div 
                  key={attachment.id}
                  className="flex items-center justify-between p-3 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors"
                >
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <div className="flex-shrink-0 text-muted-foreground">
                      {getFileIcon(attachment.file_type)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{attachment.file_name}</p>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <span>{format(parseISO(attachment.created_at), "dd/MM/yy", { locale: ptBR })}</span>
                        {attachment.file_size && (
                          <span>• {formatFileSize(attachment.file_size)}</span>
                        )}
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className={`text-xs ${getTagColor(attachment.type_tag)}`}>
                      {TYPE_TAGS.find(t => t.value === attachment.type_tag)?.label || attachment.type_tag}
                    </Badge>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-8 w-8 p-0"
                      asChild
                    >
                      <a href={attachment.file_url} target="_blank" rel="noopener noreferrer">
                        <ExternalLink className="h-3 w-3" />
                      </a>
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-8 w-8 p-0 text-destructive hover:text-destructive"
                      onClick={() => handleDelete(attachment)}
                      disabled={deleteAttachment.isPending}
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
      
      {/* Upload Dialog */}
      <Dialog open={showUploadDialog} onOpenChange={setShowUploadDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Upload de Arquivo</DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4">
            {selectedFile && (
              <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
                {getFileIcon(selectedFile.type)}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{selectedFile.name}</p>
                  <p className="text-xs text-muted-foreground">{formatFileSize(selectedFile.size)}</p>
                </div>
              </div>
            )}
            
            <div className="space-y-2">
              <label className="text-sm font-medium">Tipo</label>
              <Select value={typeTag} onValueChange={setTypeTag}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TYPE_TAGS.map((tag) => (
                    <SelectItem key={tag.value} value={tag.value}>
                      {tag.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            <div className="space-y-2">
              <label className="text-sm font-medium">Observações (opcional)</label>
              <Input
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Adicione uma descrição..."
              />
            </div>
          </div>
          
          <DialogFooter>
            <Button variant="outline" onClick={handleCancelUpload}>
              Cancelar
            </Button>
            <Button 
              onClick={handleUpload}
              disabled={!selectedFile || addAttachment.isPending}
            >
              {addAttachment.isPending ? 'Enviando...' : 'Enviar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
