/* Service worker do Firebase Cloud Messaging (push em segundo plano). */
importScripts('https://www.gstatic.com/firebasejs/10.12.2/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.12.2/firebase-messaging-compat.js');

const firebaseConfig = {
  apiKey: 'AIzaSyDG1k8Lvh2pl66Mlxaei5uFixWcwGs7pQE',
  authDomain: 'rfconsultoria-c8f44.firebaseapp.com',
  projectId: 'rfconsultoria-c8f44',
  storageBucket: 'rfconsultoria-c8f44.firebasestorage.app',
  messagingSenderId: '520882593280',
  appId: '1:520882593280:web:ecf57d2aa8eba6534d02e5',
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
