import { Button } from "@/components/ui/button";
import { Check, ArrowRight, Gift, Timer, Calendar, MessageCircle, ClipboardCheck, Zap } from "lucide-react";
import { Link } from "react-router-dom";
import runnerHero from "@/assets/runner-hero.jpg";
import runner2 from "@/assets/runner-2.jpg";

const KIWIFY_LINK = "#"; // TODO: Replace with actual Kiwify link

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-black text-white">
      {/* Header */}
      <header className="fixed top-0 left-0 right-0 z-50 bg-black/95 backdrop-blur-sm border-b border-gray-800">
        <div className="container mx-auto px-4 py-3 flex justify-between items-center">
          <span className="font-bold text-lg text-[hsl(43,74%,49%)]">RF Assessoria</span>
          <Link to="/auth">
            <Button size="sm" className="bg-[hsl(43,74%,49%)] hover:bg-[hsl(43,74%,40%)] text-black font-semibold border-0">
              Área do Membro / Entrar
            </Button>
          </Link>
        </div>
      </header>

      {/* Hero Section */}
      <section className="pt-20 pb-16 md:pt-24 md:pb-20 bg-black">
        <div className="container mx-auto px-4">
          <div className="flex flex-col lg:flex-row items-center gap-8 lg:gap-12">
            {/* Content */}
            <div className="flex-1 order-2 lg:order-1">
              <div className="inline-flex items-center gap-2 bg-[hsl(43,74%,49%)] text-black px-4 py-2 rounded-full text-sm font-bold mb-6">
                <Timer className="w-4 h-4" />
                Vagas limitadas na pré-venda por tempo determinado!
              </div>
              
              <h1 className="text-3xl md:text-4xl lg:text-5xl font-bold leading-tight mb-6 text-white">
                Acompanhamento Nutricional de 6 Semanas para Corredores
              </h1>
              
              <h2 className="text-lg md:text-xl text-gray-400 mb-8">
                Alcance seu peso ideal, melhore sua performance e corra mais leve sem perder o gás nos treinos.
              </h2>
              
              <div className="flex flex-col sm:flex-row gap-4 items-start">
                <a href={KIWIFY_LINK} target="_blank" rel="noopener noreferrer">
                  <Button size="lg" className="bg-[hsl(43,74%,49%)] hover:bg-[hsl(43,74%,40%)] text-black text-lg px-8 py-6 rounded-lg shadow-lg font-bold">
                    QUERO CORRER MAIS LEVE!
                    <ArrowRight className="ml-2 w-5 h-5" />
                  </Button>
                </a>
                <div className="text-white">
                  <span className="text-3xl font-bold text-[hsl(43,74%,49%)]">R$ 97,00</span>
                  <span className="block text-sm text-gray-500">Valor Único</span>
                </div>
              </div>
            </div>
            
            {/* Image */}
            <div className="flex-1 order-1 lg:order-2 w-full">
              <img 
                src={runnerHero} 
                alt="Corredor em ação" 
                className="w-full h-64 md:h-80 lg:h-[500px] object-cover rounded-2xl shadow-xl border-2 border-[hsl(43,74%,49%)]/30"
              />
            </div>
          </div>
        </div>
      </section>

      {/* Para Quem É */}
      <section className="py-16 md:py-20 bg-gray-950">
        <div className="container mx-auto px-4">
          <h2 className="text-2xl md:text-3xl lg:text-4xl font-bold text-center mb-10 md:mb-12 text-white">
            Este acompanhamento é para você, corredor(a), que:
          </h2>
          
          <div className="grid md:grid-cols-2 gap-6 md:gap-8 max-w-4xl mx-auto">
            {[
              "Sente que o peso está segurando sua velocidade e performance.",
              "Busca emagrecer, mas tem medo de perder energia nos treinos longos.",
              "Precisa de um plano alimentar que se encaixe perfeitamente na sua rotina de treinos (antes, durante e depois).",
              "Já tentou dietas genéricas que não funcionaram para a demanda de um corredor.",
              "Quer um suporte direto e especializado para tirar dúvidas e fazer ajustes."
            ].map((item, index) => (
              <div key={index} className="flex gap-4 items-start bg-gray-900 p-5 md:p-6 rounded-xl border border-gray-800">
                <div className="flex-shrink-0 w-8 h-8 bg-[hsl(43,74%,49%)] rounded-full flex items-center justify-center">
                  <Check className="w-5 h-5 text-black" />
                </div>
                <p className="text-gray-300 text-base md:text-lg">{item}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* O Que Você Vai Ter Acesso */}
      <section className="py-16 md:py-20 bg-black">
        <div className="container mx-auto px-4">
          <h2 className="text-2xl md:text-3xl lg:text-4xl font-bold text-center mb-3 md:mb-4 text-white">
            Sua transformação em 6 semanas
          </h2>
          <p className="text-lg md:text-xl text-[hsl(43,74%,49%)] text-center mb-10 md:mb-12">O que está incluso</p>
          
          <div className="grid md:grid-cols-2 gap-8 max-w-5xl mx-auto">
            <div className="relative">
              <img 
                src={runner2} 
                alt="Corredor treinando" 
                className="w-full h-64 md:h-80 object-cover rounded-2xl shadow-lg border-2 border-[hsl(43,74%,49%)]/30"
              />
            </div>
            
            <div className="space-y-5 md:space-y-6">
              <div className="flex gap-4 items-start">
                <div className="flex-shrink-0 w-10 h-10 md:w-12 md:h-12 bg-[hsl(43,74%,49%)] rounded-xl flex items-center justify-center">
                  <ClipboardCheck className="w-5 h-5 md:w-6 md:h-6 text-black" />
                </div>
                <div>
                  <h3 className="font-bold text-base md:text-lg text-white">Plano alimentar 100% personalizado</h3>
                  <p className="text-gray-400 text-sm md:text-base">Um plano desenhado exclusivamente para você, considerando seu gasto calórico, rotina de treinos e objetivos de emagrecimento.</p>
                </div>
              </div>
              
              <div className="flex gap-4 items-start">
                <div className="flex-shrink-0 w-10 h-10 md:w-12 md:h-12 bg-[hsl(43,74%,49%)] rounded-xl flex items-center justify-center">
                  <Timer className="w-5 h-5 md:w-6 md:h-6 text-black" />
                </div>
                <div>
                  <h3 className="font-bold text-base md:text-lg text-white">Entrega rápida</h3>
                  <p className="text-gray-400 text-sm md:text-base">Seu plano é entregue em até 48 horas úteis após o preenchimento do formulário de diagnóstico.</p>
                </div>
              </div>
              
              <div className="flex gap-4 items-start">
                <div className="flex-shrink-0 w-10 h-10 md:w-12 md:h-12 bg-[hsl(43,74%,49%)] rounded-xl flex items-center justify-center">
                  <Calendar className="w-5 h-5 md:w-6 md:h-6 text-black" />
                </div>
                <div>
                  <h3 className="font-bold text-base md:text-lg text-white">Check-up de progresso com 3 semanas</h3>
                  <p className="text-gray-400 text-sm md:text-base">Com 3 semanas, você preenche um check-up para avaliarmos peso, medidas e suas sensações. É o momento de solicitar ajustes.</p>
                </div>
              </div>
              
              <div className="flex gap-4 items-start">
                <div className="flex-shrink-0 w-10 h-10 md:w-12 md:h-12 bg-[hsl(43,74%,49%)] rounded-xl flex items-center justify-center">
                  <MessageCircle className="w-5 h-5 md:w-6 md:h-6 text-black" />
                </div>
                <div>
                  <h3 className="font-bold text-base md:text-lg text-white">Suporte exclusivo no app</h3>
                  <p className="text-gray-400 text-sm md:text-base">Tire todas as suas dúvidas diretamente com o especialista pelo chat dentro do próprio aplicativo.</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Como Funciona */}
      <section className="py-16 md:py-20 bg-gray-950">
        <div className="container mx-auto px-4">
          <h2 className="text-2xl md:text-3xl lg:text-4xl font-bold text-center mb-3 md:mb-4 text-white">
            O caminho simples para o seu emagrecimento
          </h2>
          <p className="text-lg md:text-xl text-[hsl(43,74%,49%)] text-center mb-10 md:mb-12">Como funciona</p>
          
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6 md:gap-8 max-w-5xl mx-auto">
            {[
              { step: "1", title: "Inscrição", desc: "Clique no botão e garanta sua vaga por apenas R$ 97,00." },
              { step: "2", title: "Diagnóstico", desc: "Preencha o formulário de diagnóstico detalhado sobre sua rotina e treinos." },
              { step: "3", title: "Recebimento", desc: "Em até 48h úteis, seu plano alimentar personalizado estará disponível no app." },
              { step: "4", title: "Acompanhamento", desc: "Com 3 semanas, faça seu check-up e receba os ajustes necessários." },
            ].map((item, index) => (
              <div key={index} className="text-center">
                <div className="w-12 h-12 md:w-16 md:h-16 bg-[hsl(43,74%,49%)] text-black rounded-full flex items-center justify-center text-xl md:text-2xl font-bold mx-auto mb-3 md:mb-4">
                  {item.step}
                </div>
                <h3 className="font-bold text-base md:text-lg mb-2 text-white">{item.title}</h3>
                <p className="text-gray-400 text-xs md:text-sm">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Bônus */}
      <section className="py-16 md:py-20 bg-black">
        <div className="container mx-auto px-4">
          <div className="flex items-center justify-center gap-3 mb-10 md:mb-12">
            <Gift className="w-6 h-6 md:w-8 md:h-8 text-[hsl(43,74%,49%)]" />
            <h2 className="text-2xl md:text-3xl lg:text-4xl font-bold text-white">
              Bônus exclusivos
            </h2>
          </div>
          
          <div className="grid md:grid-cols-2 gap-6 md:gap-8 max-w-4xl mx-auto">
            <div className="bg-gradient-to-br from-gray-900 to-gray-950 p-6 md:p-8 rounded-2xl border-2 border-[hsl(43,74%,49%)]/50">
              <div className="inline-flex items-center gap-2 bg-[hsl(43,74%,49%)] text-black text-sm font-bold px-3 py-1 rounded-full mb-4">
                <Zap className="w-4 h-4" />
                BÔNUS 1
              </div>
              <h3 className="text-lg md:text-xl font-bold text-white mb-3">Acesso à "Zona Nutri"</h3>
              <p className="text-gray-400 text-sm md:text-base">
                Um sistema inteligente que gerencia automaticamente sua suplementação de pré, intra e pós-treino. Ele entrega a sequência e os tipos de suplementos ideais para cada tipo de treino (longão, tiro, regenerativo), garantindo que você nunca mais erre na hora de abastecer seu corpo!
              </p>
            </div>
            
            <div className="bg-gradient-to-br from-gray-900 to-gray-950 p-6 md:p-8 rounded-2xl border-2 border-[hsl(43,74%,49%)]/50">
              <div className="inline-flex items-center gap-2 bg-[hsl(43,74%,49%)] text-black text-sm font-bold px-3 py-1 rounded-full mb-4">
                <Check className="w-4 h-4" />
                BÔNUS 2
              </div>
              <h3 className="text-lg md:text-xl font-bold text-white mb-3">Atividades comportamentais semanais</h3>
              <p className="text-gray-400 text-sm md:text-base">
                Receba um desafio prático por semana para ajudá-lo a construir hábitos e melhorar a adesão à dieta. Você precisa dar check diário no sistema para acompanhar sua evolução e garantir que o emagrecimento seja duradouro.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Final */}
      <section className="py-16 md:py-20 bg-gradient-to-b from-gray-950 to-black">
        <div className="container mx-auto px-4 text-center">
          <h2 className="text-2xl md:text-3xl lg:text-4xl font-bold mb-6 text-white">
            Pare de adiar sua melhor performance. Comece hoje!
          </h2>
          
          <div className="max-w-md mx-auto">
            <a href={KIWIFY_LINK} target="_blank" rel="noopener noreferrer">
              <Button size="lg" className="w-full bg-[hsl(43,74%,49%)] hover:bg-[hsl(43,74%,40%)] text-black text-base md:text-lg py-6 rounded-lg shadow-lg mb-4 font-bold">
                GARANTA SUA VAGA POR APENAS R$ 97,00!
                <ArrowRight className="ml-2 w-5 h-5" />
              </Button>
            </a>
            <p className="text-gray-500 text-sm">Pagamento único e seguro via Kiwify</p>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-8 bg-black border-t border-gray-800 text-gray-500 text-center text-sm">
        <div className="container mx-auto px-4">
          <p>© 2026 RF Assessoria. Todos os direitos reservados.</p>
          <Link to="/auth" className="text-white hover:text-[hsl(43,74%,49%)] underline mt-2 inline-block">
            Área do Membro / Entrar
          </Link>
        </div>
      </footer>
    </div>
  );
}