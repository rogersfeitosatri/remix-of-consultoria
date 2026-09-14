import { useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/hooks/useAuth';
import { fetchOpenCheckins } from '@/lib/checkinInbox';
import { checkinWorkflow } from '@/lib/checkinWorkflow';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { format, parseISO } from 'date-fns';

export function PendingReviewsList() {
  const { user } = useAuth();
  const [params] = useSearchParams();
  const [search, setSearch] = useState('');
  const [frequency, setFrequency] = useState('all');
  const [dateFrom, setDateFrom] = useState(params.get('checkinFrom') || '');
  const [dateTo, setDateTo] = useState(params.get('checkinTo') || '');
  const query = useQuery({ queryKey: ['pending_checkin_reviews', user?.id], queryFn: () => fetchOpenCheckins(user!.id), enabled: !!user, refetchInterval: 30000 });
  const rows = useMemo(() => (query.data || []).filter(row => {
    const date = format(parseISO(row.submitted_at), 'yyyy-MM-dd');
    return row.clients.name.toLocaleLowerCase('pt-BR').includes(search.toLocaleLowerCase('pt-BR')) && (frequency === 'all' || row.clients.checkin_frequency === frequency) && (!dateFrom || date >= dateFrom) && (!dateTo || date <= dateTo) && (!params.get('client') || row.client_id === params.get('client'));
  }).sort((a, b) => a.submitted_at.localeCompare(b.submitted_at)), [query.data, search, frequency, dateFrom, dateTo, params]);
  return <section className="space-y-4" aria-label="Check-ins para analisar">
    <div className="flex flex-wrap items-end gap-3">
      <label className="min-w-48 flex-1 space-y-1 text-sm">Buscar atleta<Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Nome do atleta" /></label>
      <details className="text-sm"><summary className="cursor-pointer rounded-lg p-3 focus-visible:ring-2 focus-visible:ring-ring">Filtrar por data e frequência</summary><div className="flex flex-wrap gap-3 py-2">
        <label className="space-y-1">Frequência<select value={frequency} onChange={e => setFrequency(e.target.value)} className="block h-11 rounded-md border border-input bg-background px-3"><option value="all">Todas</option><option value="weekly">Semanal</option><option value="biweekly">Quinzenal</option><option value="monthly">Mensal</option></select></label>
        <label>De<Input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} /></label><label>Até<Input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} /></label>
        <Button variant="ghost" onClick={() => { setDateFrom(''); setDateTo(''); setFrequency('all'); }}>Limpar filtros</Button>
      </div></details>
    </div>
    {query.isLoading ? <p role="status">Carregando respostas…</p> : query.isError ? <div role="alert" className="space-y-2"><p>Não foi possível carregar as respostas.</p><Button variant="outline" onClick={() => query.refetch()}>Tentar novamente</Button></div> : <>
      <p className="text-sm text-muted-foreground">{rows.length} {rows.length === 1 ? 'resposta aguardando ação' : 'respostas aguardando ação'}</p>
      <div className="divide-y divide-border">{rows.map(row => {
        const state = checkinWorkflow(row, row.feedback);
        return <div key={row.id} className="flex flex-wrap items-center gap-3 py-4">
          <div className="min-w-0 flex-1"><Link to={`/clients/${row.client_id}`} className="font-medium hover:underline">{row.clients.name}</Link><p className="text-sm text-muted-foreground">{format(parseISO(row.submitted_at), 'dd/MM/yyyy HH:mm')} · {row.checkin_forms?.title || 'Check-in'}</p><Badge variant="outline" className="mt-2">{state.label}</Badge></div>
          <Button asChild variant="outline" className="min-h-11"><Link to={`/checkin-review/${row.id}`}>{state.action}</Link></Button>
        </div>;
      })}</div>
      {rows.length === 0 && <p className="rounded-lg border border-border p-6 text-sm text-muted-foreground">Nenhuma resposta pendente neste filtro. As respostas anteriores estão em Histórico.</p>}
    </>}
  </section>;
}
