export async function subscribe(registration, publicKey) {
  const permission = await Notification.requestPermission();
  if (permission !== 'granted') return null;
  const subscription = await registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: publicKey });
  await fetch('/api/push/subscribe', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(subscription) });
  return subscription;
}
