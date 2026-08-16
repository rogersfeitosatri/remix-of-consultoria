/**
 * Shell visual comum das seções do dashboard.
 * Sem card, sem borda: apenas título discreto + lista com separadores sutis.
 * (ETAPA 2B — apenas apresentação; nenhuma regra de negócio aqui.)
 */
import type { ReactNode } from 'react';

export function DashboardSection({
  title,
  count,
  action,
  children,
}: {
  title: string;
  count?: number;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="space-y-1">
      <div className="flex items-center justify-between gap-2 px-1">
        <h2 className="text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
          {title}
          {count != null && count > 0 && <span className="ml-1.5 tabular-nums opacity-70">{count}</span>}
        </h2>
        {action}
      </div>
      <div className="divide-y divide-border/50">{children}</div>
    </section>
  );
}

/** Linha tocável padrão: conteúdo à esquerda, indicador à direita. */
export function RowButton({
  onClick,
  children,
  lateMark = false,
}: {
  onClick: () => void;
  children: ReactNode;
  lateMark?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="group relative flex w-full items-center gap-3 rounded-md px-3 py-3 text-left transition-colors hover:bg-muted/50 active:bg-muted"
    >
      {lateMark && (
        <span
          aria-hidden
          className="absolute left-0 top-1/2 h-5 w-[3px] -translate-y-1/2 rounded-full bg-destructive"
        />
      )}
      {children}
    </button>
  );
}
