import { Button } from "@/components/ui/button";
import { Check, ArrowRight, Gift, Timer, Calendar, MessageCircle, ClipboardCheck } from "lucide-react";
import { Link } from "react-router-dom";
import runnerHero from "@/assets/runner-hero.jpg";
import runner2 from "@/assets/runner-2.jpg";
import runner3 from "@/assets/runner-3.jpg";
import runner4 from "@/assets/runner-4.jpg";

const KIWIFY_LINK = "#"; // TODO: Replace with actual Kiwify link

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-white text-gray-900">
      {/* Header */}
      <header className="fixed top-0 left-0 right-0 z-50 bg-white/95 backdrop-blur-sm border-b border-gray-100">
        <div className="container mx-auto px-4 py-3 flex justify-between items-center">
          <span className="font-bold text-lg text-gray-900">RF Assessoria</span>
          <Link to="/auth">
            <Button variant="outline" size="sm" className="text-gray-700 border-gray-300 hover:bg-gray-50">
              Área do Membro / Entrar
            </Button>
          </Link>
        </div>
      </header>

      {/* Hero Section */}
      <section className="relative min-h-screen flex items-center pt-16">
        <div className="absolute inset-0 z-0">
          <img 
            src={runnerHero} 
            alt="Corredor em ação" 
            className="w-full h-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-r from-black/80 via-black/60 to-transparent" />
        </div>
        
        <div className="container mx-auto px-4 relative z-10">
          <div className="max-w-2xl text-white">
            <div className="inline-flex items-center gap-2 bg-red-600 text-white px-4 py-2 rounded-full text-sm font-medium mb-6">
              <Timer className="w-4 h-4" />
              Vagas limitadas na pré-venda por tempo determinado!
            </div>
            
            <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold leading-tight mb-6">
              Emagreça Correndo: Acompanhamento Nutricional de 6 Semanas para Corredores
            </h1>
            
            <h2 className="text-xl md:text-2xl text-gray-200 mb-8">
              Alcance seu peso ideal, melhore sua performance e corra mais leve sem perder o gás nos treinos.
            </h2>
            
            <div className="flex flex-col sm:flex-row gap-4 items-start">
              <a href={KIWIFY_LINK} target="_blank" rel="noopener noreferrer">
                <Button size="lg" className="bg-green-600 hover:bg-green-700 text-white text-lg px-8 py-6 rounded-lg shadow-lg">
                  QUERO CORRER MAIS LEVE!
                  <ArrowRight className="ml-2 w-5 h-5" />
                </Button>
              </a>
              <div className="text-white">
                <span className="text-3xl font-bold">R$ 97,00</span>
                <span className="block text-sm text-gray-300">Valor Único</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Para Quem É */}
      <section className="py-20 bg-gray-50">
        <div className="container mx-auto px-4">
          <h2 className="text-3xl md:text-4xl font-bold text-center mb-12 text-gray-900">
            Este Acompanhamento é Para Você, Corredor(a), Que:
          </h2>
          
          <div className="grid md:grid-cols-2 gap-8 max-w-4xl mx-auto">
            {[
              "Sente que o peso está segurando sua velocidade e performance.",
              "Busca emagrecer, mas tem medo de perder energia nos treinos longos.",
              "Precisa de um plano alimentar que se encaixe perfeitamente na sua rotina de treinos (antes, durante e depois).",
              "Já tentou dietas genéricas que não funcionaram para a demanda de um corredor.",
              "Quer um suporte direto e especializado para tirar dúvidas e fazer ajustes."
            ].map((item, index) => (
              <div key={index} className="flex gap-4 items-start bg-white p-6 rounded-xl shadow-sm">
                <div className="flex-shrink-0 w-8 h-8 bg-green-100 rounded-full flex items-center justify-center">
                  <Check className="w-5 h-5 text-green-600" />
                </div>
                <p className="text-gray-700 text-lg">{item}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* O Que Você Vai Ter Acesso */}
      <section className="py-20 bg-white">
        <div className="container mx-auto px-4">
          <h2 className="text-3xl md:text-4xl font-bold text-center mb-4 text-gray-900">
            Sua Transformação em 6 Semanas
          </h2>
          <p className="text-xl text-gray-600 text-center mb-12">O Que Está Incluso</p>
          
          <div className="grid md:grid-cols-2 gap-8 max-w-5xl mx-auto">
            <div className="relative">
              <img 
                src={runner2} 
                alt="Corredor treinando" 
                className="w-full h-80 object-cover rounded-2xl shadow-lg"
              />
            </div>
            
            <div className="space-y-6">
              <div className="flex gap-4 items-start">
                <div className="flex-shrink-0 w-12 h-12 bg-gray-900 rounded-xl flex items-center justify-center">
                  <ClipboardCheck className="w-6 h-6 text-white" />
                </div>
                <div>
                  <h3 className="font-bold text-lg text-gray-900">Plano Alimentar 100% Personalizado</h3>
                  <p className="text-gray-600">Um plano desenhado exclusivamente para você, considerando seu gasto calórico, rotina de treinos e objetivos de emagrecimento.</p>
                </div>
              </div>
              
              <div className="flex gap-4 items-start">
                <div className="flex-shrink-0 w-12 h-12 bg-gray-900 rounded-xl flex items-center justify-center">
                  <Timer className="w-6 h-6 text-white" />
                </div>
                <div>
                  <h3 className="font-bold text-lg text-gray-900">Entrega Rápida</h3>
                  <p className="text-gray-600">Seu plano é entregue em até 48 horas úteis após o preenchimento do seu formulário de diagnóstico.</p>
                </div>
              </div>
              
              <div className="flex gap-4 items-start">
                <div className="flex-shrink-0 w-12 h-12 bg-gray-900 rounded-xl flex items-center justify-center">
                  <Calendar className="w-6 h-6 text-white" />
                </div>
                <div>
                  <h3 className="font-bold text-lg text-gray-900">Check-up Quinzenal de Progresso</h3>
                  <p className="text-gray-600">A cada 15 dias, você preenche um check-up para avaliarmos peso, medidas e suas sensações. É o momento de solicitar ajustes.</p>
                </div>
              </div>
              
              <div className="flex gap-4 items-start">
                <div className="flex-shrink-0 w-12 h-12 bg-gray-900 rounded-xl flex items-center justify-center">
                  <MessageCircle className="w-6 h-6 text-white" />
                </div>
                <div>
                  <h3 className="font-bold text-lg text-gray-900">Suporte Exclusivo no App</h3>
                  <p className="text-gray-600">Tire todas as suas dúvidas diretamente com o especialista através do chat dentro do próprio aplicativo.</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Como Funciona */}
      <section className="py-20 bg-gray-900 text-white">
        <div className="container mx-auto px-4">
          <h2 className="text-3xl md:text-4xl font-bold text-center mb-4">
            O Caminho Simples para o Seu Emagrecimento de Corredor
          </h2>
          <p className="text-xl text-gray-400 text-center mb-12">Como Funciona</p>
          
          <div className="grid md:grid-cols-4 gap-8 max-w-5xl mx-auto">
            {[
              { step: "1", title: "Inscrição", desc: "Clique no botão e garanta sua vaga por apenas R$ 97,00." },
              { step: "2", title: "Diagnóstico", desc: "Preencha o Formulário de Diagnóstico detalhado sobre sua rotina e treinos." },
              { step: "3", title: "Recebimento", desc: "Em até 48h úteis, seu Plano Alimentar Personalizado estará disponível no seu App." },
              { step: "4", title: "Acompanhamento", desc: "A cada 15 dias, faça seu check-up e receba os ajustes necessários." },
            ].map((item, index) => (
              <div key={index} className="text-center">
                <div className="w-16 h-16 bg-white text-gray-900 rounded-full flex items-center justify-center text-2xl font-bold mx-auto mb-4">
                  {item.step}
                </div>
                <h3 className="font-bold text-lg mb-2">{item.title}</h3>
                <p className="text-gray-400 text-sm">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Bônus */}
      <section className="py-20 bg-white">
        <div className="container mx-auto px-4">
          <div className="flex items-center justify-center gap-3 mb-4">
            <Gift className="w-8 h-8 text-yellow-500" />
            <h2 className="text-3xl md:text-4xl font-bold text-gray-900">
              Bônus Exclusivos
            </h2>
          </div>
          <p className="text-xl text-gray-600 text-center mb-12">Que Vão Turbinar Seus Resultados (Valor Inestimável)</p>
          
          <div className="grid md:grid-cols-2 gap-8 max-w-4xl mx-auto">
            <div className="bg-gradient-to-br from-gray-50 to-gray-100 p-8 rounded-2xl border-2 border-gray-200">
              <div className="inline-block bg-yellow-500 text-white text-sm font-bold px-3 py-1 rounded-full mb-4">
                BÔNUS 1
              </div>
              <h3 className="text-xl font-bold text-gray-900 mb-3">Acesso à "Zona Nutri"</h3>
              <p className="text-gray-600">
                Um guia prático para você gerenciar sua nutrição de pré, intra e pós-treino de acordo com o tipo de corrida (longão, tiro, regenerativo). Nunca mais erre na hora de abastecer seu corpo!
              </p>
            </div>
            
            <div className="bg-gradient-to-br from-gray-50 to-gray-100 p-8 rounded-2xl border-2 border-gray-200">
              <div className="inline-block bg-yellow-500 text-white text-sm font-bold px-3 py-1 rounded-full mb-4">
                BÔNUS 2
              </div>
              <h3 className="text-xl font-bold text-gray-900 mb-3">Atividades Comportamentais Semanais</h3>
              <p className="text-gray-600">
                Receba um desafio prático por semana para te ajudar a construir hábitos, melhorar a adesão à dieta e garantir que o emagrecimento seja duradouro.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Gallery */}
      <section className="py-12 bg-gray-50">
        <div className="container mx-auto px-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <img src={runnerHero} alt="Corredor" className="w-full h-48 object-cover rounded-lg" />
            <img src={runner2} alt="Corredor" className="w-full h-48 object-cover rounded-lg" />
            <img src={runner3} alt="Corredor" className="w-full h-48 object-cover rounded-lg" />
            <img src={runner4} alt="Corredor" className="w-full h-48 object-cover rounded-lg" />
          </div>
        </div>
      </section>

      {/* CTA Final */}
      <section className="py-20 bg-gray-900 text-white">
        <div className="container mx-auto px-4 text-center">
          <h2 className="text-3xl md:text-4xl font-bold mb-6">
            Pare de adiar sua melhor performance. Comece hoje!
          </h2>
          
          <div className="max-w-md mx-auto">
            <a href={KIWIFY_LINK} target="_blank" rel="noopener noreferrer">
              <Button size="lg" className="w-full bg-green-600 hover:bg-green-700 text-white text-lg py-6 rounded-lg shadow-lg mb-4">
                GARANTA SUA VAGA POR APENAS R$ 97,00!
                <ArrowRight className="ml-2 w-5 h-5" />
              </Button>
            </a>
            <p className="text-gray-400 text-sm">Pagamento único e seguro via Kiwify</p>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-8 bg-black text-gray-400 text-center text-sm">
        <div className="container mx-auto px-4">
          <p>© 2026 RF Assessoria. Todos os direitos reservados.</p>
          <Link to="/auth" className="text-gray-500 hover:text-white underline mt-2 inline-block">
            Área do Membro / Entrar
          </Link>
        </div>
      </footer>
    </div>
  );
}
