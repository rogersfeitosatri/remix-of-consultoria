import { Layout } from '@/components/layout/Layout';
import { GoogleOAuthAlert } from '@/components/dashboard/GoogleOAuthAlert';
import { ActionCenterPanel } from '@/components/dashboard/ActionCenterPanel';
import { AiChatEscalationsCard } from '@/components/dashboard/AiChatEscalationsCard';
import { MonthlyProgressionPanel } from '@/components/dashboard/MonthlyProgressionPanel';
import { BlocoSaudeFinanceira } from '@/components/dashboard/BlocoSaudeFinanceira';
import { BlocoTemperatura } from '@/components/dashboard/BlocoTemperatura';
import { Separator } from '@/components/ui/separator';
import { ListTodo } from 'lucide-react';

export default function Dashboard() {
  return (
    <Layout>
      <div className="space-y-8">
        <GoogleOAuthAlert />

        {/* ── BLOCO 1: Fila de ação do dia ──────────────────────────────── */}
        <section>
          <div className="flex items-center gap-2 mb-4">
            <ListTodo className="h-4 w-4 text-primary" />
            <h2 className="text-base font-semibold text-foreground">Fila de ação do dia</h2>
            <span className="text-xs text-muted-foreground">— o que precisa de atenção agora</span>
          </div>
          <ActionCenterPanel />
          <div className="mt-4"><AiChatEscalationsCard /></div>
        </section>

        <Separator />

        {/* ── BLOCO 2: Saúde financeira ─────────────────────────────────── */}
        <section>
          <BlocoSaudeFinanceira />
        </section>

        <Separator />

        {/* ── BLOCO 3: Temperatura + Jornada ────────────────────────────── */}
        <section>
          <div className="grid gap-8 grid-cols-1 xl:grid-cols-2">
            <BlocoTemperatura />
            <div>
              <MonthlyProgressionPanel />
            </div>
          </div>
        </section>
      </div>
    </Layout>
  );
}
