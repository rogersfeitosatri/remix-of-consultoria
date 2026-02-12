import { useState, useRef } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Camera, Upload, Loader2, Check, X, Sparkles, Receipt } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAddTransaction } from '@/hooks/useFinancialTransactions';
import { toast } from 'sonner';
import { format } from 'date-fns';

interface ReceiptItem {
  description: string;
  amount: number;
  category?: string;
  selected?: boolean;
}

interface ReceiptData {
  store_name: string;
  date: string;
  total: number;
  payment_method: string;
  category: string;
  items: ReceiptItem[];
}

interface ReceiptScanDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const EXPENSE_CATEGORIES = [
  'Alimentação', 'Transporte', 'Moradia', 'Saúde', 'Educação', 'Lazer',
  'Vestuário', 'Software/Assinaturas', 'Marketing', 'Equipamentos',
  'Impostos', 'Serviços', 'Salários', 'Outros',
];

export function ReceiptScanDialog({ open, onOpenChange }: ReceiptScanDialogProps) {
  const [step, setStep] = useState<'upload' | 'scanning' | 'review'>('upload');
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [receiptData, setReceiptData] = useState<ReceiptData | null>(null);
  const [area, setArea] = useState<'pessoal' | 'empresa'>('empresa');
  const [isSaving, setIsSaving] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const addTransaction = useAddTransaction();

  const resetDialog = () => {
    setStep('upload');
    setImagePreview(null);
    setReceiptData(null);
    setArea('empresa');
    setIsSaving(false);
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      toast.error('Selecione uma imagem');
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      toast.error('Imagem muito grande (máx 10MB)');
      return;
    }

    const reader = new FileReader();
    reader.onload = async (ev) => {
      const base64 = ev.target?.result as string;
      setImagePreview(base64);
      setStep('scanning');

      try {
        const { data, error } = await supabase.functions.invoke('scan-receipt', {
          body: { imageBase64: base64 },
        });

        if (error) throw error;

        const parsed: ReceiptData = {
          ...data,
          items: (data.items || []).map((item: ReceiptItem) => ({ ...item, selected: true })),
        };

        setReceiptData(parsed);
        setStep('review');
      } catch (err: any) {
        console.error('Scan error:', err);
        toast.error(err?.message || 'Erro ao escanear comprovante');
        setStep('upload');
      }
    };
    reader.readAsDataURL(file);
  };

  const toggleItem = (idx: number) => {
    if (!receiptData) return;
    const items = [...receiptData.items];
    items[idx] = { ...items[idx], selected: !items[idx].selected };
    setReceiptData({ ...receiptData, items });
  };

  const updateItem = (idx: number, field: keyof ReceiptItem, value: any) => {
    if (!receiptData) return;
    const items = [...receiptData.items];
    items[idx] = { ...items[idx], [field]: value };
    setReceiptData({ ...receiptData, items });
  };

  const selectedTotal = receiptData?.items
    .filter(i => i.selected)
    .reduce((s, i) => s + i.amount, 0) || 0;

  const handleSave = async () => {
    if (!receiptData) return;
    const selectedItems = receiptData.items.filter(i => i.selected);
    if (selectedItems.length === 0) {
      toast.error('Selecione ao menos um item');
      return;
    }

    setIsSaving(true);
    try {
      for (const item of selectedItems) {
        await addTransaction.mutateAsync({
          type: 'expense',
          area,
          date: receiptData.date || format(new Date(), 'yyyy-MM-dd'),
          amount: item.amount,
          category: item.category || receiptData.category || 'Outros',
          description: `${receiptData.store_name} - ${item.description}`,
          payment_method: receiptData.payment_method || null,
          card_name: null,
          installments: 1,
          current_installment: 1,
          origin: null,
          receipt_method: null,
          is_recurring: false,
          notes: 'Registrado via foto de comprovante (IA)',
        });
      }

      toast.success(`${selectedItems.length} gasto(s) registrado(s) com sucesso!`);
      resetDialog();
      onOpenChange(false);
    } catch {
      toast.error('Erro ao salvar gastos');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) resetDialog(); onOpenChange(v); }}>
      <DialogContent className="sm:max-w-[550px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-foreground flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            Escanear Comprovante com IA
          </DialogTitle>
        </DialogHeader>

        {/* Upload step */}
        {step === 'upload' && (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Envie a foto de um comprovante de compra, nota fiscal ou recibo. A IA vai extrair automaticamente os dados.
            </p>

            <div
              className="border-2 border-dashed border-muted-foreground/30 rounded-xl p-8 text-center cursor-pointer hover:border-primary/50 transition-colors"
              onClick={() => fileInputRef.current?.click()}
            >
              <div className="flex flex-col items-center gap-3">
                <div className="p-4 rounded-full bg-primary/10">
                  <Camera className="h-8 w-8 text-primary" />
                </div>
                <div>
                  <p className="font-medium text-foreground">Clique para selecionar</p>
                  <p className="text-xs text-muted-foreground mt-1">ou arraste a imagem aqui</p>
                </div>
              </div>
            </div>

            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              capture="environment"
              className="hidden"
              onChange={handleFileSelect}
            />

            <div>
              <Label className="text-foreground">Área</Label>
              <Select value={area} onValueChange={(v: 'pessoal' | 'empresa') => setArea(v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="pessoal">Pessoa Física</SelectItem>
                  <SelectItem value="empresa">Empresa</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        )}

        {/* Scanning step */}
        {step === 'scanning' && (
          <div className="space-y-4">
            {imagePreview && (
              <img src={imagePreview} alt="Comprovante" className="w-full max-h-48 object-contain rounded-lg" />
            )}
            <div className="flex flex-col items-center gap-3 py-6">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <div className="text-center">
                <p className="font-medium text-foreground">Analisando comprovante...</p>
                <p className="text-xs text-muted-foreground mt-1">A IA está extraindo os dados</p>
              </div>
            </div>
          </div>
        )}

        {/* Review step */}
        {step === 'review' && receiptData && (
          <div className="space-y-4">
            {/* Store info */}
            <Card>
              <CardContent className="p-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Receipt className="h-4 w-4 text-muted-foreground" />
                    <div>
                      <p className="font-medium text-sm text-foreground">{receiptData.store_name}</p>
                      <p className="text-xs text-muted-foreground">{receiptData.date} • {receiptData.payment_method || 'Não identificado'}</p>
                    </div>
                  </div>
                  <Badge variant="outline" className="text-primary border-primary/30">
                    {receiptData.category}
                  </Badge>
                </div>
              </CardContent>
            </Card>

            {/* Area selector */}
            <div>
              <Label className="text-foreground text-xs">Área</Label>
              <Select value={area} onValueChange={(v: 'pessoal' | 'empresa') => setArea(v)}>
                <SelectTrigger className="h-8"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="pessoal">Pessoa Física</SelectItem>
                  <SelectItem value="empresa">Empresa</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Items */}
            <div className="space-y-2">
              <Label className="text-foreground text-xs">Itens detectados — clique para incluir/excluir</Label>
              {receiptData.items.map((item, idx) => (
                <Card key={idx} className={`cursor-pointer transition-all ${item.selected ? 'border-primary/40 bg-primary/5' : 'opacity-50'}`}>
                  <CardContent className="p-3" onClick={() => toggleItem(idx)}>
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 flex-1 min-w-0">
                        <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 ${item.selected ? 'border-primary bg-primary' : 'border-muted-foreground/30'}`}>
                          {item.selected && <Check className="h-3 w-3 text-primary-foreground" />}
                        </div>
                        <div className="flex-1 min-w-0">
                          <Input
                            value={item.description}
                            onClick={(e) => e.stopPropagation()}
                            onChange={(e) => updateItem(idx, 'description', e.target.value)}
                            className="h-7 text-xs border-0 p-0 bg-transparent focus-visible:ring-0"
                          />
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <Select
                          value={item.category || receiptData.category}
                          onValueChange={(v) => { updateItem(idx, 'category', v); }}
                        >
                          <SelectTrigger className="h-7 w-28 text-[10px]" onClick={(e) => e.stopPropagation()}>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {EXPENSE_CATEGORIES.map((c) => (
                              <SelectItem key={c} value={c} className="text-xs">{c}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <Input
                          type="number"
                          step="0.01"
                          value={item.amount}
                          onClick={(e) => e.stopPropagation()}
                          onChange={(e) => updateItem(idx, 'amount', parseFloat(e.target.value) || 0)}
                          className="h-7 w-20 text-xs text-right"
                        />
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>

            {/* Total */}
            <div className="flex justify-between items-center pt-2 border-t border-border">
              <p className="text-sm text-muted-foreground">
                {receiptData.items.filter(i => i.selected).length} de {receiptData.items.length} itens selecionados
              </p>
              <p className="text-lg font-bold text-foreground">
                R$ {selectedTotal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
              </p>
            </div>

            {/* Actions */}
            <div className="flex gap-2 pt-2">
              <Button variant="outline" className="flex-1" onClick={() => { resetDialog(); }}>
                <X className="h-4 w-4 mr-1" /> Cancelar
              </Button>
              <Button className="flex-1" onClick={handleSave} disabled={isSaving}>
                {isSaving ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Check className="h-4 w-4 mr-1" />}
                Registrar {receiptData.items.filter(i => i.selected).length} gasto(s)
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
