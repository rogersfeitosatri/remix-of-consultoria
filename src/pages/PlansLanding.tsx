import { Check, MessageCircle, Target, Users, Zap, Award, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { usePublicLandingPageSettings } from '@/hooks/useLandingPageSettings';
import PlansTestimonialsCarousel from '@/components/plans/PlansTestimonialsCarousel';
import PlanTimeline from '@/components/plans/PlanTimeline';
import ZonaNutriSection from '@/components/plans/ZonaNutriSection';

// Import runner images
import runnerHero from '@/assets/runner-hero.jpg';
import runner2 from '@/assets/runner-2.jpg';
import runner3 from '@/assets/runner-3.jpg';
import runner4 from '@/assets/runner-4.jpg';

export default function PlansLanding() {
  const { data: settings, isLoading } = usePublicLandingPageSettings();

  const s = settings;

  const consultoriaUrl = s?.plans_consultoria_whatsapp_url || '';
  const consultasUrl = s?.plans_consultas_whatsapp_url || '';

  const consultoriaItems = [
    s?.consultoria_item_1,
    s?.consultoria_item_2,
    s?.consultoria_item_3,
    s?.consultoria_item_4,
  ].filter(Boolean) as string[];

  const consultasItems = [
    s?.consultas_item_1,
    s?.consultas_item_2,
    s?.consultas_item_3,
    s?.consultas_item_4,
  ].filter(Boolean) as string[];

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
            {s?.hero_badge}
          </span>
          <h1 className="text-4xl md:text-6xl lg:text-7xl font-bold tracking-tight mb-6 leading-tight">
            {s?.hero_title}{' '}
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-white to-gray-400">
              {s?.hero_title_highlight}
            </span>
          </h1>
          <p className="text-xl md:text-2xl text-gray-300 font-medium mb-4">
            {s?.hero_subtitle}
          </p>
          <p className="text-lg md:text-xl text-gray-400 mb-6 max-w-3xl mx-auto">
            {s?.hero_description}
          </p>
          <p className="text-base text-gray-500 italic mb-10">
            {s?.hero_description_italic}
          </p>
          <Button
            size="lg"
            className="bg-white text-primary-foreground hover:bg-gray-200 text-lg px-8 py-6 h-auto font-semibold"
            onClick={() => document.getElementById('planos')?.scrollIntoView({ behavior: 'smooth' })}
          >
            {s?.hero_cta_button}
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
            {s?.para_quem_title}
          </h2>
          <p className="text-gray-400 text-center mb-16 max-w-2xl mx-auto">
            {s?.para_quem_subtitle}
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
                  <h3 className="text-2xl font-bold">{s?.consultoria_card_title}</h3>
                </div>
                <p className="text-lg text-white/80 mb-6 font-medium">
                  {s?.consultoria_card_subtitle}
                </p>
                <ul className="space-y-3 text-gray-400">
                  {consultoriaItems.map((item, i) => (
                    <li key={i} className="flex items-start gap-3">
                      <Check className="h-5 w-5 text-white mt-0.5 flex-shrink-0" />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            {/* Para Quem é Consultas */}
            <div className="relative group">
              <div className="absolute inset-0 bg-gradient-to-b from-white/10 to-transparent rounded-3xl transform group-hover:scale-105 transition-transform duration-300" />
              <div className="relative bg-zinc-900/50 backdrop-blur-sm rounded-3xl p-8 border border-white/20 h-full">
                {s?.consultas_badge && (
                  <div className="absolute -top-3 -right-3 bg-white text-primary-foreground text-xs font-bold px-3 py-1 rounded-full">
                    {s.consultas_badge}
                  </div>
                )}
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
                  <h3 className="text-2xl font-bold">{s?.consultas_card_title}</h3>
                </div>
                <p className="text-lg text-white/80 mb-6 font-medium">
                  {s?.consultas_card_subtitle}
                </p>
                <ul className="space-y-3 text-gray-400">
                  {consultasItems.map((item, i) => (
                    <li key={i} className="flex items-start gap-3">
                      <Check className="h-5 w-5 text-white mt-0.5 flex-shrink-0" />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Timeline Section */}
      <PlanTimeline
        consultoriaUrl={consultoriaUrl}
        consultasUrl={consultasUrl}
        isLoading={isLoading}
        timelineTitle={s?.timeline_title}
        timelineSubtitle={s?.timeline_subtitle}
        consultoriaSectionTitle={s?.timeline_consultoria_title}
        consultasSectionTitle={s?.timeline_consultas_title}
        consultoriaCtaLabel={s?.timeline_cta_consultoria}
        consultasCtaLabel={s?.timeline_cta_consultas}
      />

      {/* Zona Nutri Section */}
      <ZonaNutriSection />

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
            {s?.cta_title}
          </h3>
          <p className="text-xl text-gray-300 mb-10">
            {s?.cta_subtitle}
          </p>
          <Button
            variant="outline"
            size="lg"
            className="text-lg border-white text-white hover:bg-white hover:text-black px-8 py-6 h-auto"
            onClick={() => window.open(s?.cta_whatsapp_url || 'https://wa.me/5599984817697', '_blank')}
            disabled={isLoading}
          >
            <MessageCircle className="h-5 w-5 mr-2" />
            {s?.cta_button}
          </Button>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-8 px-4 text-center text-sm text-gray-500 bg-black border-t border-zinc-900">
        <p>© {new Date().getFullYear()} {s?.footer_text}</p>
      </footer>
    </div>
  );
}
