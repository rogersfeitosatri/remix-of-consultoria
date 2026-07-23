import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Loader2, Ticket, TrendingUp } from 'lucide-react';

interface Stats {
  promoter: { name: string; handle: string | null };
  total_uses: number;
  by_coupon: { code: string; uses: number }[];
  updated_at: string;
}

// Painel público do criador: mostra APENAS quantas pessoas usaram o cupom dele.
// Nenhum dado de quem usou é exibido (nem existe na resposta da função).
export default function PublicPromoterStats() {
  const { ref } = useParams<{ ref: string }>();
  const [stats, setStats] = useState<Stats | null>(null);
  const [status, setStatus] = useState<'loading' | 'ok' | 'notfound' | 'error'>('loading');

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const { data, error } = await supabase.functions.invoke('zn-promoter-stats', { body: { ref } });
        if (!alive) return;
        if (error || (data as any)?.error) {
          setStatus((data as any)?.error === 'not_found' ? 'notfound' : 'error');
          return;
        }
        setStats(data as Stats);
        setStatus('ok');
      } catch {
        if (alive) setStatus('error');
      }
    })();
    return () => { alive = false; };
  }, [ref]);

  return (
    <div className="min-h-screen bg-gradient-to-b from-zinc-950 to-black text-zinc-100 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {status === 'loading' && (
          <div className="flex justify-center py-20"><Loader2 className="h-7 w-7 animate-spin text-amber-400" /></div>
        )}

        {status === 'notfound' && (
          <Card className="bg-zinc-900/60 border-zinc-800">
            <CardContent className="py-12 text-center space-y-2">
              <Ticket className="h-10 w-10 mx-auto text-zinc-500" />
              <p className="text-zinc-300">Painel não encontrado.</p>
              <p className="text-xs text-zinc-500">Confira o link recebido.</p>
            </CardContent>
          </Card>
        )}

        {status === 'error' && (
          <Card className="bg-zinc-900/60 border-zinc-800">
            <CardContent className="py-12 text-center text-zinc-400">Não foi possível carregar agora. Tente novamente em instantes.</CardContent>
          </Card>
        )}

        {status === 'ok' && stats && (
          <div className="space-y-4">
            <div className="text-center">
              <p className="text-xs uppercase tracking-widest text-amber-400 font-semibold">ZN Assessoria · Painel do parceiro</p>
              <h1 className="text-2xl font-bold mt-1">{stats.promoter.name}</h1>
              {stats.promoter.handle && <p className="text-sm text-zinc-400">{stats.promoter.handle}</p>}
            </div>

            <Card className="bg-gradient-to-br from-amber-500/15 to-amber-600/5 border-amber-500/30">
              <CardContent className="py-10 text-center">
                <TrendingUp className="h-8 w-8 mx-auto text-amber-400 mb-2" />
                <div className="text-6xl font-extrabold text-amber-400 tabular-nums">{stats.total_uses}</div>
                <p className="text-sm text-zinc-300 mt-2">
                  {stats.total_uses === 1 ? 'pessoa entrou' : 'pessoas entraram'} usando seu cupom 🎉
                </p>
              </CardContent>
            </Card>

            {stats.by_coupon.length > 1 && (
              <Card className="bg-zinc-900/60 border-zinc-800">
                <CardContent className="py-3 divide-y divide-zinc-800">
                  {stats.by_coupon.map((c) => (
                    <div key={c.code} className="flex items-center justify-between py-2">
                      <span className="font-mono text-sm text-zinc-300">{c.code}</span>
                      <span className="font-semibold tabular-nums text-amber-400">{c.uses}</span>
                    </div>
                  ))}
                </CardContent>
              </Card>
            )}

            <p className="text-center text-[11px] text-zinc-600">
              Atualizado em {new Date(stats.updated_at).toLocaleString('pt-BR')} · dados agregados
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
