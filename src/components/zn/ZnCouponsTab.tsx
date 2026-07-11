import { useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from '@/components/ui/dialog';
import { Plus, Pencil, Trash2, Ticket, Megaphone, Copy } from 'lucide-react';
import {
  useZnCoupons, useZnPromoters, useSaveZnCoupon, useDeleteZnCoupon,
  useSaveZnPromoter, useDeleteZnPromoter, useZnAthletes,
  type ZnCoupon, type ZnPromoter,
} from '@/hooks/useZnAssessoria';
import { toast } from 'sonner';

const PUBLIC_BASE = typeof window !== 'undefined' ? window.location.origin : '';

// ─────────────── Cupons ───────────────
export function ZnCouponsSection() {
  const { data: coupons = [] } = useZnCoupons();
  const { data: promoters = [] } = useZnPromoters();
  const save = useSaveZnCoupon();
  const del = useDeleteZnCoupon();
  const [editing, setEditing] = useState<Partial<ZnCoupon> | null>(null);

  const promoterName = (id: string | null) => promoters.find(p => p.id === id)?.name ?? '—';

  const blank: Partial<ZnCoupon> = {
    code: '', description: '', promoter_id: null, discount_type: 'percent',
    percent_off: 10, free_months: 0, applies_to: 'all', max_uses: null,
    valid_from: null, valid_until: null, is_active: true,
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0">
        <CardTitle className="text-sm flex items-center gap-2"><Ticket className="h-4 w-4" /> Cupons ({coupons.length})</CardTitle>
        <Button size="sm" onClick={() => setEditing(blank)}><Plus className="h-4 w-4 mr-1" /> Novo cupom</Button>
      </CardHeader>
      <CardContent className="p-0 overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Código</TableHead>
              <TableHead>Desconto</TableHead>
              <TableHead>Criador</TableHead>
              <TableHead>Usos</TableHead>
              <TableHead>Validade</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {coupons.length === 0 && (
              <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-8">Nenhum cupom ainda.</TableCell></TableRow>
            )}
            {coupons.map(c => (
              <TableRow key={c.id}>
                <TableCell className="font-mono font-semibold">{c.code}</TableCell>
                <TableCell className="text-sm">
                  {c.discount_type === 'percent'
                    ? `${c.percent_off}% (contrato)`
                    : `${c.free_months} ${c.free_months === 1 ? 'mês grátis' : 'meses grátis'}`}
                </TableCell>
                <TableCell className="text-sm text-muted-foreground">{promoterName(c.promoter_id)}</TableCell>
                <TableCell className="text-sm">{c.uses_count}{c.max_uses != null ? ` / ${c.max_uses}` : ''}</TableCell>
                <TableCell className="text-xs text-muted-foreground">
                  {c.valid_until ? `até ${c.valid_until}` : 'sem limite'}
                </TableCell>
                <TableCell>{c.is_active ? <Badge>Ativo</Badge> : <Badge variant="outline">Inativo</Badge>}</TableCell>
                <TableCell className="text-right whitespace-nowrap">
                  <Button variant="ghost" size="sm" onClick={() => setEditing(c)}><Pencil className="h-3.5 w-3.5" /></Button>
                  <Button variant="ghost" size="sm" className="text-destructive" onClick={() => { if (confirm(`Remover cupom ${c.code}?`)) del.mutate(c.id); }}><Trash2 className="h-3.5 w-3.5" /></Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>

      {editing && (
        <CouponDialog
          coupon={editing}
          promoters={promoters}
          onClose={() => setEditing(null)}
          onSave={(v) => save.mutate(v, { onSuccess: () => setEditing(null) })}
          saving={save.isPending}
        />
      )}
    </Card>
  );
}

function CouponDialog({ coupon, promoters, onClose, onSave, saving }: {
  coupon: Partial<ZnCoupon>; promoters: ZnPromoter[];
  onClose: () => void; onSave: (v: Partial<ZnCoupon>) => void; saving: boolean;
}) {
  const [f, setF] = useState<Partial<ZnCoupon>>(coupon);
  const set = (patch: Partial<ZnCoupon>) => setF(prev => ({ ...prev, ...patch }));

  const submit = () => {
    if (!f.code?.trim()) { toast.error('Informe o código do cupom'); return; }
    onSave({
      ...f,
      code: f.code.trim().toUpperCase(),
      percent_off: f.discount_type === 'percent' ? Number(f.percent_off ?? 0) : 0,
      free_months: f.discount_type === 'free_months' ? Number(f.free_months ?? 0) : 0,
      max_uses: f.max_uses ? Number(f.max_uses) : null,
    });
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader><DialogTitle>{coupon.id ? 'Editar cupom' : 'Novo cupom'}</DialogTitle></DialogHeader>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Código *</Label>
              <Input value={f.code ?? ''} onChange={e => set({ code: e.target.value.toUpperCase() })} placeholder="ANA20" className="uppercase mt-1" />
            </div>
            <div>
              <Label>Criador (afiliado)</Label>
              <Select value={f.promoter_id ?? 'none'} onValueChange={v => set({ promoter_id: v === 'none' ? null : v })}>
                <SelectTrigger className="mt-1"><SelectValue placeholder="Nenhum" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Nenhum</SelectItem>
                  {promoters.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div>
            <Label>Descrição</Label>
            <Input value={f.description ?? ''} onChange={e => set({ description: e.target.value })} className="mt-1" />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Tipo de desconto</Label>
              <Select value={f.discount_type ?? 'percent'} onValueChange={v => set({ discount_type: v as any })}>
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="percent">% de desconto</SelectItem>
                  <SelectItem value="free_months">Meses grátis</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {f.discount_type === 'percent' ? (
              <div>
                <Label>Desconto (%)</Label>
                <Input type="number" min={0} max={100} value={f.percent_off ?? 0} onChange={e => set({ percent_off: Number(e.target.value) })} className="mt-1" />
              </div>
            ) : (
              <div>
                <Label>Meses grátis</Label>
                <Input type="number" min={0} max={12} value={f.free_months ?? 0} onChange={e => set({ free_months: Number(e.target.value) })} className="mt-1" />
              </div>
            )}
          </div>

          <p className="text-xs text-muted-foreground">
            {f.discount_type === 'percent'
              ? 'O desconto % vale apenas para o período do contrato (1ª cobrança). As renovações voltam ao valor cheio. Desativar o cupom impede novos usos.'
              : 'Acesso liberado no cadastro durante o período grátis. Ao final, o link do Asaas é enviado por WhatsApp para o atleta continuar — sem refazer a anamnese.'}
          </p>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <Label>Limite de usos</Label>
              <Input type="number" min={0} value={f.max_uses ?? ''} onChange={e => set({ max_uses: e.target.value ? Number(e.target.value) : null })} placeholder="∞" className="mt-1" />
            </div>
            <div>
              <Label>Válido de</Label>
              <Input type="date" value={f.valid_from ?? ''} onChange={e => set({ valid_from: e.target.value || null })} className="mt-1" />
            </div>
            <div>
              <Label>Válido até</Label>
              <Input type="date" value={f.valid_until ?? ''} onChange={e => set({ valid_until: e.target.value || null })} className="mt-1" />
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Switch checked={f.is_active ?? true} onCheckedChange={v => set({ is_active: v })} />
            <Label>Cupom ativo</Label>
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>Cancelar</Button>
          <Button onClick={submit} disabled={saving}>{saving ? 'Salvando...' : 'Salvar'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─────────────── Criadores ───────────────
export function ZnPromotersSection() {
  const { data: promoters = [] } = useZnPromoters();
  const save = useSaveZnPromoter();
  const del = useDeleteZnPromoter();
  const [editing, setEditing] = useState<Partial<ZnPromoter> | null>(null);

  const copyLink = (ref: string | null) => {
    const link = `${PUBLIC_BASE}/anamnese-form/SEU_FORM_ID?zn=1${ref ? `&ref=${ref}` : ''}`;
    navigator.clipboard.writeText(link);
    toast.success('Link copiado (troque SEU_FORM_ID pelo ID do formulário ZN)');
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0">
        <CardTitle className="text-sm flex items-center gap-2"><Megaphone className="h-4 w-4" /> Criadores / Divulgadores ({promoters.length})</CardTitle>
        <Button size="sm" onClick={() => setEditing({ name: '', handle: '', contact: '', ref_code: '', is_active: true })}><Plus className="h-4 w-4 mr-1" /> Novo criador</Button>
      </CardHeader>
      <CardContent className="p-0 overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nome</TableHead>
              <TableHead>@ / Rede</TableHead>
              <TableHead>Contato</TableHead>
              <TableHead>Ref</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {promoters.length === 0 && (
              <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8">Nenhum criador cadastrado.</TableCell></TableRow>
            )}
            {promoters.map(p => (
              <TableRow key={p.id}>
                <TableCell className="font-medium">{p.name}</TableCell>
                <TableCell className="text-sm text-muted-foreground">{p.handle ?? '—'}</TableCell>
                <TableCell className="text-sm text-muted-foreground">{p.contact ?? '—'}</TableCell>
                <TableCell className="font-mono text-xs">{p.ref_code ?? '—'}</TableCell>
                <TableCell>{p.is_active ? <Badge>Ativo</Badge> : <Badge variant="outline">Inativo</Badge>}</TableCell>
                <TableCell className="text-right whitespace-nowrap">
                  {p.ref_code && <Button variant="ghost" size="sm" title="Copiar link" onClick={() => copyLink(p.ref_code)}><Copy className="h-3.5 w-3.5" /></Button>}
                  <Button variant="ghost" size="sm" onClick={() => setEditing(p)}><Pencil className="h-3.5 w-3.5" /></Button>
                  <Button variant="ghost" size="sm" className="text-destructive" onClick={() => { if (confirm(`Remover ${p.name}?`)) del.mutate(p.id); }}><Trash2 className="h-3.5 w-3.5" /></Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>

      {editing && (
        <PromoterDialog
          promoter={editing}
          onClose={() => setEditing(null)}
          onSave={(v) => save.mutate(v, { onSuccess: () => setEditing(null) })}
          saving={save.isPending}
        />
      )}
    </Card>
  );
}

function PromoterDialog({ promoter, onClose, onSave, saving }: {
  promoter: Partial<ZnPromoter>; onClose: () => void; onSave: (v: Partial<ZnPromoter>) => void; saving: boolean;
}) {
  const [f, setF] = useState<Partial<ZnPromoter>>(promoter);
  const set = (patch: Partial<ZnPromoter>) => setF(prev => ({ ...prev, ...patch }));
  const submit = () => {
    if (!f.name?.trim()) { toast.error('Informe o nome'); return; }
    onSave({ ...f, name: f.name.trim(), ref_code: (f.ref_code || '').trim().toLowerCase().replace(/\s+/g, '-') || null });
  };
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle>{promoter.id ? 'Editar criador' : 'Novo criador'}</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div><Label>Nome *</Label><Input value={f.name ?? ''} onChange={e => set({ name: e.target.value })} className="mt-1" /></div>
          <div><Label>@ / Rede social</Label><Input value={f.handle ?? ''} onChange={e => set({ handle: e.target.value })} placeholder="@joao.corre" className="mt-1" /></div>
          <div><Label>Contato (WhatsApp / e-mail)</Label><Input value={f.contact ?? ''} onChange={e => set({ contact: e.target.value })} className="mt-1" /></div>
          <div>
            <Label>Código de referência (para link exclusivo)</Label>
            <Input value={f.ref_code ?? ''} onChange={e => set({ ref_code: e.target.value })} placeholder="joao" className="mt-1" />
            <p className="text-xs text-muted-foreground mt-1">Usado no link <code>?ref=joao</code> para pré-preencher o cupom.</p>
          </div>
          <div className="flex items-center gap-2">
            <Switch checked={f.is_active ?? true} onCheckedChange={v => set({ is_active: v })} />
            <Label>Ativo</Label>
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>Cancelar</Button>
          <Button onClick={submit} disabled={saving}>{saving ? 'Salvando...' : 'Salvar'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─────────────── Ranking ───────────────
export function ZnPromoterRanking() {
  const { data: promoters = [] } = useZnPromoters();
  const { data: athletes = [] } = useZnAthletes();

  const [period, setPeriod] = useState<'all' | '7' | '30' | '90'>('all');

  const ranking = useMemo(() => {
    const cutoff = period === 'all' ? null : new Date(Date.now() - Number(period) * 864e5);
    const inPeriod = (a: any) => !cutoff || (a.created_at && new Date(a.created_at) >= cutoff);
    return promoters
      .map(p => {
        const mine = (athletes as any[]).filter(a => a.promoter_id === p.id && inPeriod(a));
        const active = mine.filter(a => a.status === 'active').length;
        return { promoter: p, signups: mine.length, active };
      })
      .filter(r => r.signups > 0)
      .sort((a, b) => b.active - a.active || b.signups - a.signups);
  }, [promoters, athletes, period]);

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0">
        <CardTitle className="text-sm">🏆 Ranking de criadores</CardTitle>
        <Select value={period} onValueChange={v => setPeriod(v as any)}>
          <SelectTrigger className="w-40 h-8 text-xs"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todo o período</SelectItem>
            <SelectItem value="7">Últimos 7 dias</SelectItem>
            <SelectItem value="30">Últimos 30 dias</SelectItem>
            <SelectItem value="90">Últimos 90 dias</SelectItem>
          </SelectContent>
        </Select>
      </CardHeader>
      <CardContent className="p-0 overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>#</TableHead>
              <TableHead>Criador</TableHead>
              <TableHead>Cadastros</TableHead>
              <TableHead>Ativos</TableHead>
              <TableHead>Conversão</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {ranking.length === 0 && (
              <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-8">Nenhuma atribuição no período.</TableCell></TableRow>
            )}
            {ranking.map((r, i) => (
              <TableRow key={r.promoter.id}>
                <TableCell className="font-bold text-muted-foreground">{i + 1}º</TableCell>
                <TableCell className="font-medium">{r.promoter.name}{r.promoter.handle ? <span className="text-xs text-muted-foreground ml-1">{r.promoter.handle}</span> : null}</TableCell>
                <TableCell>{r.signups}</TableCell>
                <TableCell><Badge>{r.active}</Badge></TableCell>
                <TableCell className="text-sm text-muted-foreground">{r.signups ? Math.round((r.active / r.signups) * 100) : 0}%</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
