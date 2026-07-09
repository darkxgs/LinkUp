import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  base: '/games/casino/',
  build: {
    outDir: '../hosting/public/games/casino',
    emptyOutDir: true,
    chunkSizeWarningLimit: 20000,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('plinkoOutcomes')) return 'plinko-outcomes';
          if (id.includes('phaser')) return 'phaser';
          if (id.includes('chart.js')) return 'chartjs';
          if (id.includes('node_modules/antd') || id.includes('@ant-design')) return 'antd';
          if (
            id.includes('node_modules/react/') ||
            id.includes('node_modules/react-dom/') ||
            id.includes('node_modules/scheduler/')
          ) {
            return 'react-vendor';
          }
        },
      },
    },
  },
});
