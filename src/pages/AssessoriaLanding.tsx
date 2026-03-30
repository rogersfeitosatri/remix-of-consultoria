import { Button } from "@/components/ui/button";
import { Check, ArrowRight, Timer, Calendar, MessageCircle, ClipboardCheck, Dumbbell, Apple, Video, Trophy, Target, Heart, Users, Zap, Smartphone } from "lucide-react";
import { Link } from "react-router-dom";
import logo from "@/assets/rf-assessoria-logo.jpg";
import heroImg from "@/assets/hero-runners.jpg";
import appMealPlan from "@/assets/app-meal-plan.png";
import appHome from "@/assets/app-home.png";
import appTraining from "@/assets/app-training.png";
import { usePublicLandingPageSettings } from "@/hooks/useLandingPageSettings";

const DEFAULT_WHATSAPP_LINK = "https://wa.me/5500000000000?text=Quero%20saber%20mais%20sobre%20a%20RF%20Assessoria%20Esportiva";

export default function AssessoriaLanding() {
  const { data: settings } = usePublicLandingPageSettings();
  const WHATSAPP_LINK = settings?.assessoria_whatsapp_url || DEFAULT_WHATSAPP_LINK;
  return (
    <div className="min-h-screen bg-black text-white font-sans">
      {/* Header */}
      <header className="fixed top-0 left-0 right-0 z-50 bg-black/95 backdrop-blur-sm border-b border-[hsl(43,74%,49%)]/20">
        <div className="container mx-auto px-4 py-3 flex justify-between items-center">
          <div className="flex items-center gap-3">
            <img src={logo} alt="RF Assessoria Esportiva" className="h-10 w-auto rounded-full object-contain" />
            <span className="font-bold text-lg text-[hsl(43,74%,49%)]">RF Assessoria Esportiva</span>
          </div>
          <a href="#plano">
            <Button size="sm" className="bg-[hsl(43,74%,49%)] hover:bg-[hsl(43,74%,40%)] text-primary-foreground font-semibold border-0">
              Quero começar
            </Button>
          </a>
        </div>
      </header>

      {/* Hero - BORA style split layout */}
      <section className="pt-20 relative overflow-hidden min-h-[100vh] md:min-h-[90vh] flex items-end md:items-center">
        {/* Background image - full on mobile, right side on desktop */}
        <div className="absolute inset-0 md:left-[40%]">
          <img src={heroImg} alt="Rogers Feitosa correndo" className="w-full h-full object-cover object-[center_20%] md:object-top opacity-50 md:opacity-60" />
          <div className="absolute inset-0 bg-gradient-to-t from-black via-black/70 to-transparent md:bg-gradient-to-r md:from-black md:via-black/60 md:to-transparent" />
        </div>

        <div className="container mx-auto px-4 relative z-10">
          <div className="max-w-xl py-10 pb-16 md:py-24">
            <img
              src={logo}
              alt="RF Assessoria Esportiva"
              className="hidden md:block w-56 h-56 md:w-72 md:h-72 lg:w-80 lg:h-80 rounded-3xl object-contain mb-8 bg-black/80 p-2"
            />

            <h1 className="text-3xl md:text-5xl lg:text-6xl font-extrabold leading-[1.1] mb-5 md:mb-6">
              <span className="text-[hsl(43,74%,49%)] italic">A corrida{"\n"}transforma.</span>
              <br />
              E a <span className="text-[hsl(43,74%,49%)]">RF</span> vai
              <br />
              com você.
            </h1>

            <p className="text-sm md:text-lg text-gray-300 mb-6 md:mb-8 max-w-md">
              A única assessoria que integra <strong className="text-white">nutrição e treinamento</strong> num só profissional. Treino e dieta sincronizados para você evoluir de verdade.
            </p>

            <a href="#plano">
              <Button size="lg" className="bg-[hsl(43,74%,49%)] hover:bg-[hsl(43,74%,40%)] text-primary-foreground text-base md:text-lg px-8 md:px-10 py-6 md:py-7 rounded-xl shadow-lg shadow-[hsl(43,74%,49%)]/20 font-bold w-full md:w-auto">
                Quero treinar com a RF!
              </Button>
            </a>
          </div>
        </div>
      </section>

      {/* Diferencial */}
      <section className="py-16 md:py-20 bg-gray-950">
        <div className="container mx-auto px-4">
          <h2 className="text-2xl md:text-3xl lg:text-4xl font-bold text-center mb-4 text-white">
            Por que <span className="text-[hsl(43,74%,49%)]">treino e nutrição juntos</span> mudam tudo?
          </h2>
          <p className="text-gray-400 text-center mb-12 max-w-2xl mx-auto">
            Em assessorias comuns, treino e dieta não se conversam. Aqui, cada sessão de treino tem a nutrição alinhada pra você render mais, recuperar melhor e evoluir de verdade.
          </p>

          <div className="grid md:grid-cols-3 gap-6 max-w-5xl mx-auto">
            {[
              { icon: Dumbbell, title: "Planilha de treino personalizada", desc: "Criada pelo treinador Rogers Feitosa, ajustada aos seus objetivos, nível e rotina." },
              { icon: Apple, title: "Plano alimentar estratégico", desc: "Dieta personalizada com estratégias de suplementação pré, intra e pós-treino." },
              { icon: Zap, title: "100% sincronizados", desc: "Treino e nutrição conversam entre si. Cada sessão tem o combustível certo pra render." },
            ].map((item, index) => (
              <div key={index} className="bg-gray-900 border border-gray-800 rounded-2xl p-6 text-center hover:border-[hsl(43,74%,49%)]/40 transition-colors">
                <div className="w-14 h-14 bg-[hsl(43,74%,49%)]/10 rounded-xl flex items-center justify-center mx-auto mb-4">
                  <item.icon className="w-7 h-7 text-[hsl(43,74%,49%)]" />
                </div>
                <h3 className="font-bold text-lg mb-2 text-white">{item.title}</h3>
                <p className="text-gray-400 text-sm">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* App Showcase */}
      <section className="py-16 md:py-20 bg-black overflow-hidden">
        <div className="container mx-auto px-4">
          <div className="text-center mb-12">
            <div className="inline-flex items-center gap-2 bg-[hsl(43,74%,49%)]/10 border border-[hsl(43,74%,49%)]/30 text-[hsl(43,74%,49%)] px-4 py-2 rounded-full text-sm font-bold mb-4">
              <Smartphone className="w-4 h-4" />
              Tudo na palma da mão
            </div>
            <h2 className="text-2xl md:text-3xl lg:text-4xl font-bold text-white mb-4">
              Treino, dieta e evolução <span className="text-[hsl(43,74%,49%)]">no seu celular</span>
            </h2>
            <p className="text-gray-400 max-w-xl mx-auto">
              Acompanhe seu plano alimentar, detalhes de treino e evolução direto no app.
            </p>
          </div>

          <div className="flex justify-center items-end gap-4 md:gap-8 max-w-4xl mx-auto">
            {/* Meal Plan Phone */}
            <div className="w-[30%] md:w-[220px] rounded-[20px] md:rounded-[28px] overflow-hidden shadow-2xl shadow-black/50 border border-gray-800 -rotate-6 translate-y-4">
              <img src={appMealPlan} alt="Plano Alimentar no App" className="w-full" loading="lazy" />
            </div>
            {/* Home Phone - center, bigger */}
            <div className="w-[36%] md:w-[260px] rounded-[20px] md:rounded-[28px] overflow-hidden shadow-2xl shadow-[hsl(43,74%,49%)]/10 border-2 border-[hsl(43,74%,49%)]/30 z-10">
              <img src={appHome} alt="App Home" className="w-full" loading="lazy" />
            </div>
            {/* Training Phone */}
            <div className="w-[30%] md:w-[220px] rounded-[20px] md:rounded-[28px] overflow-hidden shadow-2xl shadow-black/50 border border-gray-800 rotate-6 translate-y-4">
              <img src={appTraining} alt="Detalhes do Treino" className="w-full" loading="lazy" />
            </div>
          </div>
        </div>
      </section>

      {/* Para Quem */}
      <section className="py-16 md:py-20 bg-gray-950">
        <div className="container mx-auto px-4">
          <h2 className="text-2xl md:text-3xl lg:text-4xl font-bold text-center mb-4 text-white">
            Pra quem é a RF Assessoria?
          </h2>
          <p className="text-gray-400 text-center mb-12 max-w-xl mx-auto">
            Não precisa ser rápido. Nem experiente. Só precisa querer começar.
          </p>

          <div className="grid md:grid-cols-2 gap-6 max-w-4xl mx-auto">
            {[
              { icon: Heart, title: "Está começando a correr", desc: "Corrida é sobre cuidar de você, criar uma rotina e viver algo que transforma. Você não precisa estar pronto — só dar o primeiro passo." },
              { icon: Target, title: "Quer perder peso correndo", desc: "Treine e emagreça com orientação profissional — sem perder gás, sem dietas malucas." },
              { icon: Trophy, title: "Busca performance em provas", desc: "Quer bater RP? Completar uma Major? Treinos ajustados para provas com foco em pace, estratégia e constância." },
              { icon: Users, title: "Quer acompanhamento completo", desc: "Quer nutricionista + treinador no mesmo lugar, com tudo alinhado e acompanhamento real." },
            ].map((item, index) => (
              <div key={index} className="flex gap-4 items-start bg-black p-5 rounded-xl border border-gray-800">
                <div className="flex-shrink-0 w-10 h-10 bg-[hsl(43,74%,49%)] rounded-full flex items-center justify-center">
                  <item.icon className="w-5 h-5 text-primary-foreground" />
                </div>
                <div>
                  <h3 className="font-bold text-white mb-1">{item.title}</h3>
                  <p className="text-gray-400 text-sm">{item.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Como Funciona */}
      <section className="py-20 md:py-28 bg-black relative overflow-hidden">
        {/* Subtle background glow */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-[hsl(43,74%,49%)]/5 rounded-full blur-3xl pointer-events-none" />
        
        <div className="container mx-auto px-4 relative z-10">
          <p className="text-[hsl(43,74%,49%)] text-center mb-3 text-sm font-bold tracking-widest uppercase">Como funciona</p>
          <h2 className="text-2xl md:text-3xl lg:text-4xl font-bold text-center mb-4 text-white">
            Do zero à sua melhor versão em{" "}
            <span className="text-[hsl(43,74%,49%)]">3 passos</span>
          </h2>
          <p className="text-gray-400 text-center mb-14 max-w-lg mx-auto">
            Um processo simples, direto e sem complicação pra você começar a evoluir.
          </p>

          <div className="max-w-4xl mx-auto space-y-0">
            {[
              {
                step: "01",
                title: "Inscreva-se e preencha o diagnóstico",
                desc: "Após a adesão, você preenche um formulário completo sobre sua rotina, objetivos, histórico de treinos e alimentação. É a base para montar tudo de forma personalizada.",
                icon: ClipboardCheck,
              },
              {
                step: "02",
                title: "Receba treino + dieta sincronizados",
                desc: "Em até 72h úteis, sua planilha de treino e plano alimentar estarão disponíveis no app — tudo pensado em conjunto pelo nutricionista e treinador para que um potencialize o outro.",
                icon: Calendar,
              },
              {
                step: "03",
                title: "Evolua com acompanhamento contínuo",
                desc: "A cada mês, você faz um check-in completo. Avaliamos peso, medidas, treinos e sensações para ajustar tudo. Dúvidas no meio do caminho? Suporte direto pelo WhatsApp.",
                icon: Trophy,
              },
            ].map((item, index, arr) => (
              <div key={index} className="relative flex items-stretch gap-6 md:gap-8">
                {/* Vertical connector line */}
                <div className="flex flex-col items-center">
                  <div className="w-14 h-14 md:w-16 md:h-16 bg-[hsl(43,74%,49%)] text-primary-foreground rounded-2xl flex items-center justify-center text-lg md:text-xl font-bold shadow-lg shadow-[hsl(43,74%,49%)]/25 flex-shrink-0 relative z-10">
                    <item.icon className="w-6 h-6 md:w-7 md:h-7" />
                  </div>
                  {index < arr.length - 1 && (
                    <div className="w-px flex-1 bg-gradient-to-b from-[hsl(43,74%,49%)]/40 to-transparent min-h-[40px]" />
                  )}
                </div>

                {/* Content card */}
                <div className={`flex-1 pb-10 ${index === arr.length - 1 ? 'pb-0' : ''}`}>
                  <div className="bg-gray-950/80 border border-gray-800 rounded-2xl p-5 md:p-6 hover:border-[hsl(43,74%,49%)]/30 transition-all duration-300">
                    <span className="text-[hsl(43,74%,49%)] text-xs font-bold tracking-widest mb-2 block">PASSO {item.step}</span>
                    <h3 className="font-bold text-lg md:text-xl text-white mb-2">{item.title}</h3>
                    <p className="text-gray-400 text-sm md:text-base leading-relaxed">{item.desc}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* O que inclui */}
      <section className="py-16 md:py-20 bg-gray-950">
        <div className="container mx-auto px-4">
          <h2 className="text-2xl md:text-3xl lg:text-4xl font-bold text-center mb-3 text-white">
            Tudo que você precisa.{" "}
            <span className="text-[hsl(43,74%,49%)]">Num só lugar.</span>
          </h2>
          <p className="text-gray-400 text-center mb-12 max-w-xl mx-auto">
            Onde você estiver, a gente corre com você. Assessoria 100% online.
          </p>

          <div className="grid md:grid-cols-2 gap-5 max-w-4xl mx-auto">
            {[
              { icon: Dumbbell, title: "Planilha de treino personalizada", desc: "Periodização individual criada pelo treinador Rogers Feitosa, adaptada ao seu nível e objetivos." },
              { icon: Apple, title: "Plano alimentar completo", desc: "Dieta desenhada para a sua rotina de treinos com estratégias suplementares pré, intra e pós." },
              { icon: Calendar, title: "Check-in mensal", desc: "A cada mês, avaliamos sua evolução, ajustamos treino e dieta conforme necessário." },
              { icon: Zap, title: "Bônus: Zona Nutri", desc: "Sistema inteligente que monta sua suplementação ideal para cada tipo de treino automaticamente." },
              { icon: MessageCircle, title: "Suporte direto no WhatsApp", desc: "Dúvidas sobre treino ou dieta? Fale diretamente com o Rogers pelo WhatsApp." },
            ].map((item, index) => (
              <div key={index} className="flex gap-4 items-start bg-black/50 border border-gray-800 p-5 rounded-xl hover:border-[hsl(43,74%,49%)]/30 transition-colors">
                <div className="flex-shrink-0 w-11 h-11 bg-[hsl(43,74%,49%)]/10 rounded-xl flex items-center justify-center">
                  <item.icon className="w-5 h-5 text-[hsl(43,74%,49%)]" />
                </div>
                <div>
                  <h3 className="font-bold text-white mb-1">{item.title}</h3>
                  <p className="text-gray-400 text-sm">{item.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Plano / Pricing */}
      <section id="plano" className="py-16 md:py-24 bg-gradient-to-b from-black to-gray-950">
        <div className="container mx-auto px-4">
          <h2 className="text-2xl md:text-3xl lg:text-4xl font-bold text-center mb-3 text-white">
            Invista na sua evolução
          </h2>
          <p className="text-gray-400 text-center mb-12">Assessoria completa: treino + nutrição no mesmo lugar.</p>

          <div className="max-w-lg mx-auto">
            <div className="relative bg-gradient-to-b from-gray-900 to-gray-950 rounded-3xl border-2 border-[hsl(43,74%,49%)]/50 p-8 md:p-10 shadow-2xl shadow-[hsl(43,74%,49%)]/10">
              <div className="absolute -top-4 left-1/2 -translate-x-1/2">
                <div className="bg-[hsl(43,74%,49%)] text-primary-foreground text-sm font-bold px-5 py-1.5 rounded-full flex items-center gap-2 whitespace-nowrap">
                  <Timer className="w-4 h-4" />
                  Adesão até 30/04/2026
                </div>
              </div>

              <div className="text-center mb-8 pt-4">
                <h3 className="text-xl md:text-2xl font-bold text-white mb-1">RF Assessoria Completa</h3>
                <p className="text-gray-400 text-sm mb-6">Nutrição + Treinamento sincronizados</p>

                <div className="flex items-end justify-center gap-1 mb-2">
                  <span className="text-4xl md:text-5xl font-extrabold text-[hsl(43,74%,49%)]">R$179,90</span>
                  <span className="text-gray-400 text-lg mb-1">/mês</span>
                </div>
                <p className="text-gray-500 text-sm">no 1º ano de acompanhamento</p>
              </div>

              <div className="space-y-3 mb-8">
                {[
                  "Planilha de treino 100% personalizada",
                  "Plano alimentar individualizado",
                  "Estratégias de suplementação pré, intra e pós-treino",
                  "Check-in mensal com ajustes de treino e dieta",
                  "Bônus: acesso à Zona Nutri",
                  "Suporte direto no WhatsApp",
                ].map((item, index) => (
                  <div key={index} className="flex items-center gap-3">
                    <div className="flex-shrink-0 w-5 h-5 bg-[hsl(43,74%,49%)]/20 rounded-full flex items-center justify-center">
                      <Check className="w-3 h-3 text-[hsl(43,74%,49%)]" />
                    </div>
                    <span className="text-gray-300 text-sm">{item}</span>
                  </div>
                ))}
              </div>

              <a href={WHATSAPP_LINK} target="_blank" rel="noopener noreferrer" className="block">
                <Button size="lg" className="w-full bg-[hsl(43,74%,49%)] hover:bg-[hsl(43,74%,40%)] text-primary-foreground text-lg py-6 rounded-xl font-bold shadow-lg">
                  GARANTIR MINHA VAGA
                  <ArrowRight className="ml-2 w-5 h-5" />
                </Button>
              </a>

              <p className="text-center text-gray-500 text-xs mt-4">Vagas limitadas · Pagamento seguro</p>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Final */}
      <section className="py-16 md:py-20 bg-black">
        <div className="container mx-auto px-4 text-center">
          <h2 className="text-2xl md:text-3xl lg:text-4xl font-bold mb-4 text-white">
            Seu treino e sua dieta nunca mais vão andar separados.
          </h2>
          <p className="text-gray-400 mb-8 max-w-xl mx-auto">
            Entre pra RF Assessoria e tenha tudo sincronizado: planilha de treino, plano alimentar, suplementação e acompanhamento real.
          </p>
          <a href="#plano">
            <Button size="lg" className="bg-[hsl(43,74%,49%)] hover:bg-[hsl(43,74%,40%)] text-primary-foreground text-lg px-10 py-6 rounded-xl font-bold shadow-lg shadow-[hsl(43,74%,49%)]/20">
              QUERO COMEÇAR AGORA
              <ArrowRight className="ml-2 w-5 h-5" />
            </Button>
          </a>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-8 bg-black border-t border-gray-800 text-gray-500 text-center text-sm">
        <div className="container mx-auto px-4">
          <img src={logo} alt="RF" className="w-10 h-auto rounded-full mx-auto mb-3 opacity-60 object-contain" />
          <p>© 2026 Rogers Feitosa — Nutrição e Treinamento. Todos os direitos reservados.</p>
          <Link to="/auth" className="text-gray-500 hover:text-[hsl(43,74%,49%)] underline mt-2 inline-block text-xs">
            Área do Membro
          </Link>
        </div>
      </footer>
    </div>
  );
}
