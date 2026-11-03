import { defineConfig } from 'vite';
import { viteSingleFile } from 'vite-plugin-singlefile';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export default defineConfig({
  plugins: [
    viteSingleFile(),
    {
      name: 'rename-to-hening-html',
      closeBundle() {
        const dist = path.resolve(__dirname, 'dist');
        const idx = path.join(dist, 'index.html');
        const target = path.join(dist, 'hening.html');
        if (fs.existsSync(idx)) {
          fs.renameSync(idx, target);
        }
      },
    },
  ],
  build: {
    outDir: 'dist',
    emptyOutDir: true,
  },
});
