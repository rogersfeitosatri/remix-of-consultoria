import { useState } from 'react';
import { format, startOfMonth, endOfMonth, subMonths, subDays, startOfYear, endOfYear } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Calendar as CalendarIcon, Filter, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { cn } from '@/lib/utils';

interface FinancialFiltersProps {
  startDate: Date;
  endDate: Date;
  onDateChange: (start: Date, end: Date) => void;
}

type PresetPeriod = 'current_month' | 'last_30' | 'last_90' | 'current_quarter' | 'current_year' | 'custom';

export function FinancialFilters({ startDate, endDate, onDateChange }: FinancialFiltersProps) {
  const [preset, setPreset] = useState<PresetPeriod>('current_month');
  const [isCustom, setIsCustom] = useState(false);
  
  const handlePresetChange = (value: PresetPeriod) => {
    setPreset(value);
    const today = new Date();
    
    switch (value) {
      case 'current_month':
        onDateChange(startOfMonth(today), endOfMonth(today));
        setIsCustom(false);
        break;
      case 'last_30':
        onDateChange(subDays(today, 30), today);
        setIsCustom(false);
        break;
      case 'last_90':
        onDateChange(subDays(today, 90), today);
        setIsCustom(false);
        break;
      case 'current_quarter': {
        const quarterMonth = Math.floor(today.getMonth() / 3) * 3;
        const quarterStart = new Date(today.getFullYear(), quarterMonth, 1);
        const quarterEnd = endOfMonth(new Date(today.getFullYear(), quarterMonth + 2, 1));
        onDateChange(quarterStart, quarterEnd);
        setIsCustom(false);
        break;
      }
      case 'current_year':
        onDateChange(startOfYear(today), endOfYear(today));
        setIsCustom(false);
        break;
      case 'custom':
        setIsCustom(true);
        break;
    }
  };
  
  const handleStartDateSelect = (date: Date | undefined) => {
    if (date) {
      onDateChange(date, endDate > date ? endDate : date);
    }
  };
  
  const handleEndDateSelect = (date: Date | undefined) => {
    if (date) {
      onDateChange(startDate, date);
    }
  };
  
  const clearFilters = () => {
    const today = new Date();
    setPreset('current_month');
    setIsCustom(false);
    onDateChange(startOfMonth(today), endOfMonth(today));
  };
  
  return (
    <div className="flex flex-col gap-3">
      {/* Linha principal - Mobile: empilhado, Desktop: em linha */}
      <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center">
        <div className="flex items-center gap-2">
          <Filter className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm font-medium text-muted-foreground">Período:</span>
        </div>
        
        {/* Select ocupa 100% no mobile */}
        <Select value={preset} onValueChange={handlePresetChange}>
          <SelectTrigger className="w-full sm:w-[180px]">
            <SelectValue placeholder="Selecionar período" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="current_month">Mês atual</SelectItem>
            <SelectItem value="last_30">Últimos 30 dias</SelectItem>
            <SelectItem value="last_90">Últimos 90 dias</SelectItem>
            <SelectItem value="current_quarter">Trimestre atual</SelectItem>
            <SelectItem value="current_year">Ano atual</SelectItem>
            <SelectItem value="custom">Personalizado</SelectItem>
          </SelectContent>
        </Select>
        
        {(isCustom || preset !== 'current_month') && (
          <Button variant="ghost" size="sm" onClick={clearFilters} className="text-muted-foreground self-end sm:self-auto">
            <X className="h-4 w-4 mr-1" />
            Limpar
          </Button>
        )}
      </div>
      
      {/* Calendários customizados - Mobile: empilhado, Desktop: em linha */}
      {isCustom && (
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2">
          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                className={cn(
                  "w-full sm:w-[150px] justify-start text-left font-normal",
                  !startDate && "text-muted-foreground"
                )}
              >
                <CalendarIcon className="mr-2 h-4 w-4" />
                {startDate ? format(startDate, "dd/MM/yyyy") : "Início"}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar
                mode="single"
                selected={startDate}
                onSelect={handleStartDateSelect}
                initialFocus
                locale={ptBR}
                className="pointer-events-auto"
              />
            </PopoverContent>
          </Popover>
          
          <span className="text-muted-foreground hidden sm:block">até</span>
          
          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                className={cn(
                  "w-full sm:w-[150px] justify-start text-left font-normal",
                  !endDate && "text-muted-foreground"
                )}
              >
                <CalendarIcon className="mr-2 h-4 w-4" />
                {endDate ? format(endDate, "dd/MM/yyyy") : "Fim"}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar
                mode="single"
                selected={endDate}
                onSelect={handleEndDateSelect}
                initialFocus
                locale={ptBR}
                className="pointer-events-auto"
              />
            </PopoverContent>
          </Popover>
        </div>
      )}
      
      {/* Intervalo selecionado - sempre visível */}
      <div className="text-xs sm:text-sm text-muted-foreground bg-muted/50 rounded-lg px-3 py-2 text-center sm:text-left">
        📅 {format(startDate, "dd/MM/yyyy")} — {format(endDate, "dd/MM/yyyy")}
      </div>
    </div>
  );
}
