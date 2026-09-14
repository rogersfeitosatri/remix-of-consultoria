import { occurrence } from '../../../supabase/functions/_shared/checkinCadence';
import { useNavigate } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { AlertTriangle, ChevronDown, ChevronRight, Loader2, Settings2, Wrench } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useQueryClient } from '@tanstack/react-query';

interface AuditResult {
  client_id: string;
  client_name: string;
  configured_frequency: string;
  expected_interval_days: number;
  last_sent_date: string | null;
  next_scheduled_date: string | null;
  expected_next_date: string | null;
  interval_discrepancy_days: number;
  errors: string[];
  future_dates_wrong: number;
  status: 'ok' | 'warning' | 'error';
}

const FREQ_LABELS: Record<string, string> = {
  daily: 'Diária',
  weekly: 'Semanal',
  biweekly: 'Quinzenal',
  three_weeks: 'A cada 3 semanas',
  monthly: 'Mensal',
  bimonthly: 'Bimestral',
  quarterly: 'Trimestral',
};

function fmt(d: string | null) {
  if (!d) return '—';
  return new Date(d + 'T00:00:00').toLocaleDateString('pt-BR');
}

export function CheckinScheduleAuditBanner() {
  const [results, setResults] = useState<AuditResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [fixing, setFixing] = useState<string | 'all' | null>(null);
  const [open, setOpen] = useState(false);
  const { toast } = useToast();
  const qc = useQueryClient();
  const navigate = useNavigate();

  const runAudit = async () => {
    setLoading(true);
    try {
      const {data:auth,error:authError}=await supabase.auth.getUser();
      if(authError || !auth.user)throw new Error('Entre novamente para conferir a agenda.');
      const today=new Intl.DateTimeFormat('en-CA',{timeZone:'America/Fortaleza',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
      const {data:schedules,error}=await supabase.from('athlete_checkin_schedules')
        .select('client_id,start_date,frequency_type,clients(id,name,checkin_start_date,checkin_frequency,is_active,is_frozen,archived_at,ended_at,end_date,has_checkin)')
        .eq('user_id',auth.user.id).eq('is_active',true);
      if(error)throw error;
      const calendar: Array<{client_id:string;scheduled_send_date:string}>=[];
      for(let offset=0;;offset+=1000){
        const {data:page,error:calendarError}=await supabase.from('scheduled_checkins')
          .select('client_id,scheduled_send_date').eq('user_id',auth.user.id)
          .eq('status','pending').gte('scheduled_send_date',today).order('id').range(offset,offset+999);
        if(calendarError)throw calendarError;
        calendar.push(...(page||[]));if(!page||page.length<1000)break;
      }
      const audit:AuditResult[]=[];
      for(const schedule of schedules||[]){
        const c=schedule.clients;
        if(!c?.is_active||c.is_frozen||c.archived_at||c.ended_at||!c.has_checkin||c.end_date<today)continue;
        // Explicit holds/exclusions stay unchanged and never trigger bulk fixes.
        if(['24fb6e32-b1e1-4101-9943-d3fcff32e5c9','5f718610-e763-43bf-8b29-918232a2e7b6'].includes(c.id))continue;
        const frequency=c.checkin_frequency||schedule.frequency_type;
        const anchor=c.checkin_start_date||schedule.start_date;
        const dates=calendar.filter(x=>x.client_id===c.id).map(x=>x.scheduled_send_date).sort();
        const wrong=dates.filter(d=>occurrence(anchor,frequency,d)!==d || d>c.end_date);
        if(!wrong.length)continue;
        audit.push({client_id:c.id,client_name:c.name,configured_frequency:frequency,
          expected_interval_days:({weekly:7,biweekly:14,monthly:28} as Record<string,number>)[frequency]||0,
          last_sent_date:null,next_scheduled_date:dates[0]||null,expected_next_date:null,
          interval_discrepancy_days:0,errors:['Há previsões fora da cadência ou da vigência. Revise o planejamento.'],
          future_dates_wrong:wrong.length,status:'warning'});
      }
      setResults(audit);
      if(audit.length)setOpen(true);
    } catch (e: any) {
      toast({ title: 'Falha na auditoria', description: e.message, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    runAudit();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const runFix = (clientId?: string) => {
    if(clientId)navigate(`/clients/${clientId}/checkin-planning`);
  };

  if (loading && results.length === 0) return null;
  if (!loading && results.length === 0) return null;

  const errors = results.filter(r => r.status === 'error');
  const warnings = results.filter(r => r.status === 'warning');

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <div className="rounded-lg border border-amber-500/40 bg-amber-500/5">
        <div className="flex items-center justify-between p-3 gap-2 flex-wrap">
          <CollapsibleTrigger asChild>
            <button className="flex items-center gap-2 cursor-pointer flex-1 min-w-0 text-left">
              <Settings2 className="h-5 w-5 text-amber-600 shrink-0" />
              <span className="font-medium text-sm">Inconsistências detectadas no agendamento</span>
              {errors.length > 0 && (
                <Badge variant="destructive" className="text-[10px]">{errors.length} erro{errors.length !== 1 ? 's' : ''}</Badge>
              )}
              {warnings.length > 0 && (
                <Badge variant="outline" className="text-[10px] border-amber-500 text-amber-700">{warnings.length} aviso{warnings.length !== 1 ? 's' : ''}</Badge>
              )}
              {open ? <ChevronDown className="h-4 w-4 ml-auto" /> : <ChevronRight className="h-4 w-4 ml-auto" />}
            </button>
          </CollapsibleTrigger>
          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={runAudit} disabled={loading}>
              {loading ? <Loader2 className="h-3 w-3 animate-spin" /> : 'Auditar agora'}
            </Button>

          </div>
        </div>
        <CollapsibleContent>
          <div className="border-t border-amber-500/30 divide-y divide-amber-500/20 max-h-[420px] overflow-y-auto">
            {results.map((r) => (
              <div key={r.client_id} className="p-3 flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1 space-y-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    {r.status === 'error' ? (
                      <span className="text-destructive text-xs font-bold">🔴 ERRO</span>
                    ) : (
                      <span className="text-amber-700 text-xs font-bold">🟡 AVISO</span>
                    )}
                    <span className="font-medium text-sm">{r.client_name}</span>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Configurado: <strong>{FREQ_LABELS[r.configured_frequency] || r.configured_frequency}</strong> ({r.expected_interval_days} dias)
                    {' · '}Último envio: {fmt(r.last_sent_date)}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Próximo programado: <strong>{fmt(r.next_scheduled_date)}</strong>
                    {r.expected_next_date && (
                      <> {' '}— deveria ser <strong>{fmt(r.expected_next_date)}</strong></>
                    )}
                    {r.future_dates_wrong > 0 && (
                      <> · {r.future_dates_wrong} datas futuras incorretas</>
                    )}
                  </p>
                  {r.errors.map((err, i) => (
                    <p key={i} className="text-[11px] text-destructive">• {err}</p>
                  ))}
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => runFix(r.client_id)}
                  disabled={fixing !== null}
                >
                  {fixing === r.client_id ? <Loader2 className="h-3 w-3 animate-spin" /> : 'Ver planejamento'}
                </Button>
              </div>
            ))}
          </div>
        </CollapsibleContent>
      </div>
    </Collapsible>
  );
}
