// Popover leve para sugestões (alimentos ou medidas) ancorado no cursor do
// textarea. Sem Radix — usa posicionamento absoluto para ficar próximo ao
// caret e funcionar bem no celular.
import { useEffect, useRef } from 'react';
import { Loader2, Sparkles, Star } from 'lucide-react';

export interface SuggestionItem {
  key: string;
  label: string;
  hint?: string;
  onSelect: () => void;
  /** Se presente, mostra uma estrelinha alternável (favorito) à direita. */
  favorite?: { active: boolean; onToggle: () => void };
}

export function SuggestionPopover({
  open, items, x, y, activeIndex, onHover, loading, footer,
}: {
  open: boolean;
  items: SuggestionItem[];
  x: number; y: number;
  activeIndex: number;
  onHover: (i: number) => void;
  loading?: boolean;
  footer?: React.ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current?.querySelector<HTMLButtonElement>(`[data-idx="${activeIndex}"]`);
    el?.scrollIntoView({ block: 'nearest' });
  }, [activeIndex]);

  if (!open) return null;
  return (
    <div
      ref={ref}
      className="fixed z-[80] w-[min(320px,90vw)] rounded-lg border bg-background shadow-lg overflow-hidden"
      style={{ left: Math.max(8, x), top: Math.max(8, y) }}
    >
      {loading && (
        <div className="flex items-center gap-2 px-3 py-2 text-xs text-muted-foreground border-b">
          <Loader2 className="h-3.5 w-3.5 animate-spin" /> Buscando…
        </div>
      )}
      <div className="max-h-64 overflow-auto py-1">
        {items.length === 0 && !loading && (
          <div className="px-3 py-4 text-center text-xs text-muted-foreground">
            <Sparkles className="h-3.5 w-3.5 inline mr-1" />
            Continue digitando para ver sugestões
          </div>
        )}
        {items.map((it, i) => (
          <div
            key={it.key}
            data-idx={i}
            onMouseEnter={() => onHover(i)}
            className={`w-full flex items-center gap-2 px-3 py-2 text-left text-sm ${
              i === activeIndex ? 'bg-accent text-accent-foreground' : 'hover:bg-accent/60'
            }`}
          >
            <button
              type="button"
              onMouseDown={(e) => { e.preventDefault(); it.onSelect(); }}
              className="flex-1 min-w-0 flex items-center justify-between gap-2 text-left"
            >
              <span className="truncate">{it.label}</span>
              {it.hint && <span className="text-xs text-muted-foreground shrink-0">{it.hint}</span>}
            </button>
            {it.favorite && (
              <button
                type="button"
                aria-label={it.favorite.active ? 'Remover favorito' : 'Favoritar alimento'}
                title={it.favorite.active ? 'Remover favorito' : 'Favoritar alimento'}
                onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); it.favorite!.onToggle(); }}
                className="shrink-0 p-1 rounded hover:bg-background/60"
              >
                <Star
                  className={`h-3.5 w-3.5 ${it.favorite.active ? 'fill-amber-400 text-amber-500' : 'text-muted-foreground'}`}
                />
              </button>
            )}
          </div>
        ))}
      </div>
      {footer && <div className="border-t px-3 py-1.5 text-xs">{footer}</div>}
    </div>
  );
}
