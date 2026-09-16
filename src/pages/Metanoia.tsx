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
    pergunta: 'Já fiz consultoria e não funcionou.',
    resposta: 'Você recebeu um plano. Aqui a gente entende por que o plano não se sustentou, e treina isso uma semana de cada vez.',
  },
  {
    pergunta: 'Vou ter que cortar tudo?',
    resposta: 'Você vai fazer o oposto. A restrição é a origem do descontrole. O caminho é comer o suficiente, com regularidade, e entender os seus gatilhos.',
  },
  {
    pergunta: 'Não tenho tempo pra responder toda semana.',
    resposta: 'A Pausa da Semana leva uns dez minutos no domingo. É o menor esforço que você já fez pela sua relação com a comida.',
  },
  {
    pergunta: 'Três meses é muito tempo?',
    resposta: 'Você está no ciclo de restrição e culpa há anos. Doze semanas é o tempo de enxergar o padrão e reaprender.',
  },
];

const SEMANAS = Array.from({ length: METANOIA_SEMANAS }, (_, i) => i + 1);
const CONSULTAS = new Set<number>(METANOIA_CONSULTAS_NAS_SEMANAS);

export default function Metanoia() {
  useEffect(() => {
    const tituloAnterior = document.title;
    document.title = 'Metanóia · Comportamento alimentar';
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
            <p className="mt-eyebrow">Programa de 12 semanas para corredores</p>
            <h1 className="mt-h1">Você sabe o que comer. O difícil é sustentar.</h1>
            <p className="mt-lead">
              Comer com calma é possível. Um programa de 12 semanas para o corredor que quer manter o resultado com mais consciência, mais constância e menos culpa.
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

        <section className="mt-facts mt-wrap" aria-label="O que o programa inclui">
          <ul>
            <li>3 consultas individuais</li>
            <li>Pausa da Semana, toda semana</li>
            <li>12 semanas de acompanhamento</li>
          </ul>
        </section>

        <section className="mt-pains mt-wrap" aria-label="Para quem é o programa">
          <div className="mt-pains-grid">
            <h2 className="mt-h2">Talvez você se reconheça</h2>
            <ul>
              <li>Treina com disciplina e come no automático.</li>
              <li>Segue o plano até a primeira semana difícil.</li>
              <li>Compensa depois do treino longo e se culpa em seguida.</li>
              <li>Já fez todas as dietas. Todas funcionaram por três semanas.</li>
            </ul>
          </div>
          <p className="mt-turn">O Metanóia trabalha o que a planilha não alcança: a sua relação com a comida.</p>
        </section>

        <section className="mt-vision mt-wrap" id="visao" aria-label="Nossa visão">
          <h2 className="mt-h2">O que faz diferença</h2>
          <p className="mt-intro">
            Comer fora do plano quase nunca é falta de informação, de disciplina ou de força de vontade.
          </p>
          <p className="mt-label">O que costuma estar por trás</p>
          <ul className="mt-triggers">
            <li><strong>Ambiente</strong><span>O que está à vista e ao alcance decide antes de você.</span></li>
            <li><strong>Hábito</strong><span>A resposta automática que o cérebro aprendeu a repetir.</span></li>
            <li><strong>Estado emocional</strong><span>Ansiedade, cansaço, estresse. A comida vira alívio.</span></li>
            <li><strong>Rotina</strong><span>Dias desorganizados pedem soluções rápidas.</span></li>
            <li><strong>Fome de verdade</strong><span>Fisiológica. Merece ser atendida, sem culpa.</span></li>
          </ul>
          <div className="mt-vision-close">
            <p className="mt-turn">Quando você reconhece o gatilho, a escolha volta a ser sua.</p>
            <div>
              <p className="mt-label">O que a ciência do comportamento mostra</p>
              <p>Gatilho, resposta, recompensa. Repetido, esse ciclo vira um caminho no cérebro. É por isso que a força de vontade cansa.</p>
              <p>Nosso cérebro se molda pela neuroplasticidade. Com percepção e repetição, ele aprende respostas novas. No acompanhamento, você treina isso por 12 semanas, até sustentar o que você já sabe vir da consciência em vez do esforço.</p>
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

        <section className="mt-method mt-wrap" id="metodo">
          <h2 className="mt-h2">Dieta e comportamento, juntos</h2>
          <p className="mt-intro">O plano alimentar continua, ajustado ao seu treino. O que muda é a forma de se relacionar com ele.</p>
          <ul className="mt-cols">
            <li><h3 className="mt-h3">Plano alimentar</h3><p>Montado para a sua rotina de corrida e revisado ao longo das 12 semanas.</p></li>
            <li><h3 className="mt-h3">Consciência</h3><p>Perceber fome, saciedade e gatilhos antes de agir no automático.</p></li>
            <li><h3 className="mt-h3">Constância</h3><p>Práticas curtas, toda semana, que fazem a adesão durar.</p></li>
          </ul>
        </section>

        <section className="mt-how mt-wrap" id="como-funciona">
          <h2 className="mt-h2">Como funciona</h2>
          <ul className="mt-cols">
            <li><h3 className="mt-h3">Consultas<small>semanas 1, 5 e 9</small></h3><p>Três encontros individuais. Plano alimentar, devolutivas e ajustes.</p></li>
            <li><h3 className="mt-h3">Pausa da Semana<small>toda semana</small></h3><p>Poucas perguntas para observar como foi comer, treinar e sentir. Você recebe uma devolutiva.</p></li>
            <li><h3 className="mt-h3">Práticas comportamentais<small>uma por semana</small></h3><p>Uma atividade curta para treinar consciência à mesa e no dia a dia.</p></li>
            <li><h3 className="mt-h3">Suporte e acompanhamento semanal<small>no WhatsApp</small></h3><p>Um canal direto durante as 12 semanas, sem esperar a próxima consulta.</p></li>
          </ul>
          <div className="mt-weeks-wrap" aria-label="As 12 semanas">
            <p className="mt-label">As 12 semanas</p>
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
            <li><h3 className="mt-h3">Chame no WhatsApp</h3><p>Você tira suas dúvidas direto comigo, sem compromisso.</p></li>
            <li><h3 className="mt-h3">Confirme sua vaga</h3><p>Com a vaga confirmada, você recebe o link da avaliação inicial.</p></li>
            <li><h3 className="mt-h3">Agende a primeira consulta</h3><p>A partir daí, caminhamos juntos por 12 semanas.</p></li>
          </ol>
        </section>

        <section className="mt-next mt-wrap" id="comecar">
          <div className="mt-next-inner">
            <div>
              <p className="mt-label">Próximo passo</p>
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
            <span className="mt-wordmark">metanóia</span>
          </a>
          <span>comportamento alimentar</span>
          <span>© {new Date().getFullYear()} Metanóia</span>
        </div>
      </footer>

      <div className="mt-sticky" aria-hidden="true">
        <BotaoComecar />
      </div>
    </div>
  );
}
