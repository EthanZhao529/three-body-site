// GitHub Pages SPA 兜底:深链接(如 /three-body-site/fleet)由 404.html 载入同一应用,交给前端路由
import { copyFileSync } from 'node:fs';

copyFileSync('dist/index.html', 'dist/404.html');
console.log('postbuild: dist/404.html written');
