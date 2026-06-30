/* Service worker do Firebase Cloud Messaging (push em segundo plano).
 *
 * IMPORTANTE: preencha o objeto firebaseConfig abaixo com os MESMOS valores
 * usados no app (src/lib/firebase.ts). O service worker NÃO enxerga as
 * variáveis VITE_*, então os valores precisam ser colados aqui literalmente.
 */
importScripts('https://www.gstatic.com/firebasejs/10.12.2/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.12.2/firebase-messaging-compat.js');

const firebaseConfig = {
  apiKey: 'AIzaSyDG1k8Lvh2pl66Mlxaei5uFixWcwGs7pQE',
  authDomain: 'COLE_AQUI',      // ex: SEU-PROJETO.firebaseapp.com
  projectId: 'COLE_AQUI',       // ex: seu-projeto
  storageBucket: 'COLE_AQUI',   // ex: SEU-PROJETO.appspot.com
  messagingSenderId: 'COLE_AQUI',
  appId: 'COLE_AQUI',
};

try {
  firebase.initializeApp(firebaseConfig);
  const messaging = firebase.messaging();

  messaging.onBackgroundMessage((payload) => {
    const title = (payload.notification && payload.notification.title) || 'Ajustes do mês';
    const options = {
      body: (payload.notification && payload.notification.body) || 'Há atletas para ajustar o plano.',
      icon: '/favicon.ico',
      data: { url: (payload.data && payload.data.url) || '/adjustments' },
    };
    self.registration.showNotification(title, options);
  });
} catch (e) {
  // Firebase ainda não configurado — ignora.
}

// Ao clicar na notificação, abre a aba de Ajustes.
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || '/adjustments';
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((wins) => {
      for (const win of wins) {
        if (win.url.includes(url) && 'focus' in win) return win.focus();
      }
      if (clients.openWindow) return clients.openWindow(url);
    }),
  );
});
