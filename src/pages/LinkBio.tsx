import { useEffect } from 'react';
import {
  BookOpen,
  Calculator,
  ChevronRight,
  ClipboardList,
  Link2,
  MessageCircle,
  PlayCircle,
  Tag,
  type LucideIcon,
} from 'lucide-react';
import { usePublicLinkBioItems } from '@/hooks/useLinkBio';
import { resolverCategoria, type ChaveDeCategoria } from '@/lib/linkBioCategories';
import bioHero from '@/assets/bio-hero.jpg';

/**
 * Página pública de links (/bio), direção "Grafite".
 *
 * Ela é escura sempre, independente do tema que o app guardou em
 * localStorage['rf-theme']. Por isso toda cor aqui é literal, nenhuma vem dos
 * tokens do tema, e todo texto e ícone carrega uma classe `text-` explícita —
 * sem isso as regras gerais de `.dark` em index.css repintariam o conteúdo.
 */

/** Fundo da página. O gradiente da capa termina exatamente nesta cor. */
const FUNDO = '#0D0E10';

const PERFIL = {
  nome: 'Rogers Feitosa',
  papel: 'Nutrição e treinamento para endurance',
  /** Preencha com o número do CRN para a credencial aparecer ao lado do papel. */
  crn: '',
};

const ICONES: Record<ChaveDeCategoria, LucideIcon> = {
  assessoria: ClipboardList,
  ferramenta: Calculator,
  parceria: Tag,
  produto: BookOpen,
  contato: MessageCircle,
  conteudo: PlayCircle,
  padrao: Link2,
};

const CAPA = {
  backgroundImage:
    `linear-gradient(to bottom, rgba(13,14,16,0.12) 0%, rgba(13,14,16,0.70) 50%, ${FUNDO} 86%)`,
};

const DESTAQUE = {
  backgroundImage: 'linear-gradient(180deg, rgba(200,162,83,0.07), rgba(200,162,83,0))',
};

function comProtocolo(url: string | null): string {
  const limpa = (url || '').trim();
  if (!limpa) return '#';
  return /^https?:\/\//i.test(limpa) ? limpa : `https://${limpa}`;
}

/**
 * A página é desenhada de ponta a ponta na cor do fundo. O `body` e a barra do
 * navegador seguem os tokens do app, então pintamos os dois enquanto /bio está
 * na tela e devolvemos como estavam ao sair — sem isso aparece uma faixa clara
 * no notch e no efeito de elástico da rolagem.
 */
function useFundoEscuro() {
  useEffect(() => {
    const { body } = document;
    const fundoAnterior = body.style.backgroundColor;
    body.style.backgroundColor = FUNDO;

    const meta = document.querySelector('meta[name="theme-color"]');
    const corAnterior = meta?.getAttribute('content') ?? null;
    meta?.setAttribute('content', FUNDO);

    return () => {
      body.style.backgroundColor = fundoAnterior;
      if (meta && corAnterior !== null) meta.setAttribute('content', corAnterior);
    };
  }, []);
}

export default function LinkBio() {
  const { data: items = [], isLoading } = usePublicLinkBioItems();
  useFundoEscuro();

  const credencial = PERFIL.crn
    ? `${PERFIL.papel} · CRN ${PERFIL.crn}`
    : PERFIL.papel;

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#0D0E10]">
        <div
          className="h-8 w-8 animate-spin rounded-full border-2 border-[#22252A] border-t-[#C8A253]"
          role="status"
          aria-label="Carregando"
        />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0D0E10]">
      <div className="mx-auto w-full max-w-lg">
      <header className="relative h-[196px] sm:h-[228px]">
        <img
          src={bioHero}
          alt=""
          aria-hidden="true"
          className="absolute inset-0 h-full w-full object-cover object-[46%_0%]"
          decoding="async"
        />
        <div className="absolute inset-0" style={CAPA} />
        <div className="absolute inset-x-0 bottom-0">
          <div className="w-full px-5 pb-4">
            <h1 className="font-bio-display text-[26px] font-bold leading-[1.08] tracking-[-0.03em] text-[#ECEDEF]">
              {PERFIL.nome}
            </h1>
            <p className="font-bio-mono mt-2 text-[9.5px] uppercase leading-relaxed tracking-[0.16em] text-[#C8A253]">
              {credencial}
            </p>
          </div>
        </div>
      </header>

      <main className="px-5 pt-6">
        {items.length === 0 ? (
          <p className="py-10 text-center text-[13px] text-[#888C93]">
            Nenhum link disponível no momento.
          </p>
        ) : (
          <ul className="flex list-none flex-col gap-[18px] p-0">
            {items.map((item, indice) => {
              const categoria = resolverCategoria(item.category);
              const Icone = ICONES[categoria.chave];
              const destaque = indice === 0;

              return (
                <li key={item.id}>
                  <a
                    href={comProtocolo(item.link_url)}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={destaque ? DESTAQUE : undefined}
                    className={[
                      'flex items-start gap-4 rounded-[15px] border p-4 text-[#ECEDEF]',
                      'transition-colors duration-200 focus-visible:outline-none',
                      'focus-visible:ring-2 focus-visible:ring-[#C8A253] focus-visible:ring-offset-2',
                      'focus-visible:ring-offset-[#0D0E10]',
                      destaque
                        ? 'border-[#6B5723] hover:border-[#93783A]'
                        : 'border-[#22252A] hover:border-[#3A3E46]',
                    ].join(' ')}
                  >
                    <span className="grid h-[42px] w-[42px] flex-none place-items-center overflow-hidden rounded-[13px] bg-[#15171A]">
                      {item.image_url ? (
                        <img
                          src={item.image_url}
                          alt=""
                          aria-hidden="true"
                          className="h-full w-full object-cover"
                          loading="lazy"
                          decoding="async"
                        />
                      ) : (
                        <Icone
                          className="h-[21px] w-[21px] text-[#C8A253]"
                          strokeWidth={1.7}
                          aria-hidden="true"
                        />
                      )}
                    </span>

                    <span className="min-w-0 flex-1">
                      {categoria.etiqueta && (
                        <span className="font-bio-mono mb-1.5 block text-[9px] uppercase tracking-[0.18em] text-[#A98A44]">
                          {categoria.etiqueta}
                        </span>
                      )}
                      <span className="font-bio-display block text-[16.5px] font-semibold leading-tight tracking-[-0.02em] text-[#ECEDEF]">
                        {item.title?.trim()}
                      </span>
                      {item.description?.trim() && (
                        <span className="mt-1 block text-[12.5px] leading-snug text-[#888C93]">
                          {item.description.trim()}
                        </span>
                      )}
                    </span>

                    <ChevronRight
                      className="h-[17px] w-[17px] flex-none self-center text-[#4A4E55]"
                      aria-hidden="true"
                    />
                  </a>
                </li>
              );
            })}
          </ul>
        )}
      </main>

      <footer className="px-5 pb-10 pt-8 text-center">
        <p className="font-bio-mono text-[10.5px] tracking-[0.08em] text-[#8A8F97]">
          rogersfeitosa.com.br
        </p>
        <p className="mt-2 text-[10.5px] text-[#7D828A]">
          © {new Date().getFullYear()} Rogers Feitosa
        </p>
      </footer>
      </div>
    </div>
  );
}
