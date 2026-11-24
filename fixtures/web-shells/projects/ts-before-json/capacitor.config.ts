import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.example.dashboard',
  appName: 'Dashboard',
  webDir: 'shell',
  server: {
    url: 'https://app.example.com',
    errorPath: 'offline.html',
  },
};

export default config;
