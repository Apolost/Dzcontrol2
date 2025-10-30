import path from 'path';
import { defineConfig, loadEnv } from 'vite';


export default defineConfig(({ mode }) => {
    const env = loadEnv(mode, '.', '');
    return {
      server: {
        port: 3000,
        host: '0.0.0.0',
      },
      plugins: [],
      define: {
        'process.env.API_KEY': JSON.stringify(env.GEMINI_API_KEY),
        'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY)
      },
      resolve: {
        alias: {
          '@': path.resolve(__dirname, '.'),
        }
      }
    };
});

import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// ZDE uprav base – musí odpovídat názvu repozitáře
export default defineConfig({
  plugins: [react()],
  base: '/Dzcontrol2/', // <- tohle je důležité!
})
