import { useState, useRef, useCallback } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { Label } from '@/components/ui/label';
import { supabase } from '@/integrations/supabase/client';
import { Loader2, Upload, ZoomIn, Move } from 'lucide-react';
import { toast } from 'sonner';

interface ImageUploadDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onImageUploaded: (url: string) => void;
  currentImageUrl?: string;
}

export function ImageUploadDialog({ open, onOpenChange, onImageUploaded, currentImageUrl }: ImageUploadDialogProps) {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [zoom, setZoom] = useState(1);
  const [position, setPosition] = useState({ x: 50, y: 50 });
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const dragStartRef = useRef({ x: 0, y: 0, posX: 0, posY: 0 });

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (!file.type.startsWith('image/')) {
        toast.error('Por favor, selecione uma imagem');
        return;
      }
      setSelectedFile(file);
      const url = URL.createObjectURL(file);
      setPreviewUrl(url);
      setZoom(1);
      setPosition({ x: 50, y: 50 });
    }
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    setIsDragging(true);
    dragStartRef.current = {
      x: e.clientX,
      y: e.clientY,
      posX: position.x,
      posY: position.y,
    };
  };

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!isDragging) return;
    
    const deltaX = e.clientX - dragStartRef.current.x;
    const deltaY = e.clientY - dragStartRef.current.y;
    
    const sensitivity = 0.3 / zoom;
    
    setPosition({
      x: Math.max(0, Math.min(100, dragStartRef.current.posX - deltaX * sensitivity)),
      y: Math.max(0, Math.min(100, dragStartRef.current.posY - deltaY * sensitivity)),
    });
  }, [isDragging, zoom]);

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  const handleUpload = async () => {
    if (!selectedFile) return;

    setIsUploading(true);
    
    try {
      // Create canvas to crop image
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('Could not get canvas context');

      const img = new Image();
      img.crossOrigin = 'anonymous';
      
      await new Promise((resolve, reject) => {
        img.onload = resolve;
        img.onerror = reject;
        img.src = previewUrl!;
      });

      // Output size (square)
      const outputSize = 400;
      canvas.width = outputSize;
      canvas.height = outputSize;

      // Calculate crop dimensions
      const scaledWidth = img.width * zoom;
      const scaledHeight = img.height * zoom;
      
      const cropX = (position.x / 100) * (scaledWidth - outputSize);
      const cropY = (position.y / 100) * (scaledHeight - outputSize);

      // Draw cropped image
      ctx.drawImage(
        img,
        cropX / zoom,
        cropY / zoom,
        outputSize / zoom,
        outputSize / zoom,
        0,
        0,
        outputSize,
        outputSize
      );

      // Convert to blob
      const blob = await new Promise<Blob>((resolve, reject) => {
        canvas.toBlob(
          (b) => b ? resolve(b) : reject(new Error('Failed to create blob')),
          'image/jpeg',
          0.9
        );
      });

      // Upload to Supabase
      const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.jpg`;
      const { data, error } = await supabase.storage
        .from('link-bio-images')
        .upload(fileName, blob, { contentType: 'image/jpeg' });

      if (error) throw error;

      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from('link-bio-images')
        .getPublicUrl(fileName);

      onImageUploaded(publicUrl);
      onOpenChange(false);
      toast.success('Imagem carregada com sucesso!');
      
      // Reset state
      setSelectedFile(null);
      setPreviewUrl(null);
      setZoom(1);
      setPosition({ x: 50, y: 50 });
    } catch (error: any) {
      console.error('Upload error:', error);
      toast.error('Erro ao fazer upload da imagem');
    } finally {
      setIsUploading(false);
    }
  };

  const handleClose = () => {
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
    }
    setSelectedFile(null);
    setPreviewUrl(null);
    setZoom(1);
    setPosition({ x: 50, y: 50 });
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[450px]">
        <DialogHeader>
          <DialogTitle>Upload de Imagem</DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4 py-4">
          {!previewUrl ? (
            <div className="border-2 border-dashed border-muted-foreground/25 rounded-lg p-8 text-center">
              <input
                type="file"
                accept="image/*"
                onChange={handleFileSelect}
                className="hidden"
                id="image-upload"
              />
              <label htmlFor="image-upload" className="cursor-pointer">
                <Upload className="h-10 w-10 mx-auto mb-4 text-muted-foreground" />
                <p className="text-sm text-muted-foreground mb-2">
                  Clique para selecionar uma imagem
                </p>
                <p className="text-xs text-muted-foreground">
                  JPG, PNG ou WEBP
                </p>
              </label>
            </div>
          ) : (
            <>
              <div className="space-y-3">
                <div className="flex items-center justify-center">
                  <div 
                    ref={containerRef}
                    className="relative w-48 h-48 rounded-lg overflow-hidden border-2 border-primary cursor-move"
                    onMouseDown={handleMouseDown}
                    onMouseMove={handleMouseMove}
                    onMouseUp={handleMouseUp}
                    onMouseLeave={handleMouseUp}
                  >
                    <img
                      src={previewUrl}
                      alt="Preview"
                      className="absolute w-full h-full object-cover pointer-events-none"
                      style={{
                        transform: `scale(${zoom})`,
                        transformOrigin: `${position.x}% ${position.y}%`,
                      }}
                      draggable={false}
                    />
                    <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                      <Move className="h-8 w-8 text-white/50 drop-shadow-lg" />
                    </div>
                  </div>
                </div>
                
                <p className="text-xs text-center text-muted-foreground">
                  Arraste para ajustar a posição
                </p>
              </div>
              
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <ZoomIn className="h-4 w-4 text-muted-foreground" />
                  <Label className="text-sm">Zoom</Label>
                </div>
                <Slider
                  value={[zoom]}
                  onValueChange={([value]) => setZoom(value)}
                  min={1}
                  max={3}
                  step={0.1}
                  className="w-full"
                />
              </div>
              
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={() => {
                    if (previewUrl) URL.revokeObjectURL(previewUrl);
                    setSelectedFile(null);
                    setPreviewUrl(null);
                    setZoom(1);
                    setPosition({ x: 50, y: 50 });
                  }}
                >
                  Trocar imagem
                </Button>
                <Button
                  className="flex-1"
                  onClick={handleUpload}
                  disabled={isUploading}
                >
                  {isUploading ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Enviando...
                    </>
                  ) : (
                    'Salvar'
                  )}
                </Button>
              </div>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
