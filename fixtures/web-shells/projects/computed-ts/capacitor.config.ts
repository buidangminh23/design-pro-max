import type { CapacitorConfig } from '@capacitor/cli';

const isDev = process.env.NODE_ENV !== 'production';

const config: CapacitorConfig = {
  appId: 'com.example.dashboard',
  appName: 'Dashboard',
  webDir: 'shell',
  server: {
    url: isDev ? 'http://localhost:5173' : 'https://app.example.com',
  },
};

export default config;
