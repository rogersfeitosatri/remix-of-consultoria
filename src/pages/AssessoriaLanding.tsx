import { Button } from "@/components/ui/button";
import { Check, ArrowRight, Timer, Calendar, MessageCircle, ClipboardCheck, Dumbbell, Apple, Video, Trophy, Target, Heart, Users, Zap, ChevronRight } from "lucide-react";
import { Link } from "react-router-dom";
import logo from "@/assets/rf-assessoria-logo.jpg";

const WHATSAPP_LINK = "https://wa.me/5500000000000?text=Quero%20saber%20mais%20sobre%20a%20RF%20Assessoria%20Esportiva";

export default function AssessoriaLanding() {
  return (
    <div className="min-h-screen bg-black text-white font-sans">
      {/* Header */}
      <header className="fixed top-0 left-0 right-0 z-50 bg-black/95 backdrop-blur-sm border-b border-[hsl(43,74%,49%)]/20">
        <div className="container mx-auto px-4 py-3 flex justify-between items-center">
          <div className="flex items-center gap-3">
            <img src={logo} alt="RF Assessoria Esportiva" className="h-10 w-10 rounded-full object-cover" />
            <span className="font-bold text-lg text-[hsl(43,74%,49%)]">RF Assessoria Esportiva</span>
          </div>
          <a href="#plano">
            <Button size="sm" className="bg-[hsl(43,74%,49%)] hover:bg-[hsl(43,74%,40%)] text-primary-foreground font-semibold border-0">
              Quero começar
            </Button>
          </a>
        </div>
      </header>

      {/* Hero */}
      <section className="pt-24 pb-16 md:pt-28 md:pb-24 relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-[hsl(43,74%,49%)]/5 to-transparent pointer-events-none" />
        <div className="container mx-auto px-4 text-center relative">
          <img src={logo} alt="RF Assessoria Esportiva" className="w-28 h-28 md:w-36 md:h-36 mx-auto mb-8 rounded-2xl shadow-2xl shadow-[hsl(43,74%,49%)]/20" />
          
          <div className="inline-flex items-center gap-2 bg-[hsl(43,74%,49%)]/10 border border-[hsl(43,74%,49%)]/30 text-[hsl(43,74%,49%)] px-4 py-2 rounded-full text-sm font-bold mb-6">
            <Trophy className="w-4 h-4" />
            A única assessoria completa: Nutrição + Treino sincronizados
          </div>
          
          <h1 className="text-3xl md:text-5xl lg:text-6xl font-extrabold leading-tight mb-6 max-w-4xl mx-auto">
            Treino e dieta{" "}
            <span className="text-[hsl(43,74%,49%)]">feitos um pro outro.</span>
            <br />
            Assim como deve ser.
          </h1>
          
          <p className="text-lg md:text-xl text-gray-400 mb-10 max-w-2xl mx-auto">
            Receba sua planilha de treino personalizada e plano alimentar com estratégias suplementares — tudo criado e sincronizado pelo Nutri e Treinador Rogers Feitosa.
          </p>
          
          <a href="#plano">
            <Button size="lg" className="bg-[hsl(43,74%,49%)] hover:bg-[hsl(43,74%,40%)] text-primary-foreground text-lg px-10 py-7 rounded-xl shadow-lg shadow-[hsl(43,74%,49%)]/20 font-bold">
              COMECE AGORA
              <ArrowRight className="ml-2 w-5 h-5" />
            </Button>
          </a>
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
            <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6 text-center hover:border-[hsl(43,74%,49%)]/40 transition-colors">
              <div className="w-14 h-14 bg-[hsl(43,74%,49%)]/10 rounded-xl flex items-center justify-center mx-auto mb-4">
                <Dumbbell className="w-7 h-7 text-[hsl(43,74%,49%)]" />
              </div>
              <h3 className="font-bold text-lg mb-2 text-white">Planilha de treino personalizada</h3>
              <p className="text-gray-400 text-sm">Criada pelo treinador Rogers Feitosa, ajustada aos seus objetivos, nível e rotina.</p>
            </div>
            
            <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6 text-center hover:border-[hsl(43,74%,49%)]/40 transition-colors">
              <div className="w-14 h-14 bg-[hsl(43,74%,49%)]/10 rounded-xl flex items-center justify-center mx-auto mb-4">
                <Apple className="w-7 h-7 text-[hsl(43,74%,49%)]" />
              </div>
              <h3 className="font-bold text-lg mb-2 text-white">Plano alimentar estratégico</h3>
              <p className="text-gray-400 text-sm">Dieta personalizada com estratégias de suplementação pré, intra e pós-treino.</p>
            </div>
            
            <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6 text-center hover:border-[hsl(43,74%,49%)]/40 transition-colors">
              <div className="w-14 h-14 bg-[hsl(43,74%,49%)]/10 rounded-xl flex items-center justify-center mx-auto mb-4">
                <Zap className="w-7 h-7 text-[hsl(43,74%,49%)]" />
              </div>
              <h3 className="font-bold text-lg mb-2 text-white">100% sincronizados</h3>
              <p className="text-gray-400 text-sm">Treino e nutrição conversam entre si. Cada sessão tem o combustível certo pra render.</p>
            </div>
          </div>
        </div>
      </section>

      {/* Para Quem */}
      <section className="py-16 md:py-20 bg-black">
        <div className="container mx-auto px-4">
          <h2 className="text-2xl md:text-3xl lg:text-4xl font-bold text-center mb-4 text-white">
            Pra quem é a RF Assessoria?
          </h2>
          <p className="text-gray-400 text-center mb-12 max-w-xl mx-auto">
            Não precisa ser rápido. Nem experiente. Só precisa querer começar.
          </p>
          
          <div className="grid md:grid-cols-2 gap-6 max-w-4xl mx-auto">
            <div className="flex gap-4 items-start bg-gray-950 p-5 rounded-xl border border-gray-800">
              <div className="flex-shrink-0 w-10 h-10 bg-[hsl(43,74%,49%)] rounded-full flex items-center justify-center">
                <Heart className="w-5 h-5 text-primary-foreground" />
              </div>
              <div>
                <h3 className="font-bold text-white mb-1">Está começando a correr</h3>
                <p className="text-gray-400 text-sm">Corrida é sobre cuidar de você, criar uma rotina e viver algo que transforma. Você não precisa estar pronto — só dar o primeiro passo.</p>
              </div>
            </div>

            <div className="flex gap-4 items-start bg-gray-950 p-5 rounded-xl border border-gray-800">
              <div className="flex-shrink-0 w-10 h-10 bg-[hsl(43,74%,49%)] rounded-full flex items-center justify-center">
                <Target className="w-5 h-5 text-primary-foreground" />
              </div>
              <div>
                <h3 className="font-bold text-white mb-1">Quer perder peso correndo</h3>
                <p className="text-gray-400 text-sm">Treine e emagreça com orientação profissional — sem perder gás, sem dietas malucas.</p>
              </div>
            </div>

            <div className="flex gap-4 items-start bg-gray-950 p-5 rounded-xl border border-gray-800">
              <div className="flex-shrink-0 w-10 h-10 bg-[hsl(43,74%,49%)] rounded-full flex items-center justify-center">
                <Trophy className="w-5 h-5 text-primary-foreground" />
              </div>
              <div>
                <h3 className="font-bold text-white mb-1">Busca performance em provas</h3>
                <p className="text-gray-400 text-sm">Quer bater RP? Completar uma Major? Treinos ajustados para provas com foco em pace, estratégia e constância.</p>
              </div>
            </div>

            <div className="flex gap-4 items-start bg-gray-950 p-5 rounded-xl border border-gray-800">
              <div className="flex-shrink-0 w-10 h-10 bg-[hsl(43,74%,49%)] rounded-full flex items-center justify-center">
                <Users className="w-5 h-5 text-primary-foreground" />
              </div>
              <div>
                <h3 className="font-bold text-white mb-1">Quer acompanhamento completo</h3>
                <p className="text-gray-400 text-sm">Quer nutricionista + treinador no mesmo lugar, com tudo alinhado e acompanhamento real.</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Como Funciona */}
      <section className="py-16 md:py-20 bg-gray-950">
        <div className="container mx-auto px-4">
          <h2 className="text-2xl md:text-3xl lg:text-4xl font-bold text-center mb-3 text-white">
            Simples e funciona.
          </h2>
          <p className="text-[hsl(43,74%,49%)] text-center mb-12 text-lg">Como funciona</p>
          
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6 md:gap-8 max-w-5xl mx-auto">
            {[
              { step: "01", title: "Inscrição", desc: "Garanta sua vaga e preencha o formulário de diagnóstico.", icon: ClipboardCheck },
              { step: "02", title: "Consulta Inicial", desc: "Videochamada para ajustar treino e dieta ao seu perfil.", icon: Video },
              { step: "03", title: "Receba seus planos", desc: "Planilha de treino + plano alimentar sincronizados no app.", icon: Calendar },
              { step: "04", title: "Evolua", desc: "Check-in mensal, ajustes contínuos e suporte direto.", icon: Trophy },
            ].map((item, index) => (
              <div key={index} className="text-center">
                <div className="w-14 h-14 md:w-16 md:h-16 bg-[hsl(43,74%,49%)] text-primary-foreground rounded-2xl flex items-center justify-center text-xl md:text-2xl font-bold mx-auto mb-4 shadow-lg shadow-[hsl(43,74%,49%)]/20">
                  {item.step}
                </div>
                <h3 className="font-bold text-base md:text-lg mb-2 text-white">{item.title}</h3>
                <p className="text-gray-400 text-xs md:text-sm">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* O que inclui */}
      <section className="py-16 md:py-20 bg-black">
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
              { icon: Video, title: "Consulta inicial por videochamada", desc: "Encontro online para conhecer você, alinhar expectativas e ajustar treino e dieta juntos." },
              { icon: Calendar, title: "Check-in mensal", desc: "A cada mês, avaliamos sua evolução, ajustamos treino e dieta conforme necessário." },
              { icon: Zap, title: "Bônus: Zona Nutri", desc: "Sistema inteligente que monta sua suplementação ideal para cada tipo de treino automaticamente." },
              { icon: MessageCircle, title: "Suporte direto no WhatsApp", desc: "Dúvidas sobre treino ou dieta? Fale diretamente com o Rogers pelo WhatsApp." },
            ].map((item, index) => (
              <div key={index} className="flex gap-4 items-start bg-gray-900/50 border border-gray-800 p-5 rounded-xl hover:border-[hsl(43,74%,49%)]/30 transition-colors">
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
      <section id="plano" className="py-16 md:py-24 bg-gradient-to-b from-gray-950 to-black">
        <div className="container mx-auto px-4">
          <h2 className="text-2xl md:text-3xl lg:text-4xl font-bold text-center mb-3 text-white">
            Invista na sua evolução
          </h2>
          <p className="text-gray-400 text-center mb-12">Assessoria completa: treino + nutrição no mesmo lugar.</p>
          
          <div className="max-w-lg mx-auto">
            <div className="relative bg-gradient-to-b from-gray-900 to-gray-950 rounded-3xl border-2 border-[hsl(43,74%,49%)]/50 p-8 md:p-10 shadow-2xl shadow-[hsl(43,74%,49%)]/10">
              {/* Badge */}
              <div className="absolute -top-4 left-1/2 -translate-x-1/2">
                <div className="bg-[hsl(43,74%,49%)] text-primary-foreground text-sm font-bold px-5 py-1.5 rounded-full flex items-center gap-2">
                  <Timer className="w-4 h-4" />
                  Adesão até 30/04/2026
                </div>
              </div>

              <div className="text-center mb-8 pt-4">
                <h3 className="text-xl md:text-2xl font-bold text-white mb-1">RF Assessoria Completa</h3>
                <p className="text-gray-400 text-sm mb-6">Nutrição + Treinamento sincronizados</p>
                
                <div className="flex items-end justify-center gap-1 mb-2">
                  <span className="text-4xl md:text-5xl font-extrabold text-[hsl(43,74%,49%)]">R$157</span>
                  <span className="text-gray-400 text-lg mb-1">/mês</span>
                </div>
                <p className="text-gray-500 text-sm">no 1º ano de acompanhamento</p>
              </div>
              
              <div className="space-y-3 mb-8">
                {[
                  "Planilha de treino 100% personalizada",
                  "Plano alimentar individualizado",
                  "Estratégias de suplementação pré, intra e pós-treino",
                  "Consulta inicial por videochamada",
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
          <img src={logo} alt="RF" className="w-10 h-10 rounded-full mx-auto mb-3 opacity-60" />
          <p>© 2026 Rogers Feitosa — Nutrição e Treinamento. Todos os direitos reservados.</p>
          <Link to="/auth" className="text-gray-500 hover:text-[hsl(43,74%,49%)] underline mt-2 inline-block text-xs">
            Área do Membro
          </Link>
        </div>
      </footer>
    </div>
  );
}
