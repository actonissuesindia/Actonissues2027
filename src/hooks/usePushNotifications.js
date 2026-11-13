import { useCallback, useEffect, useState } from 'react';
import api from '../services/api';

const SUPPORTED = typeof window !== 'undefined' && 'serviceWorker' in navigator && 'PushManager' in window;

// VAPID public key arrives from the server as URL-safe base64; the Push API
// wants it as a raw Uint8Array.
function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  return Uint8Array.from([...rawData].map(c => c.charCodeAt(0)));
}

// Drives the "push notifications" toggle: registers the service worker,
// tracks whether this browser is currently subscribed, and subscribes/
// unsubscribes on demand. Only meaningful for a signed-in user (a push
// subscription is tied to req.user._id server-side).
export default function usePushNotifications(user) {
  const [permission, setPermission] = useState(SUPPORTED ? Notification.permission : 'unsupported');
  const [subscribed, setSubscribed] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!SUPPORTED || !user) return;
    navigator.serviceWorker.register('/sw.js')
      .then((reg) => reg.pushManager.getSubscription())
      .then((sub) => setSubscribed(!!sub))
      .catch(() => {});
  }, [user]);

  const enable = useCallback(async () => {
    if (!SUPPORTED || !user || busy) return;
    setBusy(true);
    try {
      const reg = await navigator.serviceWorker.register('/sw.js');
      const perm = await Notification.requestPermission();
      setPermission(perm);
      if (perm !== 'granted') return;

      const { data } = await api.get('/push/vapid-public-key');
      let sub = await reg.pushManager.getSubscription();
      if (!sub) {
        sub = await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(data.publicKey)
        });
      }
      await api.post('/push/subscribe', sub.toJSON());
      setSubscribed(true);
    } finally {
      setBusy(false);
    }
  }, [user, busy]);

  const disable = useCallback(async () => {
    if (!SUPPORTED || busy) return;
    setBusy(true);
    try {
      const reg = await navigator.serviceWorker.getRegistration();
      const sub = reg && await reg.pushManager.getSubscription();
      if (sub) {
        await api.post('/push/unsubscribe', { endpoint: sub.endpoint });
        await sub.unsubscribe();
      }
      setSubscribed(false);
    } finally {
      setBusy(false);
    }
  }, [busy]);

  return { supported: SUPPORTED, permission, subscribed, busy, enable, disable };
}
