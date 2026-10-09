import { useEffect, useRef, useState } from 'react';
import { ArrowDown, ArrowUp, ImagePlus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';

export const MAX_GALLERY_IMAGES = 8;
export type GalleryImage = { id: string; url: string; file?: File };
export function galleryImageType(file: File) {
  const type = file.type || ({ jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp' }[file.name.split('.').pop()?.toLowerCase() ?? '']);
  return ['image/jpeg', 'image/png', 'image/webp'].includes(type) ? type : null;
}
function Preview({ image, index }: { image: GalleryImage; index: number }) {
  const [localUrl, setLocalUrl] = useState('');
  useEffect(() => {
    if (!image.file) return;
    const url = URL.createObjectURL(image.file); setLocalUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [image.file]);
  const src = image.file ? localUrl : image.url;
  return src ? <img src={src} alt={`Imagem extra ${index + 1}`} className="h-20 w-14 shrink-0 rounded bg-muted object-contain" /> : <span className="h-20 w-14 shrink-0 bg-muted" />;
}
export function BookGalleryEditor({ images, onChange, disabled }: { images: GalleryImage[]; onChange: (images: GalleryImage[]) => void; disabled: boolean }) {
  const input = useRef<HTMLInputElement>(null);
  const [error, setError] = useState('');
  function move(index: number, offset: number) {
    const next = [...images];
    [next[index], next[index + offset]] = [next[index + offset], next[index]];
    onChange(next);
  }
  return <section aria-labelledby="book-gallery-heading" className="space-y-3 rounded-lg border p-4">
    <h3 id="book-gallery-heading" className="font-medium">Mais imagens do livro</h3>
    <p className="text-sm text-muted-foreground">A capa aparece primeiro. Adicione até {MAX_GALLERY_IMAGES} imagens extras para o carrossel: páginas de amostra, sumário ou detalhes. Essas imagens ficam visíveis para todos.</p>
    <p id="book-gallery-help" className="text-xs text-muted-foreground">JPG, PNG ou WebP, até 5 MB por imagem. As alterações são publicadas ao salvar o livro.</p>
    <input ref={input} type="file" multiple accept="image/jpeg,image/png,image/webp,.jpg,.jpeg,.png,.webp" className="hidden" aria-label="Imagens extras do livro" aria-describedby="book-gallery-help" disabled={disabled} onChange={event => {
      const files = Array.from(event.currentTarget.files ?? []); event.currentTarget.value = '';
      if (!files.length) return;
      if (images.length + files.length > MAX_GALLERY_IMAGES) { setError(`Você pode adicionar até ${MAX_GALLERY_IMAGES} imagens extras. Remova uma imagem ou selecione menos arquivos.`); return; }
      if (files.some(file => !galleryImageType(file) || file.size > 5 * 1024 * 1024)) { setError('Use imagens JPG, PNG ou WebP de até 5 MB cada.'); return; }
      setError(''); onChange([...images, ...files.map(file => ({ id: crypto.randomUUID(), url: '', file }))]);
    }} />
    <Button type="button" variant="outline" className="min-h-11 w-full" disabled={disabled || images.length >= MAX_GALLERY_IMAGES} onClick={() => input.current?.click()}><ImagePlus className="mr-2 h-4 w-4" />Adicionar imagens</Button>
    {error && <p className="text-sm text-destructive" role="alert">{error}</p>}
    <ol className="space-y-3">{images.map((image, index) => <li key={image.id} className="flex items-center gap-3 rounded border p-3">
      <Preview image={image} index={index} />
      <div className="min-w-0 flex-1"><p className="text-sm">Imagem extra {index + 1}</p>{image.file && <p className="break-all text-xs text-muted-foreground">{image.file.name}</p>}
        <div className="mt-1 flex flex-wrap gap-1">
          <Button type="button" variant="ghost" size="icon" className="h-11 w-11" aria-label={`Mover imagem ${index + 1} para cima`} disabled={disabled || index === 0} onClick={() => move(index, -1)}><ArrowUp className="h-4 w-4" /></Button>
          <Button type="button" variant="ghost" size="icon" className="h-11 w-11" aria-label={`Mover imagem ${index + 1} para baixo`} disabled={disabled || index === images.length - 1} onClick={() => move(index, 1)}><ArrowDown className="h-4 w-4" /></Button>
          <Button type="button" variant="ghost" size="icon" className="h-11 w-11" aria-label={`Remover imagem ${index + 1}`} disabled={disabled} onClick={() => { setError(''); onChange(images.filter(item => item.id !== image.id)); }}><Trash2 className="h-4 w-4" /></Button>
        </div>
      </div>
    </li>)}</ol>
  </section>;
}
