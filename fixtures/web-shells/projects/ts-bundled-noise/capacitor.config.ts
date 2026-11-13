import type { CapacitorConfig } from '@capacitor/cli';

// Live reload during development; never commit it uncommented:
// server: { url: 'http://localhost:5173', cleartext: true },

/* An older remote setup:
const remote = { server: { url: 'https://staging.example.com' } };
*/

const config: CapacitorConfig = {
  appId: 'com.example.dashboard',
  appName: 'Dashboard',
  webDir: 'dist',
  plugins: {
    LiveUpdates: {
      server: { url: 'http://localhost:9000/updates' },
    },
  },
};

export default config;
