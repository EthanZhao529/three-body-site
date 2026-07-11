import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

// GitHub Pages 项目站点:https://ethanzhao529.github.io/three-body-site/
// public/ 内容(santi.html + js/css/assets)原样透传,线上 URL 与旧站完全一致
export default defineConfig({
  base: '/three-body-site/',
  plugins: [react(), tailwindcss()]
});
