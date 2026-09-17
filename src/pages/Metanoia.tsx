import { useEffect } from 'react';
import {
  METANOIA_CONSULTAS_NAS_SEMANAS,
  METANOIA_SEMANAS,
  linkDoWhatsAppMetanoia,
} from '@/lib/metanoia';
import '@/styles/metanoia.css';

const FONTES_ID = 'metanoia-fontes';
const FONTES_HREF =
  'https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600&family=Manrope:wght@400;500;600&display=swap';

/** O símbolo da marca: o arco que vira seta, e o ponto no centro. */
function Simbolo({ className, animado = false }: { className?: string; animado?: boolean }) {
  return (
    <svg viewBox="0 0 200 200" className={className} aria-hidden="true" focusable="false">
      <defs>
        <linearGradient id="mt-gradiente" x1="0" y1="1" x2="1" y2="0">
          <stop offset="0" stopColor="#F0692A" />
          <stop offset="1" stopColor="#F7A65A" />
        </linearGradient>
      </defs>
      <path
        className={animado ? 'mt-arc' : undefined}
        pathLength={100}
        d="M116.5 160.4 A60 60 0 1 1 129.5 54.3 L160.3 39.9"
        fill="none"
        stroke="url(#mt-gradiente)"
        strokeWidth="22"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        className={animado ? 'mt-arrow' : undefined}
        d="M175.7 32.7 L166.2 52.6 L154.4 27.2 Z"
        fill="url(#mt-gradiente)"
        stroke="url(#mt-gradiente)"
        strokeWidth="9"
        strokeLinejoin="round"
      />
      <circle cx="96" cy="104" r="13" fill="url(#mt-gradiente)" />
    </svg>
  );
}

function Seta() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M5 12h14M13 6l6 6-6 6" />
    </svg>
  );
}

function BotaoComecar({ className = '' }: { className?: string }) {
  return (
    <a className={`mt-btn ${className}`.trim()} href={linkDoWhatsAppMetanoia()} target="_blank" rel="noopener noreferrer">
      Quero começar
      <Seta />
    </a>
  );
}

const SEMANAS = Array.from({ length: METANOIA_SEMANAS }, (_, i) => i + 1);
const CONSULTAS = new Set<number>(METANOIA_CONSULTAS_NAS_SEMANAS);

/** "Semanas 1, 5 e 9" — escrito a partir da mesma lista que pinta a régua. */
const SEMANAS_DE_CONSULTA = METANOIA_CONSULTAS_NAS_SEMANAS
  .slice(0, -1)
  .join(', ')
  .concat(` e ${METANOIA_CONSULTAS_NAS_SEMANAS[METANOIA_CONSULTAS_NAS_SEMANAS.length - 1]}`);

/** A semana do programa, do domingo à consulta. */
const DIAS = [
  {
    titulo: 'Domingo',
    selo: 'Pausa da Semana',
    texto: 'Você responde, em uns 10 minutos, perguntas abertas sobre como foi comer, treinar e sentir.',
  },
  {
    titulo: 'Segunda',
    selo: 'Devolutiva e prática',
    texto: 'Eu leio a sua Pausa e mando a devolutiva com a prática da semana, escolhida a partir do que você respondeu.',
  },
  {
    titulo: 'Terça a sábado',
    selo: 'Aplicar e conversar',
    texto: 'Você aplica a prática no seu dia a dia e fala comigo no WhatsApp quando precisar.',
  },
  {
    titulo: `Semanas ${SEMANAS_DE_CONSULTA}`,
    selo: 'Consulta individual',
    texto: 'Encontro por vídeo. Plano alimentar, o que apareceu nas Pausas e ajustes.',
  },
];

const RECEBE = [
  { item: 'Avaliação inicial', detalhe: 'Antes da primeira consulta.' },
  { item: 'Plano alimentar ajustado ao treino', detalhe: 'Revisado a cada consulta.' },
  { item: `${METANOIA_CONSULTAS_NAS_SEMANAS.length} consultas individuais por vídeo`, detalhe: `Semanas ${SEMANAS_DE_CONSULTA}.` },
  { item: `${METANOIA_SEMANAS} Pausas da Semana com a minha devolutiva`, detalhe: null },
  { item: `${METANOIA_SEMANAS} práticas comportamentais`, detalhe: 'Uma por semana.' },
  { item: 'WhatsApp direto comigo', detalhe: `Durante as ${METANOIA_SEMANAS} semanas.` },
];

const DORES = [
  'treina com disciplina e come no automático.',
  'segue o plano até a primeira semana difícil.',
  'compensa depois do treino longo e se culpa em seguida.',
  'já fez todas as dietas. Todas funcionaram por três semanas.',
];

const PERGUNTAS = [
  {
    pergunta: 'Eu já sei o que comer. Preciso mesmo de acompanhamento?',
    resposta: 'Saber o que comer nunca foi o problema. O Metanóia trabalha o que acontece entre a vontade e o garfo, que é onde o plano se perde.',
  },
  {
    pergunta: 'Isso não é coisa de psicólogo?',
    resposta: 'Comer é comportamento, e comportamento alimentar faz parte do trabalho do nutricionista. Quem sente que precisa de psicólogo procura um em paralelo e continua no programa. Um acompanhamento soma ao outro.',
  },
  {
    pergunta: 'Não tenho tempo pra responder toda semana.',
    resposta: 'A Pausa da Semana leva uns dez minutos no domingo. É o menor esforço que você já fez pela sua relação com a comida.',
  },
];

const PASSOS = [
  { titulo: 'Chame no WhatsApp', texto: 'Você tira suas dúvidas direto comigo.' },
  { titulo: 'Confirme sua vaga', texto: 'Com a vaga confirmada, você recebe o link da avaliação inicial.' },
  { titulo: 'Agende a primeira consulta', texto: `A partir daí, caminhamos juntos por ${METANOIA_SEMANAS} semanas.` },
];

export default function Metanoia() {
  useEffect(() => {
    const tituloAnterior = document.title;
    document.title = 'Metanóia';
    if (!document.getElementById(FONTES_ID)) {
      const link = document.createElement('link');
      link.id = FONTES_ID;
      link.rel = 'stylesheet';
      link.href = FONTES_HREF;
      document.head.appendChild(link);
    }
    return () => {
      document.title = tituloAnterior;
    };
  }, []);

  return (
    <div className="mt-page">
      <header className="mt-top mt-wrap">
        <a className="mt-brand" href="/metanoia" aria-label="Metanóia, comportamento alimentar">
          <Simbolo />
          <span className="mt-wordmark">
            metanóia<small>comportamento alimentar</small>
          </span>
        </a>
        <a className="mt-top-link" href={linkDoWhatsAppMetanoia()} target="_blank" rel="noopener noreferrer">
          Quero começar
        </a>
      </header>

      <main>
        <section className="mt-hero mt-wrap">
          <div className="mt-hero-text">
            <p className="mt-eyebrow">Programa de {METANOIA_SEMANAS} semanas para corredores</p>
            <h1 className="mt-h1">Você sabe o que comer. O difícil é sustentar.</h1>
            <p className="mt-lead">
              Acompanhamento de {METANOIA_SEMANAS} semanas, nutricional e comportamental:{' '}
              <strong>
                plano alimentar ajustado ao treino, {METANOIA_CONSULTAS_NAS_SEMANAS.length} consultas, um check-in e uma prática por semana
              </strong>
              , e eu no WhatsApp.
            </p>
            <div className="mt-cta-row">
              <BotaoComecar />
              <span className="mt-micro">Você fala direto comigo no WhatsApp.</span>
            </div>
          </div>
          <div className="mt-hero-mark">
            <Simbolo animado />
          </div>
        </section>

        <section className="mt-pains mt-wrap mt-rule" aria-label="Para quem é o programa">
          <div className="mt-pains-grid">
            <h2 className="mt-h2">Você</h2>
            <ul>
              {DORES.map((dor) => <li key={dor}>{dor}</li>)}
            </ul>
          </div>
          <p className="mt-big">O Metanóia trabalha o que a planilha não alcança: a sua relação com a comida.</p>
        </section>

        <section className="mt-weekin mt-wrap mt-rule" id="como-funciona">
          <h2 className="mt-h2">Uma semana no Metanóia</h2>
          <p className="mt-intro">É assim que o acompanhamento acontece, na prática.</p>
          <ol className="mt-days">
            {DIAS.map((dia) => (
              <li key={dia.titulo}>
                <h3 className="mt-h3">{dia.titulo}<small>{dia.selo}</small></h3>
                <p>{dia.texto}</p>
              </li>
            ))}
          </ol>
          <div className="mt-sample">
            <div>
              <p className="mt-label">Duas perguntas da Pausa da Semana</p>
              <blockquote>Em que momento da semana comer foi mais difícil? O que estava acontecendo?</blockquote>
              <blockquote>Depois do treino longo, o que você comeu e como se sentiu em seguida?</blockquote>
            </div>
            <div>
              <p className="mt-label">Uma prática, por exemplo</p>
              <blockquote>Antes de cada refeição, dar uma nota de 0 a 10 para a fome. Só perceber, sem mudar nada.</blockquote>
              <p className="mt-note">A prática muda toda semana, conforme o que aparece na sua Pausa. Nada de cronograma fixo.</p>
            </div>
          </div>
        </section>

        <section className="mt-receive mt-wrap mt-rule" id="o-que-recebe">
          <div className="mt-receive-grid">
            <h2 className="mt-h2">O que você recebe</h2>
            <ul>
              {RECEBE.map((linha) => (
                <li key={linha.item}>
                  <div>
                    <strong>{linha.item}</strong>
                    {linha.detalhe && <span>{linha.detalhe}</span>}
                  </div>
                </li>
              ))}
            </ul>
          </div>
          <div className="mt-weeks-wrap" aria-label={`As ${METANOIA_SEMANAS} semanas`}>
            <p className="mt-weeks-title">As {METANOIA_SEMANAS} semanas</p>
            <ol className="mt-weeks">
              {SEMANAS.map((semana) => (
                <li key={semana} className={CONSULTAS.has(semana) ? 'mt-week mt-consulta' : 'mt-week'}>
                  <em>{CONSULTAS.has(semana) ? 'consulta' : ''}</em>
                  <i />
                  {semana}
                </li>
              ))}
            </ol>
            <ul className="mt-legend">
              <li><i className="mt-c" />Consulta individual</li>
              <li><i />Pausa da Semana e prática comportamental</li>
            </ul>
          </div>
        </section>

        <section className="mt-why mt-wrap mt-rule" id="por-que">
          <h2 className="mt-h2">Por que funciona</h2>
          <div className="mt-why-grid">
            <p className="mt-big">Comer fora do plano quase nunca é falta de informação, de disciplina ou de força de vontade.</p>
            <div>
              <p>É gatilho, hábito e estado emocional. Repetido, esse ciclo vira um caminho no cérebro, e é por isso que a força de vontade cansa.</p>
              <p>Com percepção e repetição, o cérebro aprende respostas novas. É isso que você treina por {METANOIA_SEMANAS} semanas.</p>
            </div>
          </div>
        </section>

        <section className="mt-band" aria-label="O significado de metanóia">
          <div className="mt-watermark"><Simbolo /></div>
          <div className="mt-wrap">
            <p className="mt-word">metanóia</p>
            <p className="mt-meaning">do grego, mudança de mente.</p>
            <p className="mt-band-sub">A relação com a comida muda de dentro para fora.</p>
          </div>
        </section>

        <section className="mt-faq mt-wrap" id="duvidas">
          <h2 className="mt-h2">O que costumam me perguntar</h2>
          <div className="mt-faq-list">
            {PERGUNTAS.map((item) => (
              <details key={item.pergunta}>
                <summary>{item.pergunta}</summary>
                <p>{item.resposta}</p>
              </details>
            ))}
          </div>
        </section>

        <section className="mt-steps mt-wrap" id="como-comeca">
          <h2 className="mt-h2">Como começa</h2>
          <ol>
            {PASSOS.map((passo) => (
              <li key={passo.titulo}>
                <h3 className="mt-h3">{passo.titulo}</h3>
                <p>{passo.texto}</p>
              </li>
            ))}
          </ol>
        </section>

        <section className="mt-invest mt-wrap" id="comecar">
          <div className="mt-invest-inner">
            <div>
              <p className="mt-label">Próximo passo</p>
              <p className="mt-big">Chame no WhatsApp. A primeira conversa é sem compromisso.</p>
            </div>
            <div>
              <BotaoComecar />
            </div>
          </div>
        </section>
      </main>

      <footer className="mt-footer">
        <div className="mt-wrap">
          <a className="mt-brand" href="/metanoia" aria-label="Metanóia">
            <Simbolo />
            <span className="mt-wordmark">
              metanóia<small>comportamento alimentar</small>
            </span>
          </a>
          <span className="mt-sig">Rogers Feitosa <small>· Nutricionista esportivo · CRN 14885</small></span>
          <span>© {new Date().getFullYear()} Metanóia</span>
        </div>
      </footer>

      <div className="mt-sticky" aria-hidden="true">
        <BotaoComecar />
      </div>
    </div>
  );
}
