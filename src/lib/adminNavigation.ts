/** Primary work areas. Old URLs remain valid; secondary tools live in Settings. */
export const ADMIN_NAVIGATION = [
  { key: '/admin', label: 'Hoje', visible: true },
  { key: '/clients', label: 'Atletas', visible: true },
  { key: '/checkin-hub', label: 'Check-ins', visible: true },
  { key: '/calendar', label: 'Consultas', visible: true },
  { key: '/financial', label: 'Financeiro', visible: true },
] as const;

export const ADMIN_SETTINGS_ITEM = { key: '/settings', label: 'Configurações', visible: true };

export function getAdminArea(pathname: string): string {
  if (/^\/(clients)(\/|$)/.test(pathname)) return '/clients';
  if (/^\/(checkin-hub|checkin-review|checkin|adjustments)(\/|$)/.test(pathname)) return '/checkin-hub';
  if (/^\/(calendar|appointments|scheduling)(\/|$)/.test(pathname)) return '/calendar';
  if (/^\/financial(\/|$)/.test(pathname)) return '/financial';
  if (/^\/(admin|tasks)(\/|$)/.test(pathname)) return '/admin';
  return '/settings';
}

export const SECONDARY_TOOLS = [
  { to: '/forms', label: 'Formulários', description: 'Modelos de check-in e anamnese.' },
  { to: '/scheduling', label: 'Disponibilidade de consultas', description: 'Horários, bloqueios e link público.' },
  { to: '/ai-training', label: 'Central de IA', description: 'Instruções e modelos de análise.' },
  { to: '/zn-assessoria', label: 'ZN Assessoria', description: 'Acessos e assinaturas do módulo existente.' },
  { to: '/content', label: 'Conteúdo do atleta', description: 'Materiais de apoio.' },
  { to: '/meal-plans', label: 'Planos alimentares antigos', description: 'Consultar o histórico do Consultoria Pro.' },
] as const;
