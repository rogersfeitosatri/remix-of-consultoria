// Validação das variáveis de build que o app recebe do host (Vercel, Lovable, .env local).
//
// Motivo: um painel de hospedagem mostra valores sensíveis mascarados com "•".
// Quando essa máscara é salva por engano no lugar do valor, a chave chega ao app
// como "eyJhbGci••••••…". O erro que aparece é o do fetch reclamando de
// "non ISO-8859-1 code point" ao montar o cabeçalho HTTP — mensagem que não diz
// nada sobre qual variável está errada. Este módulo troca isso por um aviso que
// nomeia a variável e explica o que fazer.

// Bolinhas usadas por campos mascarados de navegador e de painel.
const MASCARA = /[•·●▪∙]/;

// Cabeçalho HTTP aceita apenas ISO-8859-1. Qualquer coisa fora do ASCII imprimível
// já é suspeita numa chave, URL ou id de projeto.
const FORA_DO_ASCII = /[^\x20-\x7e]/;

export interface ProblemaDeEnv {
  nome: string;
  motivo: string;
}

/** Devolve o problema encontrado no valor, ou null quando ele está íntegro. */
export function verificarEnv(nome: string, bruto: unknown): ProblemaDeEnv | null {
  if (typeof bruto !== 'string' || bruto.trim() === '') {
    return { nome, motivo: 'está vazia ou não foi definida' };
  }

  const valor = bruto.trim();

  if (MASCARA.test(valor)) {
    return {
      nome,
      motivo: 'contém "•": o campo do painel foi salvo mascarado, no lugar do valor real',
    };
  }

  const fora = valor.match(FORA_DO_ASCII);
  if (fora) {
    const ponto = fora[0].codePointAt(0)!.toString(16).toUpperCase().padStart(4, '0');
    return { nome, motivo: `contém o caractere inválido U+${ponto}` };
  }

  return null;
}

export function verificarTodas(vars: Record<string, unknown>): ProblemaDeEnv[] {
  return Object.entries(vars)
    .map(([nome, valor]) => verificarEnv(nome, valor))
    .filter((p): p is ProblemaDeEnv => p !== null);
}

export function mensagemDeErro(problemas: ProblemaDeEnv[]): string {
  const linhas = problemas.map((p) => `  ${p.nome} — ${p.motivo}`).join('\n');
  return `Configuração inválida. Corrija no painel da hospedagem e faça um novo deploy:\n${linhas}`;
}

// Desenha o aviso na tela. Roda antes do React montar, então usa DOM puro.
function desenharAviso(problemas: ProblemaDeEnv[]): void {
  if (typeof document === 'undefined') return;

  const caixa = document.createElement('div');
  caixa.setAttribute('role', 'alert');
  caixa.style.cssText = [
    'position:fixed', 'inset:0', 'z-index:2147483647',
    'display:flex', 'align-items:center', 'justify-content:center', 'padding:24px',
    'background:#0a0a0a', 'color:#fafafa',
    'font:15px/1.6 system-ui,-apple-system,Segoe UI,Roboto,sans-serif',
  ].join(';');

  const itens = problemas
    .map((p) => `<li style="margin-bottom:8px"><code style="color:#fbbf24">${p.nome}</code> — ${p.motivo}</li>`)
    .join('');

  caixa.innerHTML = `
    <div style="max-width:560px">
      <h1 style="font-size:20px;margin:0 0 12px">Configuração do app incompleta</h1>
      <p style="margin:0 0 16px;color:#a1a1aa">
        O site subiu com variáveis de ambiente inválidas, então ele não consegue falar com o servidor.
      </p>
      <ul style="margin:0 0 16px;padding-left:20px">${itens}</ul>
      <p style="margin:0;color:#a1a1aa">
        Corrija os valores nas variáveis de ambiente do projeto e faça um novo deploy.
        Ao colar uma chave, confira se ela aparece inteira, sem bolinhas.
      </p>
    </div>`;

  const inserir = () => document.body?.appendChild(caixa);
  if (document.body) inserir();
  else document.addEventListener('DOMContentLoaded', inserir, { once: true });
}

/**
 * Valida as variáveis e interrompe a inicialização quando alguma está corrompida,
 * deixando na tela um aviso que nomeia o problema.
 */
export function exigirEnvIntegra(vars: Record<string, unknown>): void {
  const problemas = verificarTodas(vars);
  if (problemas.length === 0) return;

  const mensagem = mensagemDeErro(problemas);
  console.error(mensagem);
  desenharAviso(problemas);
  throw new Error(mensagem);
}
