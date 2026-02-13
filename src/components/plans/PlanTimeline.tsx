import { ClipboardList, Utensils, RefreshCw, MessageCircle, Activity, Calendar, FileText, Dumbbell } from 'lucide-react';

const consultasSteps = [
  {
    icon: Calendar,
    title: 'Consulta a cada 6 semanas',
    description: 'Consultas periódicas para avaliar evolução, ajustar metas e refinar o plano.',
  },
  {
    icon: Utensils,
    title: 'Plano alimentar e suplementar',
    description: 'Receba seu plano alimentar personalizado com estratégias de suplementação pré, intra e pós-treino.',
  },
  {
    icon: ClipboardList,
    title: 'Avaliação quinzenal',
    description: 'Formulário quinzenal para coleta de sensações e acompanhamento contínuo da evolução.',
  },
  {
    icon: RefreshCw,
    title: 'Ajustes ilimitados',
    description: 'Solicite ajustes no plano alimentar sempre que precisar, sem limite.',
  },
  {
    icon: Dumbbell,
    title: 'Zona Nutri semanal',
    description: 'Acesso semanal ao sistema de estratégia suplementar para elaborar a nutrição do treino longo.',
  },
  {
    icon: MessageCircle,
    title: 'Suporte diário no WhatsApp',
    description: 'Tire dúvidas diretamente com o Nutri todos os dias pelo WhatsApp.',
  },
];

const consultoriaSteps = [
  {
    icon: FileText,
    title: 'Formulário inicial',
    description: 'Preencha o formulário de anamnese para o Nutri conhecer sua rotina e objetivos.',
  },
  {
    icon: Utensils,
    title: 'Plano alimentar',
    description: 'Receba seu plano alimentar personalizado para a fase atual do ciclo de treino.',
  },
  {
    icon: RefreshCw,
    title: 'Ajustes mensais',
    description: 'Avaliação mensal via formulário para coleta de sensações e ajustes no plano se necessário.',
  },
  {
    icon: Activity,
    title: 'Zona Nutri',
    description: 'Acesso ao sistema de ajuste estratégico de géis e suplementação nos treinos de corrida.',
  },
  {
    icon: MessageCircle,
    title: 'Suporte no WhatsApp',
    description: 'Tire dúvidas diretamente com o Nutri pelo WhatsApp.',
  },
];

function TimelineSteps({ steps, variant }: { steps: typeof consultasSteps; variant: 'light' | 'dark' }) {
  const isLight = variant === 'light';

  return (
    <div className="relative">
      {/* Vertical line */}
      <div className={`absolute left-5 top-8 bottom-8 w-px ${isLight ? 'bg-black/15' : 'bg-white/15'}`} />

      <div className="space-y-8">
        {steps.map((step, index) => (
          <div key={index} className="flex items-start gap-5 relative">
            {/* Icon circle */}
            <div className={`relative z-10 w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${
              isLight ? 'bg-primary-foreground text-white' : 'bg-white text-primary-foreground'
            }`}>
              <step.icon className="h-5 w-5" />
            </div>

            {/* Content */}
            <div className="pt-1">
              <h4 className={`font-semibold text-base mb-1 ${isLight ? 'text-primary-foreground' : 'text-white'}`}>
                {step.title}
              </h4>
              <p className={`text-sm leading-relaxed ${isLight ? 'text-gray-600' : 'text-gray-400'}`}>
                {step.description}
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function PlanTimeline() {
  return (
    <section className="py-20 md:py-28 bg-zinc-950">
      <div className="max-w-7xl mx-auto px-4">
        <h2 className="text-3xl md:text-4xl font-bold text-center mb-4">
          Linha do tempo do acompanhamento
        </h2>
        <p className="text-gray-400 text-center mb-16 max-w-2xl mx-auto">
          Veja como funciona a jornada do atleta em cada plano
        </p>

        <div className="grid md:grid-cols-2 gap-8 lg:gap-12">
          {/* Consultoria Timeline */}
          <div className="bg-zinc-900/50 backdrop-blur-sm rounded-3xl p-8 md:p-10 border border-zinc-800">
            <h3 className="text-xl md:text-2xl font-bold text-white mb-8">
              Plano Consultoria
            </h3>
            <TimelineSteps steps={consultoriaSteps} variant="dark" />
          </div>

          {/* Consultas Timeline */}
          <div className="relative bg-white rounded-3xl p-8 md:p-10 border-2 border-white">
            <div className="absolute -top-3 -right-3 bg-black text-white text-xs font-bold px-3 py-1 rounded-full">
              MAIS COMPLETO
            </div>
            <h3 className="text-xl md:text-2xl font-bold text-primary-foreground mb-8">
              Plano Consultas
            </h3>
            <TimelineSteps steps={consultasSteps} variant="light" />
          </div>
        </div>
      </div>
    </section>
  );
}
