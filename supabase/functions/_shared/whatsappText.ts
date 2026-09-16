// Telefone brasileiro em dígitos com DDI e o preenchimento de modelos de
// mensagem. Compartilhados pelos envios manuais e pelas automações do
// WhatsApp; movidos para cá para o webhook não depender do handler de check-in.
export function phoneNumber(raw: string): string | null {
  let d = (raw || '').replace(/\D/g, '').replace(/^0+/, '');
  if (d.length >= 14 && d.startsWith('5555')) d = d.slice(2);
  if (d.length === 10 || d.length === 11) d = '55' + d;
  return /^55[1-9]\d\d{8,9}$/.test(d) ? d : null;
}
export function render(template: string, vars: Record<string, string>): string {
  return template.replace(/\{\{?\s*([a-zA-Z_]+)\s*\}?\}/g, (original, key) => vars[key] ?? original);
}
