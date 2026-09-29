import { crx } from '@crxjs/vite-plugin';
import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'vite';
import manifest from './manifest.json';

export default defineConfig({
  plugins: [tailwindcss(), crx({ manifest })],
  define: {
    // Horodatage du build, loggé au démarrage pour vérifier quelle version tourne dans un onglet
    __SYNCKAI_BUILD__: JSON.stringify(new Date().toISOString()),
  },
});
