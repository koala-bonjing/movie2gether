import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'app.duet.watch',
  appName: 'Duet',
  webDir: 'dist',
  backgroundColor: '#0F0D12',
  server: {
    androidScheme: 'https',
  },
};

export default config;
