import { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Search } from 'lucide-react';
import { metCompendium, MetActivity } from '@/data/metCompendium';

export function NPMETCompendiumTab() {
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');

  const categories = useMemo(() => {
    const cats = new Set(metCompendium.map(m => m.category));
    return Array.from(cats).sort();
  }, []);

  const filtered = useMemo(() => {
    return metCompendium.filter(m => {
      const matchSearch = !search || m.activity.toLowerCase().includes(search.toLowerCase()) || m.category.toLowerCase().includes(search.toLowerCase());
      const matchCategory = categoryFilter === 'all' || m.category === categoryFilter;
      return matchSearch && matchCategory;
    });
  }, [search, categoryFilter]);

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm">Compêndio de Atividades Físicas (METs)</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Buscar atividade..." value={search} onChange={e => setSearch(e.target.value)} className="pl-8" />
          </div>
          <Select value={categoryFilter} onValueChange={setCategoryFilter}>
            <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas categorias</SelectItem>
              {categories.map(c => (
                <SelectItem key={c} value={c}>{c}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="max-h-[60vh] overflow-y-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-xs">Categoria</TableHead>
                <TableHead className="text-xs">Atividade</TableHead>
                <TableHead className="text-xs text-center">MET</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((m, i) => (
                <TableRow key={i}>
                  <TableCell className="text-xs py-1.5">{m.category}</TableCell>
                  <TableCell className="text-xs py-1.5">{m.activity}</TableCell>
                  <TableCell className="text-xs text-center py-1.5 font-semibold">{m.met}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
        <p className="text-xs text-muted-foreground">{filtered.length} atividades encontradas</p>
      </CardContent>
    </Card>
  );
}
