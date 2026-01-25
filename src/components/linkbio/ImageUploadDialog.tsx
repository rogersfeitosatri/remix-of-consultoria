import { useState, useRef, useCallback, useEffect } from 'react';
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

const CONTAINER_SIZE = 192; // Size of the preview container
const OUTPUT_SIZE = 400; // Size of the output image

export function ImageUploadDialog({ open, onOpenChange, onImageUploaded, currentImageUrl }: ImageUploadDialogProps) {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [imageSize, setImageSize] = useState({ width: 0, height: 0 });
  const [zoom, setZoom] = useState(1);
  const [position, setPosition] = useState({ x: 0, y: 0 }); // Position in pixels
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const dragStartRef = useRef({ x: 0, y: 0, posX: 0, posY: 0 });

  // Calculate the scaled image dimensions
  const getScaledDimensions = useCallback(() => {
    if (imageSize.width === 0 || imageSize.height === 0) {
      return { width: CONTAINER_SIZE, height: CONTAINER_SIZE };
    }

    // Scale image to cover container (smallest dimension fits container)
    // Then apply zoom on top of that
    const aspectRatio = imageSize.width / imageSize.height;
    let baseWidth, baseHeight;

    if (aspectRatio > 1) {
      // Landscape image: height fits container exactly, width extends beyond
      baseHeight = CONTAINER_SIZE;
      baseWidth = CONTAINER_SIZE * aspectRatio;
    } else {
      // Portrait image: width fits container exactly, height extends beyond
      baseWidth = CONTAINER_SIZE;
      baseHeight = CONTAINER_SIZE / aspectRatio;
    }

    // Apply zoom proportionally to both dimensions
    return {
      width: Math.round(baseWidth * zoom),
      height: Math.round(baseHeight * zoom),
    };
  }, [imageSize, zoom]);

  // Calculate max position bounds
  const getPositionBounds = useCallback(() => {
    const scaled = getScaledDimensions();
    return {
      maxX: Math.max(0, scaled.width - CONTAINER_SIZE),
      maxY: Math.max(0, scaled.height - CONTAINER_SIZE),
    };
  }, [getScaledDimensions]);

  // Clamp position within bounds
  const clampPosition = useCallback((x: number, y: number) => {
    const bounds = getPositionBounds();
    return {
      x: Math.max(0, Math.min(bounds.maxX, x)),
      y: Math.max(0, Math.min(bounds.maxY, y)),
    };
  }, [getPositionBounds]);

  // Reset position when zoom changes to keep it in bounds
  useEffect(() => {
    setPosition(prev => clampPosition(prev.x, prev.y));
  }, [zoom, clampPosition]);

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
      setPosition({ x: 0, y: 0 });

      // Get image dimensions
      const img = new Image();
      img.onload = () => {
        setImageSize({ width: img.width, height: img.height });
      };
      img.src = url;
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
    
    // Invert delta because dragging right should move the crop area left (show more of right side)
    const newPos = clampPosition(
      dragStartRef.current.posX - deltaX,
      dragStartRef.current.posY - deltaY
    );
    
    setPosition(newPos);
  }, [isDragging, clampPosition]);

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  // Touch support
  const handleTouchStart = (e: React.TouchEvent) => {
    e.preventDefault();
    const touch = e.touches[0];
    setIsDragging(true);
    dragStartRef.current = {
      x: touch.clientX,
      y: touch.clientY,
      posX: position.x,
      posY: position.y,
    };
  };

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (!isDragging) return;
    const touch = e.touches[0];
    
    const deltaX = touch.clientX - dragStartRef.current.x;
    const deltaY = touch.clientY - dragStartRef.current.y;
    
    const newPos = clampPosition(
      dragStartRef.current.posX - deltaX,
      dragStartRef.current.posY - deltaY
    );
    
    setPosition(newPos);
  }, [isDragging, clampPosition]);

  const handleTouchEnd = () => {
    setIsDragging(false);
  };

  const handleUpload = async () => {
    if (!selectedFile || !previewUrl) return;

    setIsUploading(true);
    
    try {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('Could not get canvas context');

      const img = new Image();
      img.crossOrigin = 'anonymous';
      
      await new Promise((resolve, reject) => {
        img.onload = resolve;
        img.onerror = reject;
        img.src = previewUrl;
      });

      canvas.width = OUTPUT_SIZE;
      canvas.height = OUTPUT_SIZE;

      // Calculate the source rectangle from the original image
      const scaled = getScaledDimensions();
      
      // Scale factor from original image to scaled display
      const scaleFactorX = img.width / scaled.width;
      const scaleFactorY = img.height / scaled.height;

      // Source coordinates in original image pixels
      const sourceX = position.x * scaleFactorX;
      const sourceY = position.y * scaleFactorY;
      const sourceWidth = CONTAINER_SIZE * scaleFactorX;
      const sourceHeight = CONTAINER_SIZE * scaleFactorY;

      // Draw the cropped portion to the canvas
      ctx.drawImage(
        img,
        sourceX,
        sourceY,
        sourceWidth,
        sourceHeight,
        0,
        0,
        OUTPUT_SIZE,
        OUTPUT_SIZE
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
      resetState();
    } catch (error: any) {
      console.error('Upload error:', error);
      toast.error('Erro ao fazer upload da imagem');
    } finally {
      setIsUploading(false);
    }
  };

  const resetState = () => {
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
    }
    setSelectedFile(null);
    setPreviewUrl(null);
    setImageSize({ width: 0, height: 0 });
    setZoom(1);
    setPosition({ x: 0, y: 0 });
  };

  const handleClose = () => {
    resetState();
    onOpenChange(false);
  };

  const scaled = getScaledDimensions();

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
                    className="relative rounded-lg overflow-hidden border-2 border-primary cursor-move select-none"
                    style={{ width: CONTAINER_SIZE, height: CONTAINER_SIZE }}
                    onMouseDown={handleMouseDown}
                    onMouseMove={handleMouseMove}
                    onMouseUp={handleMouseUp}
                    onMouseLeave={handleMouseUp}
                    onTouchStart={handleTouchStart}
                    onTouchMove={handleTouchMove}
                    onTouchEnd={handleTouchEnd}
                  >
                    <img
                      src={previewUrl}
                      alt="Preview"
                      className="absolute pointer-events-none"
                      style={{
                        width: scaled.width,
                        height: scaled.height,
                        transform: `translate(${-position.x}px, ${-position.y}px)`,
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
                  step={0.05}
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
                    setImageSize({ width: 0, height: 0 });
                    setZoom(1);
                    setPosition({ x: 0, y: 0 });
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
