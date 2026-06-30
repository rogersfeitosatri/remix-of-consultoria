# Aba "Ajustes" + Notificações (Firebase)

## O que faz
Lista os atletas de **consultoria** (sem consultas ou com só 1 consulta inicial) que fecham o **bloco mensal** e precisam de ajuste no plano. O fechamento é ancorado nos checkins (sempre às segundas):

| Frequência do checkin | Ajuste cai em |
|---|---|
| Mensal | todo checkin (1º, 2º, 3º…) |
| Quinzenal | 2º checkin e a cada 2 (2º, 4º, 6º…) |
| Semanal / Diário | 3º checkin e a cada 4 (3º, 7º, 11º…) |
| 3 semanas / Bimestral / Trimestral | todo checkin |

Em todos os casos o ciclo de ajuste fica **28 dias (4 semanas)** entre um e outro. Referência de controle: a partir de **27/06/2026**.

A página fica em `/adjustments` (menu lateral: **Ajustes**).

## Notificação por push (Firebase Cloud Messaging)

### 1. Criar projeto Firebase
- console.firebase.google.com → criar projeto.
- Adicionar app **Web** → copiar o objeto de configuração (apiKey, authDomain, projectId, storageBucket, messagingSenderId, appId).
- **Cloud Messaging → Web Push certificates** → gerar par de chaves → copiar a **VAPID key**.

### 2. Variáveis de ambiente do front (.env)
```
VITE_FIREBASE_API_KEY=...
VITE_FIREBASE_AUTH_DOMAIN=...
VITE_FIREBASE_PROJECT_ID=...
VITE_FIREBASE_STORAGE_BUCKET=...
VITE_FIREBASE_MESSAGING_SENDER_ID=...
VITE_FIREBASE_APP_ID=...
VITE_FIREBASE_VAPID_KEY=...
```

### 3. Service worker
Edite `public/firebase-messaging-sw.js` e cole os MESMOS valores no `firebaseConfig` (o service worker não enxerga as variáveis VITE_).

### 4. Backend (envio do push)
- Em **Configurações do projeto → Contas de serviço** do Firebase, gere uma **chave privada** (JSON do service account).
- No Supabase, defina a secret das Edge Functions:
  ```
  FCM_SERVICE_ACCOUNT='<conteúdo JSON do service account em uma linha>'
  ```
- A função `send-adjustment-notifications` calcula os ajustes do dia e envia o push (FCM HTTP v1). Sem a secret, ela só calcula (não envia).

### 5. Agendar (toda segunda 07:00)
No Supabase (SQL / pg_cron) ou no agendador da sua plataforma, chame a função semanalmente:
```sql
select cron.schedule(
  'ajustes-mensais',
  '0 7 * * 1',  -- toda segunda 07:00
  $$ select net.http_post(
       url := 'https://<PROJECT>.supabase.co/functions/v1/send-adjustment-notifications',
       headers := jsonb_build_object('Content-Type','application/json','Authorization','Bearer <ANON_OR_SERVICE_KEY>')
     ); $$
);
```

### 6. Ativar no dispositivo
Abra a aba **Ajustes** e clique em **Ativar notificações** (registra o token do aparelho). Ao clicar na notificação, o app abre direto em `/adjustments`.

## Tabela criada
`push_tokens` (migration `20260630120000_push_tokens.sql`): guarda os tokens FCM por usuário, com RLS (cada um só vê os seus).
