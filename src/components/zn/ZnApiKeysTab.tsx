import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Copy, Eye, EyeOff, KeyRound, ShieldAlert, Trash2, Check } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
  useZnIntegrationKeys, useCreateZnIntegrationKey, useRevokeZnIntegrationKey,
  type ZnIntegrationApiKey,
} from '@/hooks/useZnIntegrationKeys';
import { toast } from 'sonner';

const API_URL = 'https://vhzxnatgwravidvbehwi.supabase.co/functions/v1/integrations-api';

export function ZnApiKeysTab() {
  const { data: keys = [], isLoading } = useZnIntegrationKeys();
  const createKey = useCreateZnIntegrationKey();
  const revokeKey = useRevokeZnIntegrationKey();

  const [newName, setNewName] = useState('Zona Nutri');
  const [reveal, setReveal] = useState<Record<string, boolean>>({});
  const [justCreated, setJustCreated] = useState<ZnIntegrationApiKey | null>(null);

  const copy = async (value: string, label = 'Copiado') => {
    try {
      await navigator.clipboard.writeText(value);
      toast.success(label);
    } catch {
      toast.error('Não foi possível copiar');
    }
  };

  const handleCreate = async () => {
    const name = newName.trim() || 'Sem nome';
    const created = await createKey.mutateAsync(name);
    setJustCreated(created);
    setReveal((r) => ({ ...r, [created.id]: true }));
  };

  const active = keys.filter((k) => !k.revoked_at);
  const revoked = keys.filter((k) => k.revoked_at);

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-sm flex items-center gap-2">
            <KeyRound className="h-4 w-4" /> API Pública — endpoint
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">API URL</Label>
            <div className="flex items-center gap-2">
              <Input readOnly value={API_URL} className="font-mono text-xs" />
              <Button size="icon" variant="outline" onClick={() => copy(API_URL, 'URL copiada')}>
                <Copy className="h-4 w-4" />
              </Button>
            </div>
          </div>
          <Alert>
            <ShieldAlert className="h-4 w-4" />
            <AlertTitle>Como usar no Zona Nutri</AlertTitle>
            <AlertDescription className="text-xs space-y-1">
              <p>Envie a chave em um destes headers:</p>
              <code className="block bg-muted px-2 py-1 rounded">Authorization: Bearer &lt;API_KEY&gt;</code>
              <code className="block bg-muted px-2 py-1 rounded">x-api-key: &lt;API_KEY&gt;</code>
              <p className="pt-1">
                Documentação completa em <code>docs/INTEGRATIONS_API.md</code>.
              </p>
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Gerar nova chave</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col sm:flex-row gap-2">
          <Input
            placeholder="Nome do consumidor (ex.: Zona Nutri)"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
          />
          <Button onClick={handleCreate} disabled={createKey.isPending}>
            {createKey.isPending ? 'Gerando...' : 'Gerar chave'}
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Chaves ativas ({active.length})</CardTitle>
        </CardHeader>
        <CardContent className="p-0 overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead>
                <TableHead>Chave</TableHead>
                <TableHead>Criada em</TableHead>
                <TableHead>Último uso</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading && (
                <TableRow><TableCell colSpan={5} className="text-center py-6 text-muted-foreground">Carregando...</TableCell></TableRow>
              )}
              {!isLoading && active.length === 0 && (
                <TableRow><TableCell colSpan={5} className="text-center py-6 text-muted-foreground">Nenhuma chave ativa. Gere a primeira acima.</TableCell></TableRow>
              )}
              {active.map((k) => {
                const shown = reveal[k.id];
                const masked = `${k.key.slice(0, 8)}••••••••••••${k.key.slice(-4)}`;
                return (
                  <TableRow key={k.id}>
                    <TableCell className="font-medium">{k.name}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <code className="font-mono text-xs">{shown ? k.key : masked}</code>
                        <Button size="icon" variant="ghost" onClick={() => setReveal((r) => ({ ...r, [k.id]: !shown }))}>
                          {shown ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
                        </Button>
                        <Button size="icon" variant="ghost" onClick={() => copy(k.key, 'Chave copiada')}>
                          <Copy className="h-3 w-3" />
                        </Button>
                      </div>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {format(parseISO(k.created_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {k.last_used_at ? format(parseISO(k.last_used_at), "dd/MM/yyyy HH:mm", { locale: ptBR }) : '—'}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        size="sm"
                        variant="ghost"
                        className="text-destructive"
                        onClick={() => {
                          if (confirm(`Revogar chave "${k.name}"? Esta ação é irreversível.`)) {
                            revokeKey.mutate(k.id);
                          }
                        }}
                      >
                        <Trash2 className="h-3 w-3 mr-1" /> Revogar
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {revoked.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm text-muted-foreground">Revogadas ({revoked.length})</CardTitle>
          </CardHeader>
          <CardContent className="p-0 overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome</TableHead>
                  <TableHead>Criada</TableHead>
                  <TableHead>Revogada</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {revoked.map((k) => (
                  <TableRow key={k.id} className="opacity-60">
                    <TableCell>{k.name} <Badge variant="outline" className="ml-1">revogada</Badge></TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {format(parseISO(k.created_at), "dd/MM/yyyy", { locale: ptBR })}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {k.revoked_at ? format(parseISO(k.revoked_at), "dd/MM/yyyy HH:mm", { locale: ptBR }) : '—'}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      <Dialog open={!!justCreated} onOpenChange={(o) => !o && setJustCreated(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Check className="h-5 w-5 text-green-500" />
              Chave gerada com sucesso
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <Alert>
              <ShieldAlert className="h-4 w-4" />
              <AlertDescription className="text-xs">
                Copie e guarde esta chave em local seguro. Você pode reabrir depois pelo botão do olho na tabela.
              </AlertDescription>
            </Alert>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Chave</Label>
              <div className="flex items-center gap-2">
                <Input readOnly value={justCreated?.key ?? ''} className="font-mono text-xs" />
                <Button size="icon" variant="outline" onClick={() => justCreated && copy(justCreated.key, 'Chave copiada')}>
                  <Copy className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button onClick={() => setJustCreated(null)}>Fechar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
