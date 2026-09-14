import { useDeferredValue, useState } from 'react';
import { Link } from 'react-router-dom';
import { useInfiniteQuery } from '@tanstack/react-query';
import { useAuth } from '@/hooks/useAuth';
import { fetchCheckinPage } from '@/lib/checkinInbox';
import { checkinWorkflow } from '@/lib/checkinWorkflow';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { format, parseISO } from 'date-fns';

export function CheckinHistoryList({ clientId }: { clientId?: string }) {
  const { user } = useAuth();
  const [search, setSearch] = useState('');
  const deferredSearch = useDeferredValue(search);
  const size = 50;
  const query = useInfiniteQuery({
    queryKey: ['checkin_history', user?.id, clientId, deferredSearch],
    queryFn: ({ pageParam }) => fetchCheckinPage(user!.id, pageParam, size, false, clientId, deferredSearch),
    initialPageParam: 0,
    getNextPageParam: (lastPage, pages) => lastPage.length === size ? pages.length * size : undefined,
    enabled: !!user,
  });
  const rows = query.data?.pages.flat() || [];
  return <section className="space-y-4" aria-label="Histórico de check-ins">
    {!clientId && <label className="block max-w-md space-y-1 text-sm">Buscar atleta<Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Nome do atleta" /></label>}
    {query.isPending ? <p role="status">Carregando histórico…</p> : query.isError ? <div role="alert"><p>Não foi possível carregar o histórico.</p><Button variant="outline" onClick={() => query.refetch()}>Tentar novamente</Button></div> : <>
      {rows.length === 0 && <p className="p-4 text-sm text-muted-foreground">Nenhuma resposta encontrada.</p>}
      <div className="divide-y divide-border">{rows.map(row => <Link key={row.id} to={`/checkin-review/${row.id}`} className="flex flex-wrap items-center justify-between gap-3 rounded py-4 hover:bg-muted/50 focus-visible:ring-2 focus-visible:ring-ring">
        <div><p className="font-medium">{row.clients.name}</p><p className="text-sm text-muted-foreground">{format(parseISO(row.submitted_at), 'dd/MM/yyyy HH:mm')} · {row.checkin_forms?.title || 'Check-in'}</p></div>
        <Badge variant="outline">{checkinWorkflow(row, row.feedback).label}</Badge>
      </Link>)}</div>
      {query.hasNextPage && <Button variant="outline" onClick={() => query.fetchNextPage()} disabled={query.isFetchingNextPage}>{query.isFetchingNextPage ? 'Carregando…' : 'Carregar respostas anteriores'}</Button>}
    </>}
  </section>;
}
