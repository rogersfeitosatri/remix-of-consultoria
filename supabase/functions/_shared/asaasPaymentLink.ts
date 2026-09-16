// Link de pagamento do Asaas para o Metanóia.
//
// Um link por atleta, com o id do cadastro em externalReference: é o fio que
// amarra o evento do webhook de volta ao atleta. O atleta escolhe a forma de
// pagamento na página do Asaas e, no cartão, até 3 parcelas. Sem recorrência:
// o programa tem 12 semanas e acaba.

export interface DepsAsaas {
  fetch: typeof fetch;
  env: (key: string) => string | undefined;
}

export interface LinkDePagamento {
  id: string;
  url: string;
}

export function asaasConfigurado(env: DepsAsaas['env']): boolean {
  return !!env('ASAAS_API_KEY');
}

export function asaasBase(env: DepsAsaas['env']): string {
  return (env('ASAAS_ENV') ?? 'sandbox').toLowerCase() === 'production'
    ? 'https://api.asaas.com/v3'
    : 'https://api-sandbox.asaas.com/v3';
}

export function corpoDoLinkMetanoia(input: { clientId: string; nome: string; valor: number; parcelas: number }) {
  const primeiroNome = input.nome.trim().split(/\s+/)[0] || input.nome;
  return {
    name: `Metanóia · ${primeiroNome}`,
    description: 'Programa Metanóia de comportamento alimentar: 12 semanas, 3 consultas individuais e acompanhamento semanal.',
    billingType: 'UNDEFINED',
    chargeType: input.parcelas > 1 ? 'INSTALLMENT' : 'DETACHED',
    value: Number(input.valor.toFixed(2)),
    ...(input.parcelas > 1 ? { maxInstallmentCount: input.parcelas } : {}),
    dueDateLimitDays: 7,
    externalReference: input.clientId,
    notificationEnabled: true,
  };
}

export async function criarLinkDePagamentoMetanoia(
  input: { clientId: string; nome: string; valor: number; parcelas: number },
  deps: DepsAsaas,
): Promise<LinkDePagamento> {
  const chave = deps.env('ASAAS_API_KEY');
  if (!chave) throw new Error('asaas_nao_configurado');
  const resposta = await deps.fetch(asaasBase(deps.env) + '/paymentLinks', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', access_token: chave },
    body: JSON.stringify(corpoDoLinkMetanoia(input)),
    signal: AbortSignal.timeout(15000),
  });
  const corpo = await resposta.json().catch(() => ({}));
  if (!resposta.ok || typeof corpo?.url !== 'string' || typeof corpo?.id !== 'string') {
    const detalhe = corpo?.errors?.[0]?.description ?? corpo?.message ?? `http_${resposta.status}`;
    throw new Error(`asaas_recusou: ${detalhe}`);
  }
  return { id: corpo.id, url: corpo.url };
}
