import logoRF from '@/assets/logo-rf.jpg';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export default function Terms() {
  return (
    <div className="min-h-screen bg-background py-8 px-4">
      <div className="max-w-3xl mx-auto">
        <div className="flex items-center gap-3 mb-8">
          <img src={logoRF} alt="Rogers Feitosa" className="h-12 w-12 rounded-xl object-cover" />
          <div>
            <h1 className="text-xl font-bold text-foreground">Rogers Feitosa</h1>
            <p className="text-sm text-muted-foreground">Nutrição & Treinamento</p>
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-2xl">
              Termos e Condições de Serviço de Consultoria Nutricional
            </CardTitle>
          </CardHeader>
          <CardContent className="prose prose-sm dark:prose-invert max-w-none space-y-6">
            <p className="text-muted-foreground">
              Este documento estabelece os termos e condições para a prestação de serviços de
              consultoria nutricional por <strong>Rogers Leandro Feitosa</strong>, CPF
              031.476.663-44, CRN 14885 PI, doravante denominado <strong>NUTRICIONISTA</strong>,
              ao cliente, doravante denominado <strong>ATLETA</strong>.
            </p>

            <section>
              <h2 className="text-lg font-semibold mb-2">1. Objeto</h2>
              <p>
                1.1. O NUTRICIONISTA prestará serviços de consultoria nutricional ao ATLETA,
                conforme o plano contratado:
              </p>
              <ul className="list-disc pl-6 space-y-1">
                <li>
                  <strong>Plano Consultoria:</strong> dieta personalizada via aplicativo,
                  disponibilidade via WhatsApp para suporte.
                </li>
                <li>
                  <strong>Plano Consultas:</strong> consultas periódicas, dieta personalizada via
                  aplicativo, disponibilidade via WhatsApp para suporte.
                </li>
              </ul>
              <p>1.2. Os serviços serão prestados de forma online, através de plataformas digitais.</p>
            </section>

            <section>
              <h2 className="text-lg font-semibold mb-2">2. Responsabilidades do NUTRICIONISTA</h2>
              <p>2.1. Fornecer orientações nutricionais adequadas com base nas informações prestadas pelo ATLETA.</p>
              <p>2.2. Elaborar planos alimentares personalizados de acordo com os objetivos e necessidades do ATLETA.</p>
              <p>2.3. Prestar suporte via WhatsApp durante a vigência do plano contratado, em horário comercial.</p>
              <p>2.4. Manter sigilo sobre as informações compartilhadas pelo ATLETA.</p>
            </section>

            <section>
              <h2 className="text-lg font-semibold mb-2">3. Responsabilidades do ATLETA</h2>
              <p>3.1. Fornecer informações precisas e completas sobre sua saúde, hábitos alimentares e atividades físicas.</p>
              <p>3.2. Seguir as orientações nutricionais fornecidas pelo NUTRICIONISTA.</p>
              <p>3.3. Comunicar quaisquer mudanças em sua saúde ou rotina que possam afetar o plano nutricional.</p>
              <p>3.4. Declarar que está apto e não possui restrições médicas que impeçam o acompanhamento nutricional.</p>
              <p>3.5. Reconhecer que a orientação nutricional não substitui acompanhamento médico.</p>
            </section>

            <section>
              <h2 className="text-lg font-semibold mb-2">4. Pagamento</h2>
              <p>4.1. Os valores dos planos são:</p>
              <ul className="list-disc pl-6 space-y-1">
                <li><strong>Plano Consultoria:</strong> R$ 497,00 (trimestral) / R$ 797,00 (semestral)</li>
                <li><strong>Plano Consultas:</strong> R$ 997,00 (trimestral) / R$ 1.697,00 (semestral)</li>
              </ul>
              <p>4.2. O pagamento deve ser realizado de forma integral e antecipada via gateway de pagamento.</p>
              <p>4.3. A renovação não é automática, devendo ser acordada entre as partes.</p>
            </section>

            <section>
              <h2 className="text-lg font-semibold mb-2">5. Política de Cancelamento e Reembolso</h2>
              <p>5.1. <strong>Plano Consultoria:</strong> após 7 dias do início da prestação de serviços, não haverá reembolso dos valores pagos.</p>
              <p>5.2. <strong>Plano Consultas:</strong> em caso de cancelamento, será reembolsado o valor proporcional, abatendo-se o valor de 1 consulta integral, o período de disponibilidade do nutricionista e 20% do valor do plano.</p>
              <p>
                5.3. O pedido de cancelamento deve ser formalizado por escrito para o e-mail{' '}
                <a href="mailto:nutri.rogersfeitosa@gmail.com" className="text-primary underline">
                  nutri.rogersfeitosa@gmail.com
                </a>.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-semibold mb-2">6. Confidencialidade e Proteção de Dados</h2>
              <p>6.1. O NUTRICIONISTA se compromete a manter sigilo sobre todas as informações fornecidas pelo ATLETA.</p>
              <p>6.2. Os dados de saúde, como anamnese e exames, são armazenados de forma segura no sistema/plataforma utilizada pelo NUTRICIONISTA.</p>
              <p>6.3. Apenas o NUTRICIONISTA e profissionais diretamente envolvidos no acompanhamento terão acesso aos dados.</p>
              <p>6.4. Os dados serão tratados de acordo com a Lei Geral de Proteção de Dados (LGPD).</p>
            </section>

            <section>
              <h2 className="text-lg font-semibold mb-2">7. Uso de Imagem</h2>
              <p>
                7.1. O ATLETA autoriza o uso de seus resultados, fotos e depoimentos para fins de
                divulgação dos serviços prestados pelo NUTRICIONISTA em redes sociais e materiais
                promocionais.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-semibold mb-2">8. Vigência e Foro</h2>
              <p>8.1. Este termo entra em vigor na data de sua assinatura e tem validade de acordo com o plano contratado (três ou seis meses ou anual).</p>
              <p>8.2. Fica eleito o foro da comarca de Teresina, PI para dirimir quaisquer controvérsias oriundas deste termo.</p>
            </section>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
