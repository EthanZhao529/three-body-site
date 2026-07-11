// 水滴复刻页无头验收:#t= 快进到关键时刻逐帧截图
const puppeteer = require('puppeteer-core');
const path = require('path');
const fs = require('fs');
const CHROME = 'C:\\Users\\13281\\.cache\\hyperframes\\chrome\\chrome-headless-shell\\win64-131.0.6778.85\\chrome-headless-shell-win64\\chrome-headless-shell.exe';
const BASE = process.env.SITE_URL || 'http://127.0.0.1:8172/droplet.html';
const OUT = path.resolve(__dirname, 'shots');
if (!fs.existsSync(OUT)) fs.mkdirSync(OUT);

(async () => {
  const b = await puppeteer.launch({
    executablePath: CHROME, headless: 'shell',
    args: ['--no-sandbox', '--hide-scrollbars', '--enable-unsafe-swiftshader'],
  });
  const p = await b.newPage();
  const bad = [];
  p.on('requestfailed', r => bad.push('REQ ' + r.url()));
  p.on('pageerror', e => bad.push('JS ' + e.message));
  await p.setViewport({ width: 1600, height: 900, deviceScaleFactor: 1 });

  for (const t of process.argv.slice(2).length ? process.argv.slice(2) : ['2', '8.9', '13']) {
    await p.goto(BASE + '?r=' + Math.random().toString(36).slice(2) + '#t=' + t, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await new Promise(r => setTimeout(r, 12000));   // SwiftShader 慢,给足渲染时间
    await p.screenshot({ path: path.join(OUT, 'dp_t' + t + '.png') });
    console.log('shot t=' + t);
  }
  console.log(bad.length ? '!! ' + bad.join('\n!! ') : 'no errors');
  await b.close();
})();
