import { Zap, CheckCircle, MessageCircle } from 'lucide-react';
import zonaNutriTimeline from '@/assets/zona-nutri-timeline.jpeg';
import zonaNutriMetas from '@/assets/zona-nutri-metas.jpeg';

export default function ZonaNutriSection() {
  return (
    <section className="py-20 md:py-28 bg-black">
      <div className="max-w-7xl mx-auto px-4">
        {/* Header */}
        <div className="text-center mb-16">
          <span className="inline-flex items-center gap-2 px-4 py-2 bg-amber-500/10 border border-amber-500/20 rounded-full text-amber-400 text-sm font-medium mb-6">
            <Zap className="h-4 w-4" />
            Incluso em todos os planos
          </span>
          <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">
            Zona Nutri
          </h2>
          <p className="text-gray-400 text-lg max-w-3xl mx-auto">
            O sistema onde você monta sua estratégia nutricional para <strong className="text-white">todo treino longo</strong>, com orientação se as quantidades estão de acordo com as principais referências científicas.
          </p>
        </div>

        {/* Content Grid */}
        <div className="grid md:grid-cols-2 gap-8 lg:gap-12 items-start">
          {/* Timeline Screenshot */}
          <div className="space-y-6">
            <div className="bg-zinc-900/60 rounded-2xl border border-zinc-800 p-3 overflow-hidden">
              <img
                src={zonaNutriTimeline}
                alt="Zona Nutri - Sequência de treino com pré, intra e pós-treino"
                className="w-full rounded-xl"
                loading="lazy"
              />
            </div>
            <div className="px-2">
              <h3 className="text-xl font-bold text-white mb-2">
                Monte sua sequência de treino
              </h3>
              <p className="text-gray-400 text-sm leading-relaxed">
                Gere a estratégia nutricional completa do seu treino longo: pré-treino, intra-treino (géis, isotônicos, cafeína) e pós-treino, tudo organizado numa linha do tempo visual.
              </p>
            </div>
          </div>

          {/* Metas Screenshot */}
          <div className="space-y-6">
            <div className="bg-zinc-900/60 rounded-2xl border border-zinc-800 p-3 overflow-hidden">
              <img
                src={zonaNutriMetas}
                alt="Zona Nutri - Resumo de metas com validação científica"
                className="w-full rounded-xl"
                loading="lazy"
              />
            </div>
            <div className="px-2">
              <h3 className="text-xl font-bold text-white mb-2">
                Validação com referências científicas
              </h3>
              <p className="text-gray-400 text-sm leading-relaxed">
                Saiba se as quantidades de carboidrato, sódio e cafeína estão de acordo com as recomendações ideais para aquele treino. O sistema mostra o que está OK e o que precisa de ajuste.
              </p>
            </div>
          </div>
        </div>

        {/* Features */}
        <div className="mt-16 grid sm:grid-cols-3 gap-6 max-w-4xl mx-auto">
          <div className="flex items-start gap-3 text-gray-400">
            <CheckCircle className="h-5 w-5 text-emerald-400 mt-0.5 flex-shrink-0" />
            <span className="text-sm">Estratégia personalizada pra cada treino longo</span>
          </div>
          <div className="flex items-start gap-3 text-gray-400">
            <CheckCircle className="h-5 w-5 text-emerald-400 mt-0.5 flex-shrink-0" />
            <span className="text-sm">Quantidades validadas por referências científicas</span>
          </div>
          <div className="flex items-start gap-3 text-gray-400">
            <MessageCircle className="h-5 w-5 text-emerald-400 mt-0.5 flex-shrink-0" />
            <span className="text-sm">Suporte direto com o Nutri pra tirar dúvidas</span>
          </div>
        </div>
      </div>
    </section>
  );
}
