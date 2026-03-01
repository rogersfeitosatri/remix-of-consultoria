import { ClipboardList, Utensils, RefreshCw, MessageCircle, Activity, Calendar, FileText, Dumbbell, Target, Award, Zap, Users, Heart, Star, Check, Gift, LucideIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { OfferItem } from '@/hooks/useLandingPageSettings';

const ICON_MAP: Record<string, LucideIcon> = {
  Calendar, Utensils, ClipboardList, RefreshCw, MessageCircle,
  Dumbbell, FileText, Activity, Target, Award, Zap, Users,
  Heart, Star, Check, Gift,
};

function TimelineSteps({ steps, variant }: { steps: OfferItem[]; variant: 'light' | 'dark' }) {
  const isLight = variant === 'light';

  return (
    <div className="relative">
      <div className={`absolute left-5 top-8 bottom-8 w-px ${isLight ? 'bg-black/15' : 'bg-white/15'}`} />
      <div className="space-y-8">
        {steps.map((step, index) => {
          const Icon = ICON_MAP[step.icon] || Check;
          return (
            <div key={step.id || index} className="flex items-start gap-5 relative">
              <div className={`relative z-10 w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${
                isLight ? 'bg-primary-foreground text-white' : 'bg-white text-primary-foreground'
              }`}>
                <Icon className="h-5 w-5" />
              </div>
              <div className="pt-1">
                <h4 className={`font-semibold text-base mb-1 ${isLight ? 'text-primary-foreground' : 'text-white'}`}>
                  {step.title}
                </h4>
                <p className={`text-sm leading-relaxed ${isLight ? 'text-gray-600' : 'text-gray-400'}`}>
                  {step.description}
                </p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

interface PlanTimelineProps {
  consultoriaUrl: string;
  consultasUrl: string;
  isLoading: boolean;
  timelineTitle?: string;
  timelineSubtitle?: string;
  consultoriaSectionTitle?: string;
  consultasSectionTitle?: string;
  consultoriaCtaLabel?: string;
  consultasCtaLabel?: string;
  consultoriaOffers?: OfferItem[];
  consultasOffers?: OfferItem[];
}

export default function PlanTimeline({
  consultoriaUrl,
  consultasUrl,
  isLoading,
  timelineTitle = 'Linha do tempo do acompanhamento',
  timelineSubtitle = 'Veja como funciona a jornada do atleta em cada plano',
  consultoriaSectionTitle = 'Plano Consultoria',
  consultasSectionTitle = 'Plano Consultas',
  consultoriaCtaLabel = 'Quero o Plano Consultoria',
  consultasCtaLabel = 'Quero o Plano Consultas',
  consultoriaOffers = [],
  consultasOffers = [],
}: PlanTimelineProps) {
  return (
    <section id="planos" className="py-20 md:py-28 bg-zinc-950">
      <div className="max-w-7xl mx-auto px-4">
        <h2 className="text-3xl md:text-4xl font-bold text-center mb-4">
          {timelineTitle}
        </h2>
        <p className="text-gray-400 text-center mb-16 max-w-2xl mx-auto">
          {timelineSubtitle}
        </p>

        <div className="grid md:grid-cols-2 gap-8 lg:gap-12">
          {/* Consultoria Timeline */}
          <div className="bg-zinc-900/50 backdrop-blur-sm rounded-3xl p-8 md:p-10 border border-zinc-800">
            <h3 className="text-xl md:text-2xl font-bold text-white mb-8">
              {consultoriaSectionTitle}
            </h3>
            <TimelineSteps steps={consultoriaOffers} variant="dark" />
            <Button
              className="w-full h-14 text-lg font-semibold bg-white text-primary-foreground hover:bg-gray-200 mt-10"
              onClick={() => window.open(consultoriaUrl, '_blank')}
              disabled={isLoading}
            >
              <MessageCircle className="h-5 w-5 mr-2" />
              {consultoriaCtaLabel}
            </Button>
          </div>

          {/* Consultas Timeline */}
          <div className="relative bg-white rounded-3xl p-8 md:p-10 border-2 border-white">
            <div className="absolute -top-3 -right-3 bg-black text-white text-xs font-bold px-3 py-1 rounded-full">
              MAIS COMPLETO
            </div>
            <h3 className="text-xl md:text-2xl font-bold text-primary-foreground mb-8">
              {consultasSectionTitle}
            </h3>
            <TimelineSteps steps={consultasOffers} variant="light" />
            <Button
              className="w-full h-14 text-lg font-semibold bg-black text-white hover:bg-zinc-800 mt-10"
              onClick={() => window.open(consultasUrl, '_blank')}
              disabled={isLoading}
            >
              <MessageCircle className="h-5 w-5 mr-2" />
              {consultasCtaLabel}
            </Button>
          </div>
        </div>
      </div>
    </section>
  );
}
