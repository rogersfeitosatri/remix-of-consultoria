// Cliente de IA compartilhado.
// Provedor PRIMÁRIO (padrão do sistema): Lovable AI Gateway → openai/gpt-5.6-luna.
// Fallbacks automáticos: Gemini direto e OpenAI direto (quando as chaves existem).
//
// Secrets esperados (Supabase Edge Functions):
//   - LOVABLE_API_KEY  (obrigatório — provedor primário: openai/gpt-5.6-luna)
//   - GEMINI_API_KEY   (opcional — fallback)
//   - OPENAI_API_KEY   (opcional — fallback)

export type FallbackKind = 'openai-gpt4o' | 'openai-gpt4o-mini' | 'openai-gpt5' | 'openai-gpt5-mini' | 'lovable-gemini-pro' | 'none';
export type PrimaryProvider = 'gemini' | 'openai' | 'lovable';

interface Provider {
  name: string;
  endpoint: string;
  apiKey: string | undefined;
  model: string;
  sanitizeSchema: boolean;
  // Cabeçalho de autenticação: Lovable usa "Lovable-API-Key"; outros usam Authorization Bearer.
  authHeader: 'bearer' | 'lovable';
}

const GEMINI_ENDPOINT = 'https://generativelanguage.googleapis.com/v1beta/openai/chat/completions';
const OPENAI_ENDPOINT = 'https://api.openai.com/v1/chat/completions';
const LOVABLE_ENDPOINT = 'https://ai.gateway.lovable.dev/v1/chat/completions';
const GEMINI_MODEL = 'gemini-2.5-flash';

// Modelo padrão de todo o sistema.
export const DEFAULT_MODEL = 'openai/gpt-5.6-luna';

function lovableProvider(model = DEFAULT_MODEL): Provider {
  return {
    name: 'lovable',
    endpoint: LOVABLE_ENDPOINT,
    apiKey: Deno.env.get('LOVABLE_API_KEY'),
    model,
    sanitizeSchema: false,
    authHeader: 'lovable',
  };
}

function geminiProvider(): Provider {
  return {
    name: 'gemini',
    endpoint: GEMINI_ENDPOINT,
    apiKey: Deno.env.get('GEMINI_API_KEY'),
    model: GEMINI_MODEL,
    sanitizeSchema: true,
    authHeader: 'bearer',
  };
}

function openaiProvider(model = 'gpt-4o-mini'): Provider {
  return {
    name: 'openai',
    endpoint: OPENAI_ENDPOINT,
    apiKey: Deno.env.get('OPENAI_API_KEY'),
    model,
    sanitizeSchema: false,
    authHeader: 'bearer',
  };
}

function fallbackProvider(kind: FallbackKind): Provider | null {
  if (kind === 'openai-gpt4o') return openaiProvider('gpt-4o');
  if (kind === 'openai-gpt4o-mini') return openaiProvider('gpt-4o-mini');
  if (kind === 'openai-gpt5') return openaiProvider('gpt-5');
  if (kind === 'openai-gpt5-mini') return openaiProvider('gpt-5-mini');
  if (kind === 'lovable-gemini-pro') {
    return {
      name: 'lovable-gemini',
      endpoint: LOVABLE_ENDPOINT,
      apiKey: Deno.env.get('LOVABLE_API_KEY'),
      model: 'google/gemini-2.5-flash',
      sanitizeSchema: false,
      authHeader: 'lovable',
    };
  }
  return null;
}

// Modelo padrão = Lovable Gateway → openai/gpt-5.6-luna.
// Fallbacks: Gemini direto e OpenAI direto (se as chaves existirem).
function providersFor(fallback: FallbackKind, primary: PrimaryProvider = 'lovable', openaiModel?: string): Provider[] {
  let primaryProv: Provider;
  if (primary === 'openai') primaryProv = openaiProvider(openaiModel || DEFAULT_MODEL.replace(/^openai\//, ''));
  else if (primary === 'gemini') primaryProv = geminiProvider();
  else primaryProv = lovableProvider(openaiModel && openaiModel.includes('/') ? openaiModel : DEFAULT_MODEL);

  const list = [primaryProv, geminiProvider(), fallbackProvider(fallback)];
  // Remove duplicados por nome e sem apiKey.
  const seen = new Set<string>();
  return list.filter((p): p is Provider => {
    if (!p || !p.apiKey) return false;
    const key = `${p.name}:${p.model}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}


// O Gemini não aceita alguns campos de JSON Schema (additionalProperties, $schema).
// Removemos recursivamente antes de enviar ao Gemini.
function stripUnsupported(schema: any): any {
  if (Array.isArray(schema)) return schema.map(stripUnsupported);
  if (schema && typeof schema === 'object') {
    const out: Record<string, any> = {};
    for (const [k, v] of Object.entries(schema)) {
      if (k === 'additionalProperties' || k === '$schema') continue;
      out[k] = stripUnsupported(v);
    }
    return out;
  }
  return schema;
}

async function postChat(p: Provider, body: any, timeoutMs = 70000): Promise<any> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(p.endpoint, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${p.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
      signal: ctrl.signal,
    });
    if (!res.ok) {
      const text = await res.text();
      const err: any = new Error(`${p.name} HTTP ${res.status}: ${text.slice(0, 500)}`);
      err.status = res.status;
      throw err;
    }
    return await res.json();
  } catch (e: any) {
    if (e?.name === 'AbortError') {
      const err: any = new Error(`${p.name}: timeout após ${timeoutMs}ms`);
      err.status = 504;
      throw err;
    }
    throw e;
  } finally {
    clearTimeout(timer);
  }
}

function parseJsonLoose(text: string): any {
  let clean = (text ?? '').trim();
  if (clean.startsWith('```json')) {
    clean = clean.replace(/^```json\n?/, '').replace(/\n?```$/, '');
  } else if (clean.startsWith('```')) {
    clean = clean.replace(/^```\n?/, '').replace(/\n?```$/, '');
  }
  return JSON.parse(clean);
}

export interface StructuredOpts {
  systemPrompt: string;
  userPrompt: string;
  toolName: string;
  toolDescription: string;
  schema: any;
  fallback?: FallbackKind;
  primary?: PrimaryProvider;
  openaiModel?: string;
}

export interface AiResult {
  data: any;
  provider: string;
  model: string;
}

// Saída estruturada via function-calling (parseia tool_calls[0].function.arguments).
export async function callAiStructured(opts: StructuredOpts): Promise<AiResult> {
  const providers = providersFor(opts.fallback ?? 'none', opts.primary ?? 'gemini', opts.openaiModel);

  if (!providers.length) {
    throw new Error('Nenhuma chave de IA configurada. Defina GEMINI_API_KEY nas secrets.');
  }
  let lastErr: any;
  for (const p of providers) {
    try {
      const schema = p.sanitizeSchema ? stripUnsupported(opts.schema) : opts.schema;
      const data = await postChat(p, {
        model: p.model,
        messages: [
          { role: 'system', content: opts.systemPrompt },
          { role: 'user', content: opts.userPrompt },
        ],
        tools: [{
          type: 'function',
          function: {
            name: opts.toolName,
            description: opts.toolDescription,
            parameters: schema,
          },
        }],
        tool_choice: { type: 'function', function: { name: opts.toolName } },
      });
      const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
      if (toolCall?.function?.arguments) {
        return { data: JSON.parse(toolCall.function.arguments), provider: p.name, model: p.model };
      }
      // Fallback: alguns provedores/modelos ignoram tool_choice e devolvem JSON no content
      const content = data.choices?.[0]?.message?.content;
      if (content) {
        try {
          return { data: parseJsonLoose(content), provider: p.name, model: p.model };
        } catch {
          // tenta extrair primeiro bloco {...}
          const match = String(content).match(/\{[\s\S]*\}/);
          if (match) {
            return { data: JSON.parse(match[0]), provider: p.name, model: p.model };
          }
        }
      }
      throw new Error(`${p.name}: resposta sem tool_call estruturado`);
    } catch (e) {
      lastErr = e;
      console.error(`[aiClient] provedor ${p.name} falhou:`, e instanceof Error ? e.message : e);
    }
  }
  throw lastErr ?? new Error('Falha em todos os provedores de IA');
}

export interface JsonOpts {
  systemPrompt: string;
  userPrompt: string;
  maxTokens?: number;
  fallback?: FallbackKind;
  primary?: PrimaryProvider;
  openaiModel?: string;
}

// Saída de texto livre (sem parsing) — usada pelo playground de teste de prompts.
export async function callAiText(opts: JsonOpts): Promise<AiResult> {
  const providers = providersFor(opts.fallback ?? 'none', opts.primary ?? 'gemini', opts.openaiModel);

  if (!providers.length) {
    throw new Error('Nenhuma chave de IA configurada. Defina GEMINI_API_KEY nas secrets.');
  }
  let lastErr: any;
  for (const p of providers) {
    try {
      const data = await postChat(p, {
        model: p.model,
        messages: [
          { role: 'system', content: opts.systemPrompt },
          { role: 'user', content: opts.userPrompt },
        ],
        max_tokens: opts.maxTokens ?? 1500,
      });
      const content = data.choices?.[0]?.message?.content;
      if (!content) throw new Error(`${p.name}: resposta vazia`);
      return { data: content, provider: p.name, model: p.model };
    } catch (e) {
      lastErr = e;
      console.error(`[aiClient] provedor ${p.name} falhou:`, e instanceof Error ? e.message : e);
    }
  }
  throw lastErr ?? new Error('Falha em todos os provedores de IA');
}

// Saída JSON simples no conteúdo da mensagem (tolerante a cercas markdown ```json).
export async function callAiJson(opts: JsonOpts): Promise<AiResult> {
  const providers = providersFor(opts.fallback ?? 'none', opts.primary ?? 'gemini', opts.openaiModel);
  if (!providers.length) {
    throw new Error('Nenhuma chave de IA configurada. Defina GEMINI_API_KEY nas secrets.');
  }
  let lastErr: any;
  for (const p of providers) {
    try {
      const data = await postChat(p, {
        model: p.model,
        messages: [
          { role: 'system', content: opts.systemPrompt },
          { role: 'user', content: opts.userPrompt },
        ],
        max_tokens: opts.maxTokens ?? 2000,
      });
      const content = data.choices?.[0]?.message?.content;
      if (!content) throw new Error(`${p.name}: resposta vazia`);
      return { data: parseJsonLoose(content), provider: p.name, model: p.model };
    } catch (e) {
      lastErr = e;
      console.error(`[aiClient] provedor ${p.name} falhou:`, e instanceof Error ? e.message : e);
    }
  }
  throw lastErr ?? new Error('Falha em todos os provedores de IA');
}
