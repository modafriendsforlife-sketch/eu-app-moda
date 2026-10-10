const PUSH_SUBSCRIPTION_KEY = 'minha-jornada-push-subscription';

function base64ToUint8Array(value: string): Uint8Array {
  const padding = '='.repeat((4 - (value.length % 4)) % 4);
  const base64 = (value + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = window.atob(base64);
  return Uint8Array.from(raw, (character) => character.charCodeAt(0));
}

export async function registerServiceWorker(): Promise<void> {
  if (!('serviceWorker' in navigator)) return;
  try {
    const registration = await navigator.serviceWorker.register('/sw.js', {
      scope: '/',
      updateViaCache: 'none',
    });
    if (navigator.serviceWorker.controller) {
      let reloaded = false;
      navigator.serviceWorker.addEventListener('controllerchange', () => {
        if (reloaded) return;
        reloaded = true;
        window.location.reload();
      }, { once: true });
    }

    await registration.update();
  } catch {
    // Push remains unavailable when the browser blocks service workers.
  }
}

export async function requestPushPermissionAndSaveSubscription(): Promise<void> {
  if (!('Notification' in window)) return;

  let permission: NotificationPermission;
  try {
    permission = await Notification.requestPermission();
  } catch {
    return;
  }
  if (permission !== 'granted' || !('serviceWorker' in navigator) || !('PushManager' in window)) return;

  try {
    const registration = await navigator.serviceWorker.ready;
    const vapidPublicKey = import.meta.env.VITE_VAPID_PUBLIC_KEY as string | undefined;
    const existingSubscription = await registration.pushManager.getSubscription();
    const subscription = existingSubscription ?? (vapidPublicKey
      ? await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: base64ToUint8Array(vapidPublicKey),
        })
      : null);

    if (subscription) {
      localStorage.setItem(PUSH_SUBSCRIPTION_KEY, JSON.stringify(subscription.toJSON()));
    }
  } catch {
    // Permission can be granted while the device still rejects push registration.
  }
}

export async function showReminderNotification(title: string, body: string, tag: string): Promise<void> {
  if (!('serviceWorker' in navigator) || !('Notification' in window) || Notification.permission !== 'granted') return;
  try {
    const registration = await navigator.serviceWorker.ready;
    await registration.showNotification(title, {
      body,
      icon: '/assets/logo-mf-192.png',
      badge: '/assets/logo-mf-192.png',
      tag,
    });
  } catch {
    // The existing in-app notification remains the fallback.
  }
}
