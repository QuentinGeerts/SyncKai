import { crx } from '@crxjs/vite-plugin';
import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'vite';
import manifest from './manifest.json';

export default defineConfig(({ mode }) => ({
  plugins: [tailwindcss(), crx({ manifest })],
  build: {
    rollupOptions: {
      // Pages d'extension hors manifeste (ouvertes via chrome.runtime.getURL)
      input: { import: 'src/import/import.html' },
    },
  },
  define: {
    // Horodatage du build, loggé au démarrage pour vérifier quelle version tourne dans un onglet
    __SYNCKAI_BUILD__: JSON.stringify(new Date().toISOString()),
    // Logs debug/info : actifs hors production (`npm run dev`, `npm run build:dev`)
    __SYNCKAI_DEBUG__: JSON.stringify(mode !== 'production'),
  },
}));
