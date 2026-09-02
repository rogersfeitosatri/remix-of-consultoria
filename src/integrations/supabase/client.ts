// Gerado originalmente pelo Lovable. Editado na migração para o Vercel: acrescenta a
// validação das variáveis de build (ver src/lib/envGuard.ts), que troca o erro
// críptico de fetch por um aviso nomeando a variável errada.
import { createClient } from '@supabase/supabase-js';
import type { Database } from './types';
import { brokeredPreviewStorage } from './previewAuthStorage';
import { exigirEnvIntegra } from '@/lib/envGuard';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_PUBLISHABLE_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

// Falha aqui, com a variável nomeada, em vez de mais adiante no primeiro login.
exigirEnvIntegra({
  VITE_SUPABASE_URL: SUPABASE_URL,
  VITE_SUPABASE_PUBLISHABLE_KEY: SUPABASE_PUBLISHABLE_KEY,
});

// Import the supabase client like this:
// import { supabase } from "@/integrations/supabase/client";

export const supabase = createClient<Database>(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
  auth: {
    storage: brokeredPreviewStorage(),
    persistSession: true,
    autoRefreshToken: true,
  }
});
