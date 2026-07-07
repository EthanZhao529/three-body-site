const puppeteer = require('puppeteer-core');
const path = require('path');
const CHROME = 'C:\\Users\\13281\\.cache\\hyperframes\\chrome\\chrome-headless-shell\\win64-131.0.6778.85\\chrome-headless-shell-win64\\chrome-headless-shell.exe';

(async () => {
  const b = await puppeteer.launch({ executablePath: CHROME, headless: 'shell', args: ['--no-sandbox', '--hide-scrollbars'] });
  const p = await b.newPage();
  const bad = [];
  p.on('requestfailed', r => bad.push('REQ: ' + r.url()));
  p.on('pageerror', e => bad.push('JS: ' + e.message));
  await p.setViewport({ width: 1600, height: 1000 });
  await p.goto('https://ethanzhao529.github.io/three-body-site/', { waitUntil: 'networkidle0', timeout: 90000 });
  await new Promise(r => setTimeout(r, 4000));
  await p.screenshot({ path: path.join(__dirname, 'shots', 'live_hero.png') });
  await p.evaluate(() => {
    document.querySelectorAll('.reveal').forEach(e => e.classList.add('on'));
    document.querySelector('#signal').scrollIntoView();
  });
  await new Promise(r => setTimeout(r, 1000));
  await p.screenshot({ path: path.join(__dirname, 'shots', 'live_signal.png') });
  console.log('saved; problems:', bad.length ? bad.join(' | ') : 'none');
  await b.close();
})().catch(e => { console.error('ERR', e.message); process.exit(1); });
