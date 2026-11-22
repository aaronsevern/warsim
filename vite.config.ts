import { defineConfig } from 'vite';

export default defineConfig({
  // Relative asset paths so the build works under https://<user>.github.io/<repo>/
  base: './',
  build: { chunkSizeWarningLimit: 2000 },
});
