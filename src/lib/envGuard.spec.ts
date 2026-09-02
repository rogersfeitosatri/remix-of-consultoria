import { describe, it, expect } from 'vitest';
import { verificarEnv, verificarTodas, mensagemDeErro } from './envGuard';

const CHAVE_BOA =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSJ9.yfr0oLbb7IRYPmt-x0rcwh5A';

describe('envGuard', () => {
  it('aceita chave e URL normais', () => {
    expect(verificarEnv('VITE_SUPABASE_PUBLISHABLE_KEY', CHAVE_BOA)).toBeNull();
    expect(verificarEnv('VITE_SUPABASE_URL', 'https://abc.supabase.co')).toBeNull();
  });

  it('pega o valor mascarado que o painel salva por engano', () => {
    const mascarado = 'eyJhbGci' + '•'.repeat(200);
    const p = verificarEnv('VITE_SUPABASE_PUBLISHABLE_KEY', mascarado);
    expect(p?.motivo).toContain('mascarado');
  });

  it('pega caractere invisível vindo de copiar e colar', () => {
    const comZeroWidth = CHAVE_BOA + '​';
    expect(verificarEnv('VITE_SUPABASE_PUBLISHABLE_KEY', comZeroWidth)?.motivo).toContain('U+200B');
  });

  it('pega variável vazia ou ausente', () => {
    expect(verificarEnv('VITE_SUPABASE_URL', '')?.motivo).toContain('vazia');
    expect(verificarEnv('VITE_SUPABASE_URL', undefined)?.motivo).toContain('vazia');
    expect(verificarEnv('VITE_SUPABASE_URL', '   ')?.motivo).toContain('vazia');
  });

  it('ignora espaço em volta do valor', () => {
    expect(verificarEnv('VITE_SUPABASE_URL', `  https://abc.supabase.co  `)).toBeNull();
  });

  it('relata todas as variáveis quebradas de uma vez', () => {
    const problemas = verificarTodas({
      VITE_SUPABASE_URL: 'https://abc.supabase.co',
      VITE_SUPABASE_PUBLISHABLE_KEY: 'eyJhbGci' + '•'.repeat(10),
      VITE_FIREBASE_API_KEY: '',
    });
    expect(problemas.map((p) => p.nome)).toEqual([
      'VITE_SUPABASE_PUBLISHABLE_KEY',
      'VITE_FIREBASE_API_KEY',
    ]);
    expect(mensagemDeErro(problemas)).toContain('VITE_FIREBASE_API_KEY');
  });
});
