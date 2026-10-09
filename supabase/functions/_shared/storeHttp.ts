import { createClient, type SupabaseClient } from 'npm:@supabase/supabase-js@2.108.2';

export type Env = (key: string) => string | undefined;
export type StoreClient = SupabaseClient<any>;
export interface StoreDeps { env: Env; fetch: typeof fetch; db: () => StoreClient; now: () => Date }
export class StoreError extends Error {
  constructor(public status: number, message: string) { super(message); }
}
export const realStoreDeps = (): StoreDeps => ({ env: key => Deno.env.get(key), fetch, now: () => new Date(), db: () => createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession: false, autoRefreshToken: false } }) });
export function storeCors(req: Request) {
  const origin = req.headers.get('origin') ?? '';
  const allowed = ['https://www.rogersfeitosa.com.br','https://rogersfeitosa.com.br','http://localhost:8080','http://127.0.0.1:8080'];
  return { ...(allowed.includes(origin) ? { 'Access-Control-Allow-Origin': origin } : {}), 'Vary': 'Origin', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type', 'Access-Control-Allow-Methods': 'POST, OPTIONS', 'Access-Control-Expose-Headers': 'Content-Disposition', 'Cache-Control': 'no-store' };
}
export function storeJson(req: Request, body: unknown, status = 200) { return new Response(JSON.stringify(body), { status, headers: { ...storeCors(req), 'Content-Type': 'application/json' } }); }
export function storeFailure(req: Request, e: unknown) {
  if (e instanceof StoreError) return storeJson(req, { error: e.message }, e.status);
  console.error('store request failed', e instanceof Error ? e.name : 'database_error');
  return storeJson(req, { error: 'Não foi possível concluir. Tente novamente em instantes.' }, 500);
}
export async function storeUser(req: Request, db: StoreClient) {
  const token = req.headers.get('authorization')?.match(/^Bearer\s+(.+)$/i)?.[1];
  if (!token) throw new StoreError(401, 'Entre na sua conta para continuar.');
  const { data, error } = await db.auth.getUser(token);
  if (error || !data.user || data.user.is_anonymous || !data.user.email) throw new StoreError(401, 'Entre novamente na sua conta.');
  if (!data.user.email_confirmed_at) throw new StoreError(403, 'Confirme o e-mail da sua conta para continuar.');
  return data.user;
}
export async function storeIsAdmin(db: StoreClient, userId: string) {
  const { data, error } = await db.from('store_admins').select('user_id').eq('user_id', userId).limit(1);
  if (error) throw error;
  return !!data?.length;
}
export function requireUuid(value: unknown): string {
  if (typeof value !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)) throw new StoreError(400, 'Identificador inválido.');
  return value;
}
