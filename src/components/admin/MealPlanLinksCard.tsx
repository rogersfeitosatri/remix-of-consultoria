// Links de acesso rápido por atleta (salvos no navegador do admin).
import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Link2, Plus, Trash2, ExternalLink } from 'lucide-react';
import { toast } from 'sonner';

type QuickLink = { id: string; label: string; url: string };

const key = (clientId: string) => `meal-plan-links:${clientId}`;

function load(clientId: string): QuickLink[] {
  try {
    const raw = localStorage.getItem(key(clientId));
    if (!raw) return [];
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? arr : [];
  } catch { return []; }
}

function save(clientId: string, links: QuickLink[]) {
  localStorage.setItem(key(clientId), JSON.stringify(links));
}

function normalizeUrl(u: string): string {
  const t = u.trim();
  if (!t) return '';
  if (/^https?:\/\//i.test(t)) return t;
  return `https://${t}`;
}

export function MealPlanLinksCard({ clientId }: { clientId: string }) {
  const [links, setLinks] = useState<QuickLink[]>([]);
  const [label, setLabel] = useState('');
  const [url, setUrl] = useState('');

  useEffect(() => { setLinks(load(clientId)); }, [clientId]);

  const add = () => {
    const clean = normalizeUrl(url);
    if (!label.trim() || !clean) {
      toast.error('Informe um nome e uma URL válida.');
      return;
    }
    const next = [...links, { id: crypto.randomUUID(), label: label.trim(), url: clean }];
    setLinks(next);
    save(clientId, next);
    setLabel('');
    setUrl('');
  };

  const remove = (id: string) => {
    const next = links.filter((l) => l.id !== id);
    setLinks(next);
    save(clientId, next);
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Link2 className="h-4 w-4 text-primary" />
          Links de acesso rápido
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {links.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhum link salvo. Adicione abaixo.</p>
        ) : (
          <ul className="space-y-2">
            {links.map((l) => (
              <li key={l.id} className="flex items-center gap-2 rounded-lg border bg-card p-2">
                <a
                  href={l.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex-1 min-w-0 flex items-center gap-2 text-sm hover:underline"
                >
                  <ExternalLink className="h-4 w-4 text-muted-foreground shrink-0" />
                  <span className="truncate font-medium">{l.label}</span>
                  <span className="truncate text-xs text-muted-foreground">{l.url}</span>
                </a>
                <Button variant="ghost" size="icon" onClick={() => remove(l.id)} title="Remover">
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              </li>
            ))}
          </ul>
        )}

        <div className="flex flex-col sm:flex-row gap-2 pt-2 border-t">
          <Input
            placeholder="Nome (ex.: Google Drive)"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            className="sm:max-w-[220px]"
          />
          <Input
            placeholder="https://..."
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') add(); }}
          />
          <Button onClick={add} className="gap-1">
            <Plus className="h-4 w-4" /> Adicionar
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
