## Problema

Na página pública `/call/:slug`, o botão "Quero aplicar" não redireciona para o link externo configurado (ex.: `zonanutri.com/atletas`). O `redirect_url` está salvo corretamente no banco, mas como foi cadastrado **sem `https://`**, o `window.open` interpreta como caminho relativo (`rogersfeitosa.com.br/zonanutri.com/atletas`) e nada acontece de forma esperada.

## Correção

### 1. `src/pages/PublicStrategicCall.tsx`
- Normalizar a URL antes de abrir: se não começar com `http://`, `https://` ou `mailto:`/`tel:`, prefixar com `https://`.
- Trim de espaços.
- Manter o `target="_blank"` e `noopener,noreferrer`.

```ts
const normalizeUrl = (url: string) => {
  const trimmed = url.trim();
  if (/^(https?:|mailto:|tel:)/i.test(trimmed)) return trimmed;
  return `https://${trimmed}`;
};

const handleCta = () => {
  if (redirectUrl?.trim()) {
    window.open(normalizeUrl(redirectUrl), '_blank', 'noopener,noreferrer');
    return;
  }
  setPhase('wizard');
};
```

### 2. `src/pages/StrategicCallBuilder.tsx` (preventivo)
- No campo "URL de redirecionamento", adicionar nota visual ("Inclua https://...") e, ao salvar, aplicar a mesma normalização para que novos links já fiquem completos no banco.

### 3. Sem migration necessária
Os registros existentes serão tratados em runtime pela normalização. Opcionalmente, posso atualizar o registro atual (`teste`) para `https://zonanutri.com/atletas` por consistência.

## Resultado
O botão passa a abrir corretamente o link externo em nova aba, mesmo que o admin tenha esquecido de digitar `https://`.