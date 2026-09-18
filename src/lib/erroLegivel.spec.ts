import { describe, expect, it } from 'vitest';
import { erroLegivel, mensagemCrua } from './erroLegivel';

describe('a frase do erro na tela', () => {
  it('bucket ausente vira uma frase que diz o que fazer — foi o erro do Link da Bio', () => {
    const erro = { message: 'Bucket not found', statusCode: '404' };
    expect(erroLegivel(erro, 'Erro ao fazer upload')).toMatch(/armazenamento de imagens não está configurado/);
  });

  it('bloqueio de permissão e tamanho também falam português', () => {
    expect(erroLegivel(new Error('new row violates row-level security policy'), 'x')).toMatch(/Sem permissão/);
    expect(erroLegivel({ message: 'The object exceeded the maximum allowed size' }, 'x')).toMatch(/grande demais/);
    expect(erroLegivel(new Error('Failed to fetch'), 'x')).toMatch(/falar com o servidor/);
  });

  it('o que não tem tradução mostra a mensagem original junto do padrão', () => {
    expect(erroLegivel(new Error('duplicate key value'), 'Erro ao salvar link'))
      .toBe('Erro ao salvar link: duplicate key value');
  });

  it('erro sem mensagem fica só com o texto padrão', () => {
    expect(erroLegivel(undefined, 'Erro ao salvar link')).toBe('Erro ao salvar link');
    expect(erroLegivel({}, 'Erro ao salvar link')).toBe('Erro ao salvar link');
    expect(erroLegivel({ message: '   ' }, 'Erro ao salvar link')).toBe('Erro ao salvar link');
  });

  it('a mensagem crua aceita texto, Error e objeto do Supabase', () => {
    expect(mensagemCrua(' falhou ')).toBe('falhou');
    expect(mensagemCrua(new Error('falhou'))).toBe('falhou');
    expect(mensagemCrua({ message: 'falhou' })).toBe('falhou');
    expect(mensagemCrua(null)).toBe('');
    expect(mensagemCrua(42)).toBe('');
  });
});
