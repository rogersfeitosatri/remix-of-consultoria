import { Check, MessageCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { usePublicLandingPageSettings } from '@/hooks/useLandingPageSettings';

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
    '1 consulta nutricional por mês',
    'Plano alimentar pra fase atual do ciclo de treino',
    'Plano suplementar com estratégias de pré, intra e pós-treino adaptados à rotina do corredor',
    'Suporte longão via Zona Nutri (sistema de ajuste estratégico de géis + pré, intra e pós)',
    'Avaliação SEMANAL via formulário para coleta de sensações com o plano',
    'Ajustes ilimitados no plano (basta solicitar)',
    'Dúvidas no WhatsApp diretamente com o Nutri',
  ];

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted/30">
      {/* Hero Section */}
      <section className="py-16 px-4 md:py-24">
        <div className="max-w-4xl mx-auto text-center">
          <h1 className="text-3xl md:text-5xl font-bold tracking-tight mb-6 text-foreground">
            Consultoria Nutricional para Endurance
          </h1>
          <p className="text-xl md:text-2xl text-primary font-medium mb-4">
            Corrida e Triathlon
          </p>
          <p className="text-lg text-muted-foreground mb-4 max-w-2xl mx-auto">
            Foco em <strong>performance</strong>, <strong>recuperação</strong>, rotina real do atleta amador e estratégia de prova/longão.
          </p>
          <p className="text-base text-muted-foreground italic">
            Se seu objetivo for emagrecimento ou definição corporal, os dois planos também atendem isso.
          </p>
        </div>
      </section>

      {/* Como Funciona Section */}
      <section className="py-12 px-4 md:py-16">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-2xl md:text-3xl font-bold text-center mb-12 text-foreground">
            Como funciona
          </h2>
          <p className="text-center text-muted-foreground mb-10 text-lg">
            Existem 2 modelos de acompanhamento:
          </p>

          <div className="grid md:grid-cols-2 gap-8">
            {/* Plano Consultoria */}
            <Card className="border-2 hover:border-primary/50 transition-colors">
              <CardHeader className="text-center pb-4">
                <CardTitle className="text-2xl font-bold text-foreground">
                  Plano Consultoria
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <ul className="space-y-3">
                  {consultoriaFeatures.map((feature, index) => (
                    <li key={index} className="flex items-start gap-3">
                      <Check className="h-5 w-5 text-primary mt-0.5 flex-shrink-0" />
                      <span className="text-muted-foreground">{feature}</span>
                    </li>
                  ))}
                </ul>
                <Button
                  className="w-full h-12 text-lg font-semibold"
                  onClick={() => window.open(consultoriaUrl, '_blank')}
                  disabled={isLoading}
                >
                  <MessageCircle className="h-5 w-5 mr-2" />
                  Quero o Plano Consultoria
                </Button>
              </CardContent>
            </Card>

            {/* Plano Consultas */}
            <Card className="border-2 border-primary bg-primary/5 hover:border-primary transition-colors">
              <CardHeader className="text-center pb-4">
                <CardTitle className="text-2xl font-bold text-foreground">
                  Plano Consultas
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <ul className="space-y-3">
                  {consultasFeatures.map((feature, index) => (
                    <li key={index} className="flex items-start gap-3">
                      <Check className="h-5 w-5 text-primary mt-0.5 flex-shrink-0" />
                      <span className="text-muted-foreground">{feature}</span>
                    </li>
                  ))}
                </ul>
                <Button
                  className="w-full h-12 text-lg font-semibold"
                  onClick={() => window.open(consultasUrl, '_blank')}
                  disabled={isLoading}
                >
                  <MessageCircle className="h-5 w-5 mr-2" />
                  Quero o Plano Consultas
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* CTA Final Section */}
      <section className="py-16 px-4 md:py-20 bg-muted/50">
        <div className="max-w-2xl mx-auto text-center">
          <MessageCircle className="h-12 w-12 text-primary mx-auto mb-6" />
          <h3 className="text-xl md:text-2xl font-semibold mb-4 text-foreground">
            Ainda tem dúvidas?
          </h3>
          <p className="text-lg text-muted-foreground mb-8">
            Me chama no WhatsApp e eu te digo qual plano faz mais sentido pro seu momento.
          </p>
          <Button
            variant="outline"
            size="lg"
            className="text-lg"
            onClick={() => window.open(consultoriaUrl, '_blank')}
            disabled={isLoading}
          >
            <MessageCircle className="h-5 w-5 mr-2" />
            Falar no WhatsApp
          </Button>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-8 px-4 text-center text-sm text-muted-foreground">
        <p>© {new Date().getFullYear()} Rogers Feitosa - Nutricionista Esportivo</p>
      </footer>
    </div>
  );
}
