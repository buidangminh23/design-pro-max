import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.example.dashboard',
  appName: 'Dashboard',
  webDir: 'dist',
  server: {
    url: 'https://example.com',
  },
};

export default config;
