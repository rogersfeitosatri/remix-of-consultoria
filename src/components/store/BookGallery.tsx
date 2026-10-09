import { useEffect, useState } from 'react';
import useEmblaCarousel from 'embla-carousel-react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { BookCover } from './BookCover';
import type { StoreProduct } from '@/lib/storeTypes';

type GalleryProduct = Pick<StoreProduct, 'title' | 'cover_url' | 'author' | 'gallery_urls'>;
export function BookGallery({ product }: { product: GalleryProduct }) {
  const images = [...new Set([product.cover_url, ...(product.gallery_urls ?? [])].filter((url): url is string => !!url))];
  if (!images.length) return <BookCover product={product} large />;
  if (images.length === 1) return <BookCover product={{ ...product, cover_url: images[0] }} large />;
  return <ImageCarousel key={images.join('|')} images={images} title={product.title} />;
}

function ImageCarousel({ images, title }: { images: string[]; title: string }) {
  const [viewport, api] = useEmblaCarousel({ loop: false, align: 'start' });
  const [selected, setSelected] = useState(0);
  useEffect(() => {
    if (!api) return;
    const update = () => setSelected(api.selectedScrollSnap());
    update();
    api.on('select', update).on('reInit', update);
    return () => { api.off('select', update).off('reInit', update); };
  }, [api]);
  function go(index: number) {
    api?.scrollTo(index, window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  }
  return <section className="store-gallery" aria-label={`Imagens de ${title}`} aria-roledescription="carrossel">
    <div className="store-gallery-viewport" ref={viewport} tabIndex={0} aria-label="Use as setas do teclado para navegar nas imagens" onKeyDown={event => {
      if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
        event.preventDefault(); go(selected + (event.key === 'ArrowLeft' ? -1 : 1));
      }
    }}>
      <div className="store-gallery-track">{images.map((url, index) => <div className="store-gallery-slide" key={url} role="group" aria-roledescription="imagem" aria-label={`${index + 1} de ${images.length}`} aria-hidden={selected !== index}>
        <img src={url} alt={index === 0 ? `Capa de ${title}` : `Imagem ${index + 1} de ${title}`} loading={index === 0 ? 'eager' : 'lazy'} draggable={false} />
      </div>)}</div>
    </div>
    <div className="store-gallery-navigation">
      <button type="button" onClick={() => go(selected - 1)} disabled={selected === 0} aria-label="Imagem anterior"><ChevronLeft size={20} aria-hidden="true" /></button>
      <span aria-live="polite" aria-atomic="true">{selected + 1} de {images.length}</span>
      <button type="button" onClick={() => go(selected + 1)} disabled={selected === images.length - 1} aria-label="Próxima imagem"><ChevronRight size={20} aria-hidden="true" /></button>
    </div>
    <div className="store-gallery-thumbnails" aria-label="Escolher imagem">{images.map((url, index) => <button type="button" key={url} aria-label={`Ver imagem ${index + 1}`} aria-pressed={selected === index} onClick={() => go(index)}>
      <img src={url} alt="" loading="lazy" />
    </button>)}</div>
  </section>;
}
