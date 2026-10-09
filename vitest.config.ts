import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  resolve: { alias: { '@': path.resolve(__dirname, './src'), 'npm:pdf-lib@1.17.1': 'pdf-lib', 'npm:@supabase/supabase-js@2.108.2': '@supabase/supabase-js' } },
  test: { environment: 'node', include: ['src/**/*.spec.ts', 'src/**/*.test.ts'] },
});
