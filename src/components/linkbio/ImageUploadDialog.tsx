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
  // center position in normalized image coords (0..1)
  const [center, setCenter] = useState({ x: 0.5, y: 0.5 });
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const previewCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const imageRef = useRef<HTMLImageElement | null>(null);
  const dragStartRef = useRef({ x: 0, y: 0, centerX: 0.5, centerY: 0.5 });

  const getBaseScale = useCallback(() => {
    const w = imageSize.width;
    const h = imageSize.height;
    if (!w || !h) return 1;
    return Math.max(CONTAINER_SIZE / w, CONTAINER_SIZE / h);
  }, [imageSize.height, imageSize.width]);

  const getDisplayScale = useCallback(() => {
    return getBaseScale() * zoom;
  }, [getBaseScale, zoom]);

  const clampCenter = useCallback(
    (x: number, y: number) => {
      const w = imageSize.width;
      const h = imageSize.height;
      if (!w || !h) return { x: 0.5, y: 0.5 };

      const displayScale = getDisplayScale();
      const sourceW = CONTAINER_SIZE / displayScale;
      const sourceH = CONTAINER_SIZE / displayScale;

      const minX = sourceW / 2 / w;
      const maxX = 1 - minX;
      const minY = sourceH / 2 / h;
      const maxY = 1 - minY;

      return {
        x: Math.max(minX, Math.min(maxX, x)),
        y: Math.max(minY, Math.min(maxY, y)),
      };
    },
    [getDisplayScale, imageSize.height, imageSize.width],
  );

  const getCropRect = useCallback(() => {
    const w = imageSize.width;
    const h = imageSize.height;
    if (!w || !h) {
      return { sx: 0, sy: 0, sWidth: 1, sHeight: 1 };
    }

    const displayScale = getDisplayScale();
    const sWidth = CONTAINER_SIZE / displayScale;
    const sHeight = CONTAINER_SIZE / displayScale;

    const cx = center.x * w;
    const cy = center.y * h;

    const sx = Math.max(0, Math.min(w - sWidth, cx - sWidth / 2));
    const sy = Math.max(0, Math.min(h - sHeight, cy - sHeight / 2));

    return { sx, sy, sWidth, sHeight };
  }, [center.x, center.y, getDisplayScale, imageSize.height, imageSize.width]);

  const drawPreview = useCallback(() => {
    const canvas = previewCanvasRef.current;
    const img = imageRef.current;
    if (!canvas || !img || !imageSize.width || !imageSize.height) return;

    const dpr = window.devicePixelRatio || 1;
    canvas.width = Math.round(CONTAINER_SIZE * dpr);
    canvas.height = Math.round(CONTAINER_SIZE * dpr);
    canvas.style.width = `${CONTAINER_SIZE}px`;
    canvas.style.height = `${CONTAINER_SIZE}px`;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, CONTAINER_SIZE, CONTAINER_SIZE);

    const { sx, sy, sWidth, sHeight } = getCropRect();
    ctx.drawImage(img, sx, sy, sWidth, sHeight, 0, 0, CONTAINER_SIZE, CONTAINER_SIZE);
  }, [getCropRect, imageSize.height, imageSize.width]);

  useEffect(() => {
    // keep center clamped as zoom changes
    setCenter((c) => clampCenter(c.x, c.y));
  }, [zoom, clampCenter]);

  useEffect(() => {
    drawPreview();
  }, [drawPreview]);

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
      setCenter({ x: 0.5, y: 0.5 });

      // Get image dimensions
      const img = new Image();
      img.onload = () => {
        imageRef.current = img;
        setImageSize({ width: img.naturalWidth || img.width, height: img.naturalHeight || img.height });
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
      centerX: center.x,
      centerY: center.y,
    };
  };

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!isDragging) return;
    
    const deltaX = e.clientX - dragStartRef.current.x;
    const deltaY = e.clientY - dragStartRef.current.y;

    const w = imageSize.width;
    const h = imageSize.height;
    if (!w || !h) return;

    const displayScale = getDisplayScale();
    const deltaOriginalX = deltaX / displayScale;
    const deltaOriginalY = deltaY / displayScale;

    // dragging right moves image right => center moves left
    const next = clampCenter(
      dragStartRef.current.centerX - deltaOriginalX / w,
      dragStartRef.current.centerY - deltaOriginalY / h,
    );

    setCenter(next);
  }, [clampCenter, getDisplayScale, imageSize.height, imageSize.width, isDragging]);

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
      centerX: center.x,
      centerY: center.y,
    };
  };

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (!isDragging) return;
    const touch = e.touches[0];
    
    const deltaX = touch.clientX - dragStartRef.current.x;
    const deltaY = touch.clientY - dragStartRef.current.y;

    const w = imageSize.width;
    const h = imageSize.height;
    if (!w || !h) return;

    const displayScale = getDisplayScale();
    const deltaOriginalX = deltaX / displayScale;
    const deltaOriginalY = deltaY / displayScale;

    const next = clampCenter(
      dragStartRef.current.centerX - deltaOriginalX / w,
      dragStartRef.current.centerY - deltaOriginalY / h,
    );

    setCenter(next);
  }, [clampCenter, getDisplayScale, imageSize.height, imageSize.width, isDragging]);

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

      const img = imageRef.current;
      if (!img) throw new Error('Image not loaded');

      canvas.width = OUTPUT_SIZE;
      canvas.height = OUTPUT_SIZE;

      const { sx, sy, sWidth, sHeight } = getCropRect();
      ctx.drawImage(img, sx, sy, sWidth, sHeight, 0, 0, OUTPUT_SIZE, OUTPUT_SIZE);

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
    setCenter({ x: 0.5, y: 0.5 });
    imageRef.current = null;
  };

  const handleClose = () => {
    resetState();
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
                    <canvas ref={previewCanvasRef} className="absolute inset-0 pointer-events-none" />
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
                    setCenter({ x: 0.5, y: 0.5 });
                    imageRef.current = null;
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
