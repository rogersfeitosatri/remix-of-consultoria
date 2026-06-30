// Configuração do Firebase Cloud Messaging (push notifications).
//
// Preencha as variáveis no .env (prefixo VITE_) com os dados do SEU projeto Firebase
// (Configurações do projeto → Geral → Seus apps → SDK; e Cloud Messaging → Web Push certificates):
//
//   VITE_FIREBASE_API_KEY=...
//   VITE_FIREBASE_AUTH_DOMAIN=...
//   VITE_FIREBASE_PROJECT_ID=...
//   VITE_FIREBASE_STORAGE_BUCKET=...
//   VITE_FIREBASE_MESSAGING_SENDER_ID=...
//   VITE_FIREBASE_APP_ID=...
//   VITE_FIREBASE_VAPID_KEY=...   (chave do par de chaves Web Push)
//
// E replique os mesmos valores em public/firebase-messaging-sw.js (service worker).
//
// Usamos import dinâmico do SDK 'firebase' para não acoplar o build a ele quando as
// credenciais ainda não estão configuradas. Os @ts-ignore evitam erro de tsc local
// (o pacote 'firebase' é instalado no ambiente de produção).

export const firebaseConfig = {
  // A Web API key do Firebase não é secreta (fica no cliente). Restrinja-a por domínio no Google Cloud.
  apiKey: (import.meta.env.VITE_FIREBASE_API_KEY as string | undefined) ?? 'AIzaSyDG1k8Lvh2pl66Mlxaei5uFixWcwGs7pQE',
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN as string | undefined,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID as string | undefined,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET as string | undefined,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID as string | undefined,
  appId: import.meta.env.VITE_FIREBASE_APP_ID as string | undefined,
};

export const VAPID_KEY = import.meta.env.VITE_FIREBASE_VAPID_KEY as string | undefined;

export function isFirebaseConfigured(): boolean {
  return Boolean(
    firebaseConfig.apiKey && firebaseConfig.projectId &&
    firebaseConfig.messagingSenderId && firebaseConfig.appId && VAPID_KEY,
  );
}

async function getMessagingIfSupported(): Promise<any | null> {
  try {
    if (!isFirebaseConfigured()) return null;
    // @ts-ignore firebase instalado em produção
    const { initializeApp, getApps } = await import('firebase/app');
    // @ts-ignore
    const { getMessaging, isSupported } = await import('firebase/messaging');
    if (!(await isSupported())) return null;
    const app = getApps().length ? getApps()[0] : initializeApp(firebaseConfig as any);
    return getMessaging(app);
  } catch {
    return null;
  }
}

/** Solicita permissão, registra o service worker e retorna o token FCM do dispositivo. */
export async function requestPushToken(): Promise<string | null> {
  if (!isFirebaseConfigured()) throw new Error('Firebase não configurado. Defina as variáveis VITE_FIREBASE_*.');
  const messaging = await getMessagingIfSupported();
  if (!messaging) throw new Error('Navegador sem suporte a push ou Firebase indisponível.');

  const permission = await Notification.requestPermission();
  if (permission !== 'granted') throw new Error('Permissão de notificação negada.');

  // @ts-ignore
  const { getToken } = await import('firebase/messaging');
  const registration = await navigator.serviceWorker.register('/firebase-messaging-sw.js');
  const token = await getToken(messaging, {
    vapidKey: VAPID_KEY,
    serviceWorkerRegistration: registration,
  });
  return token || null;
}

/** Escuta mensagens em primeiro plano (app aberto). */
export async function onForegroundMessage(cb: (payload: any) => void): Promise<() => void> {
  const messaging = await getMessagingIfSupported();
  if (!messaging) return () => {};
  // @ts-ignore
  const { onMessage } = await import('firebase/messaging');
  return onMessage(messaging, cb);
}
