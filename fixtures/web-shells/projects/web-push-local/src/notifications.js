export async function enableAlerts(registration, key) {
  const permission = await Notification.requestPermission();
  if (permission !== 'granted') return null;
  return registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: key });
}
