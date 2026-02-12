import { Check, MessageCircle, Target, Users, Zap, Award, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { usePublicLandingPageSettings } from '@/hooks/useLandingPageSettings';
import PlansTestimonialsCarousel from '@/components/plans/PlansTestimonialsCarousel';
import PlanTimeline from '@/components/plans/PlanTimeline';

// Import runner images
import runnerHero from '@/assets/runner-hero.jpg';
import runner2 from '@/assets/runner-2.jpg';
import runner3 from '@/assets/runner-3.jpg';
import runner4 from '@/assets/runner-4.jpg';

export default function PlansLanding() {
  const { data: settings, isLoading } = usePublicLandingPageSettings();

  const consultoriaUrl = settings?.plans_consultoria_whatsapp_url || '';
  const consultasUrl = settings?.plans_consultas_whatsapp_url || '';

  const consultoriaFeatures = [
    'Plano alimentar pra fase atual do ciclo de treino',
    'Plano suplementar com estratégias de pré, intra e pós-treino adaptados à rotina do corredor',
    'Suporte longão via Zona Nutri (sistema de ajuste estratégico de géis + pré, intra e pós)',
    'Avaliação mensal via formulário para coleta de sensações e ajustes na dieta (se for preciso)',
    'Dúvidas no WhatsApp diretamente com o Nutri',
  ];

  const consultasFeatures = [
    'Consultas nutricionais a cada 6 semanas',
    'Plano alimentar pra fase atual do ciclo de treino',
    'Plano suplementar com estratégias de pré, intra e pós-treino adaptados à rotina do corredor',
    'Suporte longão via Zona Nutri (sistema de ajuste estratégico de géis + pré, intra e pós)',
    'Avaliação QUINZENAL via formulário para coleta de sensações com o plano para serem discutidas nas consultas',
    'Ajustes ilimitados no plano (basta solicitar)',
    'Dúvidas no WhatsApp diretamente com o Nutri',
  ];

  return (
    <div className="min-h-screen bg-black text-white">
      {/* Hero Section */}
      <section className="relative min-h-[90vh] flex items-center justify-center overflow-hidden">
        {/* Background Image */}
        <div className="absolute inset-0 z-0">
          <img 
            src={runnerHero} 
            alt="Atleta correndo" 
            className="w-full h-full object-cover opacity-40"
          />
          <div className="absolute inset-0 bg-gradient-to-b from-black/60 via-black/40 to-black" />
        </div>
        
        {/* Content */}
        <div className="relative z-10 max-w-5xl mx-auto px-4 text-center py-20">
          <span className="inline-block px-4 py-2 bg-white/10 backdrop-blur-sm rounded-full text-sm font-medium mb-6 border border-white/20">
            Nutrição Esportiva Especializada
          </span>
          <h1 className="text-4xl md:text-6xl lg:text-7xl font-bold tracking-tight mb-6 leading-tight">
            Consultoria{' '}
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-white to-gray-400">
              Nutricional
            </span>
          </h1>
          <p className="text-xl md:text-2xl text-gray-300 font-medium mb-4">
            Emagrecimento e Performance
          </p>
          <p className="text-lg md:text-xl text-gray-400 mb-6 max-w-3xl mx-auto">
            Acompanhamento personalizado para quem busca <strong className="text-white">emagrecer com saúde</strong>, melhorar a <strong className="text-white">performance esportiva</strong> ou alcançar a melhor forma física.
          </p>
          <p className="text-base text-gray-500 italic mb-10">
            Planos adaptados à sua rotina, seja você atleta amador, praticante de corrida, triathlon ou qualquer outra modalidade.
          </p>
          <Button
            size="lg"
            className="bg-white text-black hover:bg-gray-200 text-lg px-8 py-6 h-auto font-semibold"
            onClick={() => document.getElementById('planos')?.scrollIntoView({ behavior: 'smooth' })}
          >
            Conhecer os Planos
            <ArrowRight className="ml-2 h-5 w-5" />
          </Button>
        </div>

        {/* Scroll indicator */}
        <div className="absolute bottom-8 left-1/2 -translate-x-1/2 animate-bounce">
          <div className="w-6 h-10 border-2 border-white/30 rounded-full flex justify-center pt-2">
            <div className="w-1 h-3 bg-white/50 rounded-full" />
          </div>
        </div>
      </section>

      {/* Para Quem É Section */}
      <section className="py-20 md:py-28 bg-zinc-950">
        <div className="max-w-7xl mx-auto px-4">
          <h2 className="text-3xl md:text-4xl font-bold text-center mb-4">
            Qual plano é ideal pra você?
          </h2>
          <p className="text-gray-400 text-center mb-16 max-w-2xl mx-auto">
            Entenda as diferenças e escolha o acompanhamento que faz sentido pro seu momento
          </p>

          <div className="grid md:grid-cols-2 gap-8 lg:gap-12">
            {/* Para Quem é Consultoria */}
            <div className="relative group">
              <div className="absolute inset-0 bg-gradient-to-b from-white/5 to-transparent rounded-3xl transform group-hover:scale-105 transition-transform duration-300" />
              <div className="relative bg-zinc-900/50 backdrop-blur-sm rounded-3xl p-8 border border-zinc-800 h-full">
                <div className="aspect-[4/3] rounded-2xl overflow-hidden mb-8">
                  <img 
                    src={runner2} 
                    alt="Atleta em treino" 
                    className="w-full h-full object-cover grayscale hover:grayscale-0 transition-all duration-500"
                  />
                </div>
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-12 h-12 rounded-full bg-white/10 flex items-center justify-center">
                    <Target className="h-6 w-6 text-white" />
                  </div>
                  <h3 className="text-2xl font-bold">Plano Consultoria</h3>
                </div>
                <p className="text-lg text-white/80 mb-6 font-medium">
                  Pra quem é?
                </p>
                <ul className="space-y-3 text-gray-400">
                  <li className="flex items-start gap-3">
                    <Check className="h-5 w-5 text-white mt-0.5 flex-shrink-0" />
                    <span>Atleta que já conhece sua rotina alimentar e precisa de direcionamento estratégico</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <Check className="h-5 w-5 text-white mt-0.5 flex-shrink-0" />
                    <span>Quem busca otimizar suplementação e estratégia de prova sem precisar de consultas frequentes</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <Check className="h-5 w-5 text-white mt-0.5 flex-shrink-0" />
                    <span>Corredores que preferem acompanhamento assíncrono via formulários e WhatsApp</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <Check className="h-5 w-5 text-white mt-0.5 flex-shrink-0" />
                    <span>Atleta com rotina estável que precisa de ajustes pontuais conforme evolução</span>
                  </li>
                </ul>
              </div>
            </div>

            {/* Para Quem é Consultas */}
            <div className="relative group">
              <div className="absolute inset-0 bg-gradient-to-b from-white/10 to-transparent rounded-3xl transform group-hover:scale-105 transition-transform duration-300" />
              <div className="relative bg-zinc-900/50 backdrop-blur-sm rounded-3xl p-8 border border-white/20 h-full">
                <div className="absolute -top-3 -right-3 bg-white text-black text-xs font-bold px-3 py-1 rounded-full">
                  MAIS COMPLETO
                </div>
                <div className="aspect-[4/3] rounded-2xl overflow-hidden mb-8">
                  <img 
                    src={runner3} 
                    alt="Atleta em prova" 
                    className="w-full h-full object-cover grayscale hover:grayscale-0 transition-all duration-500"
                  />
                </div>
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-12 h-12 rounded-full bg-white/10 flex items-center justify-center">
                    <Users className="h-6 w-6 text-white" />
                  </div>
                  <h3 className="text-2xl font-bold">Plano Consultas</h3>
                </div>
                <p className="text-lg text-white/80 mb-6 font-medium">
                  Pra quem é?
                </p>
                <ul className="space-y-3 text-gray-400">
                  <li className="flex items-start gap-3">
                    <Check className="h-5 w-5 text-white mt-0.5 flex-shrink-0" />
                    <span>Atleta que quer acompanhamento intensivo com consulta mensal e ajustes ilimitados</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <Check className="h-5 w-5 text-white mt-0.5 flex-shrink-0" />
                    <span>Quem está em fase de preparação para prova importante e precisa de atenção máxima</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <Check className="h-5 w-5 text-white mt-0.5 flex-shrink-0" />
                    <span>Corredores que valorizam feedback semanal e resposta rápida às mudanças</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <Check className="h-5 w-5 text-white mt-0.5 flex-shrink-0" />
                    <span>Atleta com meta ambiciosa de performance ou emagrecimento acelerado</span>
                  </li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Planos Section */}
      <section id="planos" className="py-20 md:py-28 bg-black">
        <div className="max-w-7xl mx-auto px-4">
          <h2 className="text-3xl md:text-4xl font-bold text-center mb-4">
            Como funciona cada plano
          </h2>
          <p className="text-gray-400 text-center mb-16 max-w-2xl mx-auto">
            Escolha o modelo de acompanhamento ideal para seu momento
          </p>

          <div className="grid md:grid-cols-2 gap-8 lg:gap-10">
            {/* Plano Consultoria */}
            <div className="bg-zinc-900 rounded-3xl p-8 md:p-10 border border-zinc-800 hover:border-zinc-700 transition-colors">
              <div className="flex items-center gap-3 mb-6">
                <Zap className="h-8 w-8 text-white" />
                <h3 className="text-2xl md:text-3xl font-bold">Plano Consultoria</h3>
              </div>
              <p className="text-gray-400 mb-8">
                Acompanhamento estratégico mensal para atletas que buscam direcionamento sem precisar de consultas frequentes.
              </p>
              <ul className="space-y-4 mb-10">
                {consultoriaFeatures.map((feature, index) => (
                  <li key={index} className="flex items-start gap-3">
                    <div className="w-6 h-6 rounded-full bg-white/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                      <Check className="h-4 w-4 text-white" />
                    </div>
                    <span className="text-gray-300">{feature}</span>
                  </li>
                ))}
              </ul>
              <Button
                className="w-full h-14 text-lg font-semibold bg-white text-black hover:bg-gray-200"
                onClick={() => window.open(consultoriaUrl, '_blank')}
                disabled={isLoading}
              >
                <MessageCircle className="h-5 w-5 mr-2" />
                Quero o Plano Consultoria
              </Button>
            </div>

            {/* Plano Consultas */}
            <div className="relative bg-white rounded-3xl p-8 md:p-10 border-2 border-white">
              <div className="absolute -top-4 left-1/2 -translate-x-1/2 bg-black text-white text-sm font-bold px-4 py-1.5 rounded-full">
                MAIS POPULAR
              </div>
              <div className="flex items-center gap-3 mb-6">
                <Award className="h-8 w-8 text-black" />
                <h3 className="text-2xl md:text-3xl font-bold text-black">Plano Consultas</h3>
              </div>
              <p className="text-gray-600 mb-8">
                Acompanhamento completo com consultas periódicas, ajustes semanais e suporte intensivo.
              </p>
              <ul className="space-y-4 mb-10">
                {consultasFeatures.map((feature, index) => (
                  <li key={index} className="flex items-start gap-3">
                    <div className="w-6 h-6 rounded-full bg-black/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                      <Check className="h-4 w-4 text-black" />
                    </div>
                    <span className="text-gray-700">{feature}</span>
                  </li>
                ))}
              </ul>
              <Button
                className="w-full h-14 text-lg font-semibold bg-black text-white hover:bg-zinc-800"
                onClick={() => window.open(consultasUrl, '_blank')}
                disabled={isLoading}
              >
                <MessageCircle className="h-5 w-5 mr-2" />
                Quero o Plano Consultas
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* Timeline Section */}
      <PlanTimeline />

      {/* Testimonials Section */}
      <PlansTestimonialsCarousel />

      {/* CTA Final Section */}
      <section className="py-20 md:py-28 bg-zinc-950 relative overflow-hidden">
        <div className="absolute inset-0 z-0">
          <img 
            src={runner4} 
            alt="Atleta" 
            className="w-full h-full object-cover opacity-20"
          />
          <div className="absolute inset-0 bg-gradient-to-r from-black via-black/90 to-black/80" />
        </div>
        
        <div className="relative z-10 max-w-3xl mx-auto text-center px-4">
          <MessageCircle className="h-16 w-16 text-white mx-auto mb-8 opacity-80" />
          <h3 className="text-3xl md:text-4xl font-bold mb-6">
            Ainda tem dúvidas?
          </h3>
          <p className="text-xl text-gray-300 mb-10">
            Me chama no WhatsApp e eu te digo qual plano faz mais sentido pro seu momento.
          </p>
          <Button
            variant="outline"
            size="lg"
            className="text-lg border-white text-white hover:bg-white hover:text-black px-8 py-6 h-auto"
            onClick={() => window.open(consultoriaUrl, '_blank')}
            disabled={isLoading}
          >
            <MessageCircle className="h-5 w-5 mr-2" />
            Falar no WhatsApp
          </Button>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-8 px-4 text-center text-sm text-gray-500 bg-black border-t border-zinc-900">
        <p>© {new Date().getFullYear()} Rogers Feitosa - Nutricionista Esportivo</p>
      </footer>
    </div>
  );
}
